-- Sahiplendirme yüzeyi: okuma yolu + bayat ilan savunması
--
-- Eksik olan iki şey:
--
--   1. Petsiz kullanıcı hiçbir pet göremiyordu. pets üzerindeki RLS yalnızca
--      "kendi petlerim + eşleştiklerim" diyor; hayvanı olmayan kullanıcının
--      ikisi de yok. Sahiplendirme hunisinin girişi bu kullanıcı olduğuna göre
--      listeleme SECURITY DEFINER bir RPC olmak zorunda.
--
--   2. Bayat ilan. Yüzeyi öldüren şey yanlış eşleşme değil, yanıt vermeyen
--      ilan sahibi. Sıralama bekleme süresine göre yapılırsa tam tersi olur:
--      bekleme süresi aciliyetin değil bayatlığın sinyalidir.
--
-- Not: sahiplendirme mesafeye göre değil ŞEHRE göre filtrelenir. Konum
-- pets tablosunda tutuluyor; hayvanı olmayan kullanıcının konumu yok — ve
-- sırf bunun için yeni bir konum yüzeyi açmak istemiyoruz.

-- ---------------------------------------------------------------------------
-- 1. İlan teyidi
-- ---------------------------------------------------------------------------

alter table pets add column adoption_confirmed_at timestamptz;

-- İlan açıldığı anda teyitli sayılır.
create or replace function stamp_adoption_confirmation()
returns trigger
language plpgsql
as $$
begin
  if 'adoption' = any (new.goals)
     and (tg_op = 'INSERT' or not ('adoption' = any (old.goals))) then
    new.adoption_confirmed_at := now();
  elsif not ('adoption' = any (new.goals)) then
    new.adoption_confirmed_at := null;
  end if;
  return new;
end;
$$;

create trigger pets_stamp_adoption_confirmation
  before insert or update of goals on pets
  for each row execute function stamp_adoption_confirmation();

/** "Hâlâ yuva arıyor mu?" — sahibi teyit eder, ilan tazelenir. */
create or replace function confirm_adoption_listing(p_pet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not owns_pet(p_pet_id) then
    raise exception 'not your pet' using errcode = '42501';
  end if;

  update pets set adoption_confirmed_at = now()
  where id = p_pet_id and 'adoption' = any (goals);
end;
$$;

/**
 * Teyitsiz kalan ilanları duraklatır — zamanlanmış iş bunu çağırır.
 *
 * Silmiyor: amaçtan 'adoption' çıkarılıyor, pet ve geçmişi duruyor.
 * Sahibi tek dokunuşla geri açabilir.
 */
create or replace function pause_stale_adoption_listings(p_days integer default 14)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with paused as (
    update pets
    set goals = array_remove(goals, 'adoption'::match_goal)
    where 'adoption' = any (goals)
      and adoption_confirmed_at < now() - (p_days || ' days')::interval
      -- amaç kümesi boş kalmasın
      and cardinality(array_remove(goals, 'adoption'::match_goal)) > 0
    returning 1
  )
  select count(*) into v_count from paused;

  return v_count;
end;
$$;

-- DİKKAT: Supabase'de `revoke ... from public` TEK BAŞINA YETMEZ.
-- İmaj, public şemada oluşturulan fonksiyonlar için anon/authenticated/
-- service_role rollerine default privilege ile ayrıca execute veriyor;
-- public'ten revoke etmek o grant'ları kaldırmıyor. Rolleri tek tek yazmak
-- gerekiyor. Kendi içinde auth.uid() kontrolü yapan fonksiyonlarda bu sadece
-- gereksiz bir yüzey, ama içeride kontrolü OLMAYAN fonksiyonlarda doğrudan açık.
revoke all on function confirm_adoption_listing(uuid) from public, anon, authenticated;
revoke all on function pause_stale_adoption_listings(integer) from public, anon, authenticated;

grant execute on function confirm_adoption_listing(uuid) to authenticated;
-- pause_stale_adoption_listings içeride yetki kontrolü yapmaz: yalnızca
-- zamanlanmış iş (service_role) çağırır.
grant execute on function pause_stale_adoption_listings(integer) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Yanıt verme oranı
--
-- Hiç başvuru almamış ilan sahibi CEZALANDIRILMAZ — varsayılan 1.0. Aksi
-- halde yeni ilanlar hiç görünmez ve yüzey kendini kilitler.
-- ---------------------------------------------------------------------------

create or replace function owner_response_rate(p_owner_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select count(*) filter (where ai.responded_at is not null)::numeric
            / nullif(count(*), 0)
     from adoption_interests ai
     join pets p on p.id = ai.pet_id
     where p.owner_id = p_owner_id),
    1.0
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Listeleme
-- ---------------------------------------------------------------------------

create index pets_adoption_idx on pets (species, city)
  where is_active and 'adoption' = any (goals);

create or replace function list_adoptable_pets(
  p_species species[] default null,
  p_city    text default null,
  p_limit   integer default 50
)
returns table (
  id                 uuid,
  owner_id           uuid,
  name               text,
  species            species,
  breed              text,
  birth_date         date,
  gender             pet_gender,
  is_neutered        boolean,
  size               pet_size,
  temperaments       text[],
  good_with_cats     boolean,
  good_with_dogs     boolean,
  good_with_kids     boolean,
  bio                text,
  city               text,
  photo_paths        text[],
  activity_bucket    text,
  owner_verified     boolean,
  already_applied    boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_blocked uuid[];
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  v_blocked := blocked_user_ids();

  return query
  select
    p.id, p.owner_id, p.name, p.species, p.breed, p.birth_date, p.gender,
    p.is_neutered, p.size, p.temperaments,
    p.good_with_cats, p.good_with_dogs, p.good_with_kids,
    p.bio, p.city,
    coalesce(
      (select array_agg(ph.storage_path order by ph.position)
       from pet_photos ph where ph.pet_id = p.id),
      '{}'
    ),
    activity_bucket(prof.last_active_at),
    (prof.verification_status = 'approved'),
    exists (
      select 1 from adoption_interests ai
      where ai.pet_id = p.id and ai.applicant_id = auth.uid()
    )
  from pets p
  join profiles prof on prof.id = p.owner_id
  where p.is_active
    and 'adoption' = any (p.goals)
    and p.owner_id <> auth.uid()
    and p.owner_id <> all (v_blocked)
    and (p_species is null or p.species = any (p_species))
    and (p_city is null or p.city = p_city)
  -- Sıralama: yanıt veren ve aktif ilan sahibi önce. Bekleme süresi
  -- KULLANILMIYOR — bayatlık sinyali olduğu için iptal oranını yükseltir.
  order by
    owner_response_rate(p.owner_id) desc,
    prof.last_active_at desc,
    p.adoption_confirmed_at desc
  limit least(coalesce(p_limit, 50), 100);
end;
$$;

revoke all on function list_adoptable_pets(species[], text, integer) from public, anon;
grant execute on function list_adoptable_pets(species[], text, integer) to authenticated;
