-- Amaç modeli — hikâye petin etrafında
--
-- docs/goal-model.md karşılığı:
--   * Amaçlar yalnızca pete ait. Kullanıcıya kendisi hakkında niyet sorulmaz.
--   * intent (playdate/mating/both) → goals dizisi (playdate/adoption).
--     mating MVP'den çıkarıldı; 'both' özel durumu küme kesişimiyle gereksizleşti.
--   * Sahip nitelikleri (doğum tarihi, cinsiyet) eklenir ama "kimleri istiyorum"
--     tercihi SAKLANMAZ — çıkarımla yönelim verisi olur (KVKK m.6). Filtre
--     sorgu parametresi olarak gelir.
--   * Karşılıklı açıklama: paylaşan paylaşanı görür.

-- ---------------------------------------------------------------------------
-- 1. Amaçlar
--
-- discover_pets önce düşürülüyor: dönüş tipinde match_intent geçtiği için
-- fonksiyon dururken o tip drop edilemez. Yenisi §5'te kuruluyor.
-- ---------------------------------------------------------------------------

drop function if exists discover_pets(uuid, integer);

create type match_goal as enum ('playdate', 'adoption');

alter table pets add column goals match_goal[] not null default '{playdate}';
alter table pets add constraint pets_goals_not_empty check (cardinality(goals) > 0);

-- Eski intent kolonu ve viewer tarafındaki intents filtresi emekli.
-- Deste artık "kendi petimin amaçlarıyla kesişenler" — ayrı bir filtre gereksiz.
alter table pets drop column intent;
alter table discovery_preferences drop column intents;
drop type match_intent;

-- Eşleşme hangi amaçla doğdu — sohbet listesindeki rozet buradan gelir.
alter table matches add column matched_goals match_goal[] not null default '{playdate}';

-- ---------------------------------------------------------------------------
-- 2. Sahip nitelikleri
-- ---------------------------------------------------------------------------

alter table profiles
  add column birth_date     date,
  add column gender         text check (gender in ('female', 'male', 'other')),
  add column last_active_at timestamptz not null default now();

-- 18+ — tüm uygulama. Kolon nullable çünkü handle_new_user() profili kayıt
-- anında açıyor; zorunluluk onboarding'in bitişine bağlanıyor.
alter table profiles add constraint profiles_adult check (
  onboarded_at is null
  or (birth_date is not null and birth_date <= current_date - interval '18 years')
);

-- İnsan katmanı açıksa sahip gizli olamaz: yüzünü hiç göstermeyen biriyle
-- tanışma araması anlamsız, ve keşfet sessizce boş deste üretir.
alter table profiles add constraint profiles_disclosed_owner_visible check (
  gender is null or owner_visibility <> 'hidden'
);

-- Son aktiflik: sıralama ve filtre sunucuda kesin değerle çalışır, istemciye
-- kova çıkar (bkz. docs/monetization.md — "2 dakika önce aktifti" taciz sinyali).
create index profiles_last_active_idx on profiles (last_active_at desc);

create or replace function touch_last_active()
returns void
language sql
security definer
set search_path = public
as $$
  update profiles set last_active_at = now() where id = auth.uid();
$$;

revoke all on function touch_last_active() from public;
grant execute on function touch_last_active() to authenticated;

create or replace function activity_bucket(p_last_active timestamptz)
returns text
language sql
immutable
as $$
  select case
    when p_last_active is null then null
    when p_last_active > now() - interval '1 day'  then 'today'
    when p_last_active > now() - interval '7 days'  then 'this_week'
    when p_last_active > now() - interval '30 days' then 'this_month'
    else 'older'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Keşfet filtreleri
-- ---------------------------------------------------------------------------

alter table discovery_preferences
  add column require_owner_photo boolean not null default false;

-- ---------------------------------------------------------------------------
-- 4. Eşleşme trigger'ı amaç kesişimini kaydeder
-- ---------------------------------------------------------------------------

create or replace function handle_swipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reciprocal boolean;
  v_from  pets%rowtype;
  v_to    pets%rowtype;
  v_goals match_goal[];
begin
  if new.direction <> 'like' then
    return new;
  end if;

  select exists (
    select 1 from swipes
    where from_pet_id = new.to_pet_id
      and to_pet_id = new.from_pet_id
      and direction = 'like'
  ) into v_reciprocal;

  if not v_reciprocal then
    return new;
  end if;

  select * into v_from from pets where id = new.from_pet_id;
  select * into v_to   from pets where id = new.to_pet_id;

  if is_blocked_between(v_from.owner_id, v_to.owner_id) then
    return new;
  end if;

  -- Amaç kesişimi — boşsa eşleşme doğmaz.
  select coalesce(array_agg(g), '{}')
  into v_goals
  from unnest(v_from.goals) g
  where g = any (v_to.goals);

  if cardinality(v_goals) = 0 then
    return new;
  end if;

  -- pet_a_id < pet_b_id kuralı: çifti sıralı yaz ki unique index çalışsın.
  insert into matches (pet_a_id, pet_b_id, matched_goals)
  values (
    least(new.from_pet_id, new.to_pet_id),
    greatest(new.from_pet_id, new.to_pet_id),
    v_goals
  )
  on conflict (pet_a_id, pet_b_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. discover_pets — amaç kesişimi + karşılıklı açıklama
--
-- Cinsiyet ve yaş KOLON DEĞİL PARAMETRE. Kalıcı saklansaydı "kadınım +
-- sadece erkekleri göster" çıkarımıyla yönelim verisi tutulmuş olurdu.
-- ---------------------------------------------------------------------------

create or replace function discover_pets(
  p_pet_id          uuid,
  p_owner_genders   text[] default null,
  p_owner_min_age   integer default null,
  p_owner_max_age   integer default null,
  p_limit           integer default 50
)
returns table (
  id              uuid,
  owner_id        uuid,
  name            text,
  species         species,
  breed           text,
  birth_date      date,
  gender          pet_gender,
  is_neutered     boolean,
  size            pet_size,
  energy_level    smallint,
  temperaments    text[],
  good_with_cats  boolean,
  good_with_dogs  boolean,
  good_with_kids  boolean,
  goals           match_goal[],
  bio             text,
  city            text,
  photo_paths     text[],
  distance_bucket text,
  activity_bucket text,
  owner_visible   boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer  pets%rowtype;
  v_me      profiles%rowtype;
  v_prefs   discovery_preferences%rowtype;
  v_blocked uuid[];
  v_lat_pad double precision;
  v_lon_pad double precision;
begin
  if not owns_pet(p_pet_id) then
    raise exception 'not authorized for pet %', p_pet_id using errcode = '42501';
  end if;

  select * into v_viewer from pets where pets.id = p_pet_id;
  select * into v_me from profiles where profiles.id = v_viewer.owner_id;
  select * into v_prefs from discovery_preferences where user_id = v_viewer.owner_id;

  -- KARŞILIKLI AÇIKLAMA: paylaşmayan filtreleyemez.
  if p_owner_genders is not null and v_me.gender is null then
    raise exception 'gender filter requires disclosing your own gender'
      using errcode = '42501';
  end if;
  if (p_owner_min_age is not null or p_owner_max_age is not null)
     and v_me.birth_date is null then
    raise exception 'age filter requires disclosing your own age'
      using errcode = '42501';
  end if;

  v_blocked := blocked_user_ids();

  v_lat_pad := v_prefs.max_distance_km / 111.0;
  v_lon_pad := v_prefs.max_distance_km / greatest(1.0, 111.0 * cos(radians(coalesce(v_viewer.latitude, 0))));

  return query
  with candidates as (
    select
      p.*,
      prof.owner_visibility,
      prof.avatar_url,
      prof.last_active_at,
      case
        when v_viewer.latitude is null or p.latitude is null then null
        else haversine_km(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude)
      end as km
    from pets p
    join profiles prof on prof.id = p.owner_id
    where p.is_active
      and p.owner_id <> v_viewer.owner_id
      and p.species = any (v_prefs.species)
      -- amaç kesişimi
      and p.goals && v_viewer.goals
      -- daha önce swipe'lanmışları gösterme
      and not exists (
        select 1 from swipes s
        where s.from_pet_id = p_pet_id and s.to_pet_id = p.id
      )
      and p.owner_id <> all (v_blocked)
      -- petin yaşı
      and (
        p.birth_date is null
        or (
          (v_prefs.min_age_years is null
            or p.birth_date <= current_date - (v_prefs.min_age_years * 365.25)::integer)
          and (v_prefs.max_age_years is null
            or p.birth_date >= current_date - (v_prefs.max_age_years * 365.25)::integer)
        )
      )
      -- sahip görünürlüğü zorunluluğu — çift yönlü
      and (not v_prefs.require_visible_owner or prof.owner_visibility <> 'hidden')
      and (
        not prof.require_visible_owner
        or v_me.owner_visibility <> 'hidden'
      )
      -- "sahibini de gösterenler": fotoğrafı VAR ve profili görünür
      and (
        not v_prefs.require_owner_photo
        or (prof.avatar_url is not null and prof.owner_visibility <> 'hidden')
      )
      -- karşılıklı açıklama filtreleri: yalnızca görünür sahipler arasında
      and (
        p_owner_genders is null
        or (prof.gender = any (p_owner_genders) and prof.owner_visibility <> 'hidden')
      )
      and (
        p_owner_min_age is null
        or (prof.birth_date is not null
            and prof.birth_date <= current_date - (p_owner_min_age || ' years')::interval)
      )
      and (
        p_owner_max_age is null
        or (prof.birth_date is not null
            and prof.birth_date >= current_date - ((p_owner_max_age + 1) || ' years')::interval)
      )
      -- mesafe: önce bounding box, sonra gerçek haversine
      and (
        v_viewer.latitude is null or p.latitude is null
        or (
          p.latitude between v_viewer.latitude - v_lat_pad and v_viewer.latitude + v_lat_pad
          and p.longitude between v_viewer.longitude - v_lon_pad and v_viewer.longitude + v_lon_pad
          and haversine_km(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude)
              <= v_prefs.max_distance_km
        )
      )
  )
  select
    c.id, c.owner_id, c.name, c.species, c.breed, c.birth_date, c.gender,
    c.is_neutered, c.size, c.energy_level, c.temperaments,
    c.good_with_cats, c.good_with_dogs, c.good_with_kids,
    c.goals, c.bio, c.city,
    coalesce(
      (select array_agg(ph.storage_path order by ph.position)
       from pet_photos ph where ph.pet_id = c.id),
      '{}'
    ),
    distance_bucket(c.km),
    activity_bucket(c.last_active_at),
    (c.owner_visibility <> 'hidden')
  from candidates c
  order by c.km asc nulls last
  limit least(coalesce(p_limit, 50), 100);
end;
$$;
