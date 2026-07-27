-- RLS performans deseni
--
-- 0003'teki politikalar doğruydu ama Postgres'in RLS'i her satır için yeniden
-- değerlendirmesine yol açıyordu. Supabase'in ölçtüğü üç desen burada uygulanıyor:
--
-- 1. `auth.uid()` → `(select auth.uid())`
--    Sarmalanan çağrı optimizer'a initPlan ürettirir; fonksiyon satır başına
--    değil sorgu başına bir kez çalışır.
--
-- 2. Satır-bağımlı fonksiyon çağrısı → dizi karşılaştırma
--    `owns_pet(pet_a_id)` argümanı satırdan aldığı için sarmalanamaz — her
--    satırda yeniden çalışır. Yerine "benim pet id'lerim"i bir kez üretip
--    `= any(...)` ile kıyaslıyoruz. Yardımcılar SECURITY DEFINER olduğu için
--    pets üzerindeki politikayı tetiklemez (özyineleme yok).
--
-- 3. `to authenticated`
--    Oturumsuz istekler politika hiç değerlendirilmeden reddedilir.
--
-- Ayrıca politikalarda filtre olarak kullanılan ama index'i olmayan kolonlar
-- (swipes.actor_id, messages.sender_id, blocks.blocked_id, reports.reporter_id)
-- index'leniyor.

-- ---------------------------------------------------------------------------
-- Küme yardımcıları — hepsi oturum başına sabit, satırdan bağımsız
-- ---------------------------------------------------------------------------

/** Oturumdaki kullanıcının pet id'leri. */
create or replace function my_pet_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(id), '{}') from pets where owner_id = auth.uid();
$$;

/** Oturumdaki kullanıcının taraf olduğu eşleşme id'leri (aktif olmayanlar dahil). */
create or replace function my_match_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(m.id), '{}')
  from matches m
  where m.pet_a_id = any (my_pet_ids()) or m.pet_b_id = any (my_pet_ids());
$$;

/** Aktif eşleşme paylaştığı kullanıcıların id'leri. */
create or replace function matched_owner_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct other.owner_id), '{}')
  from matches m
  join pets other on other.id in (m.pet_a_id, m.pet_b_id)
  where m.is_active
    and (m.pet_a_id = any (my_pet_ids()) or m.pet_b_id = any (my_pet_ids()))
    and other.owner_id <> auth.uid();
$$;

/** Görülebilen pet id'leri: kendi petlerim + eşleştiklerimin petleri. */
create or replace function visible_pet_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(id), '{}')
  from pets
  where owner_id = auth.uid() or owner_id = any (matched_owner_ids());
$$;

/** Oturumdaki kullanıcının engellediği + onu engelleyen kullanıcılar. */
create or replace function blocked_user_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(other), '{}')
  from (
    select blocked_id as other from blocks where blocker_id = auth.uid()
    union
    select blocker_id from blocks where blocked_id = auth.uid()
  ) s;
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

drop policy if exists profiles_select_self on profiles;
drop policy if exists profiles_select_public on profiles;
drop policy if exists profiles_select_matched on profiles;
drop policy if exists profiles_update_self on profiles;

create policy profiles_select_self on profiles
  for select to authenticated using (id = (select auth.uid()));

create policy profiles_select_public on profiles
  for select to authenticated using (owner_visibility = 'public');

create policy profiles_select_matched on profiles
  for select to authenticated using (
    owner_visibility = 'after_match' and id = any ((select matched_owner_ids())::uuid[])
  );

create policy profiles_update_self on profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- pets
-- ---------------------------------------------------------------------------

drop policy if exists pets_select_own on pets;
drop policy if exists pets_select_matched on pets;
drop policy if exists pets_insert_own on pets;
drop policy if exists pets_update_own on pets;
drop policy if exists pets_delete_own on pets;

create policy pets_select_own on pets
  for select to authenticated using (owner_id = (select auth.uid()));

create policy pets_select_matched on pets
  for select to authenticated using (owner_id = any ((select matched_owner_ids())::uuid[]));

create policy pets_insert_own on pets
  for insert to authenticated with check (owner_id = (select auth.uid()));

create policy pets_update_own on pets
  for update to authenticated
  using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));

create policy pets_delete_own on pets
  for delete to authenticated using (owner_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- pet_photos
-- ---------------------------------------------------------------------------

drop policy if exists pet_photos_select on pet_photos;
drop policy if exists pet_photos_write_own on pet_photos;

create policy pet_photos_select on pet_photos
  for select to authenticated using (pet_id = any ((select visible_pet_ids())::uuid[]));

create policy pet_photos_write_own on pet_photos
  for all to authenticated
  using (pet_id = any ((select my_pet_ids())::uuid[]))
  with check (pet_id = any ((select my_pet_ids())::uuid[]));

-- ---------------------------------------------------------------------------
-- discovery_preferences
-- ---------------------------------------------------------------------------

drop policy if exists discovery_preferences_own on discovery_preferences;

create policy discovery_preferences_own on discovery_preferences
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- swipes
-- ---------------------------------------------------------------------------

drop policy if exists swipes_select_own on swipes;
drop policy if exists swipes_insert_own on swipes;
drop policy if exists swipes_delete_own on swipes;

create policy swipes_select_own on swipes
  for select to authenticated using (actor_id = (select auth.uid()));

create policy swipes_insert_own on swipes
  for insert to authenticated with check (
    actor_id = (select auth.uid())
    and from_pet_id = any ((select my_pet_ids())::uuid[])
    and to_pet_id <> all ((select my_pet_ids())::uuid[])
  );

create policy swipes_delete_own on swipes
  for delete to authenticated
  using (actor_id = (select auth.uid()) and direction = 'pass');

-- ---------------------------------------------------------------------------
-- matches — UPDATE yok; bozma yolu unmatch() (bkz. 0005)
-- ---------------------------------------------------------------------------

drop policy if exists matches_select_participant on matches;

create policy matches_select_participant on matches
  for select to authenticated using (
    pet_a_id = any ((select my_pet_ids())::uuid[]) or pet_b_id = any ((select my_pet_ids())::uuid[])
  );

-- ---------------------------------------------------------------------------
-- messages — UPDATE yok; okundu yolu mark_messages_read() (bkz. 0005)
-- ---------------------------------------------------------------------------

drop policy if exists messages_select_participant on messages;
drop policy if exists messages_insert_participant on messages;

create policy messages_select_participant on messages
  for select to authenticated using (match_id = any ((select my_match_ids())::uuid[]));

create policy messages_insert_participant on messages
  for insert to authenticated with check (
    sender_id = (select auth.uid())
    and match_id = any ((select my_match_ids())::uuid[])
    and exists (select 1 from matches m where m.id = match_id and m.is_active)
  );

-- ---------------------------------------------------------------------------
-- blocks / reports / push_tokens
-- ---------------------------------------------------------------------------

drop policy if exists blocks_own on blocks;
drop policy if exists reports_insert_own on reports;
drop policy if exists reports_select_own on reports;
drop policy if exists push_tokens_own on push_tokens;

create policy blocks_own on blocks
  for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

create policy reports_insert_own on reports
  for insert to authenticated with check (reporter_id = (select auth.uid()));

create policy reports_select_own on reports
  for select to authenticated using (reporter_id = (select auth.uid()));

create policy push_tokens_own on push_tokens
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Politikalarda filtre olarak kullanılan kolonların index'leri
-- ---------------------------------------------------------------------------

create index if not exists swipes_actor_idx    on swipes (actor_id);
create index if not exists messages_sender_idx on messages (sender_id);
create index if not exists blocks_blocked_idx  on blocks (blocked_id);
create index if not exists reports_reporter_idx on reports (reporter_id);

-- ---------------------------------------------------------------------------
-- discover_pets — engelleme kontrolü satır başına fonksiyon çağrısı olmaktan
-- çıkıp bir kez üretilen diziye dönüyor. Geri kalan mantık 0002 ile aynı.
-- ---------------------------------------------------------------------------

create or replace function discover_pets(
  p_pet_id uuid,
  p_limit integer default 50
)
returns table (
  id             uuid,
  owner_id       uuid,
  name           text,
  species        species,
  breed          text,
  birth_date     date,
  gender         pet_gender,
  is_neutered    boolean,
  size           pet_size,
  energy_level   smallint,
  temperaments   text[],
  good_with_cats boolean,
  good_with_dogs boolean,
  good_with_kids boolean,
  intent         match_intent,
  bio            text,
  city           text,
  photo_paths    text[],
  distance_km    double precision,
  owner_visible  boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer  pets%rowtype;
  v_prefs   discovery_preferences%rowtype;
  v_blocked uuid[];
  v_lat_pad double precision;
  v_lon_pad double precision;
begin
  if not owns_pet(p_pet_id) then
    raise exception 'not authorized for pet %', p_pet_id using errcode = '42501';
  end if;

  select * into v_viewer from pets where pets.id = p_pet_id;
  select * into v_prefs from discovery_preferences where user_id = v_viewer.owner_id;

  -- Engellenenler bir kez toplanır; aksi halde her aday satırında
  -- is_blocked_between() çağrısı yapılırdı.
  v_blocked := blocked_user_ids();

  -- Bounding box ön elemesi — haversine'i her satırda çalıştırmamak için.
  -- 1 derece enlem ≈ 111 km; boylamda cos(enlem) ile daralır.
  v_lat_pad := v_prefs.max_distance_km / 111.0;
  v_lon_pad := v_prefs.max_distance_km / greatest(1.0, 111.0 * cos(radians(coalesce(v_viewer.latitude, 0))));

  return query
  select
    p.id,
    p.owner_id,
    p.name,
    p.species,
    p.breed,
    p.birth_date,
    p.gender,
    p.is_neutered,
    p.size,
    p.energy_level,
    p.temperaments,
    p.good_with_cats,
    p.good_with_dogs,
    p.good_with_kids,
    p.intent,
    p.bio,
    p.city,
    coalesce(
      (select array_agg(ph.storage_path order by ph.position)
       from pet_photos ph where ph.pet_id = p.id),
      '{}'
    ) as photo_paths,
    case
      when v_viewer.latitude is null or p.latitude is null then null
      else haversine_km(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude)
    end as distance_km,
    (prof.owner_visibility <> 'hidden') as owner_visible
  from pets p
  join profiles prof on prof.id = p.owner_id
  where p.is_active
    and p.owner_id <> v_viewer.owner_id
    and p.species = any (v_prefs.species)
    -- intent uyumu: 'both' her şeyle eşleşir
    and (
      p.intent = 'both'
      or exists (
        select 1 from unnest(v_prefs.intents) as want
        where want = 'both' or want = p.intent
      )
    )
    -- daha önce swipe'lanmışları gösterme
    and not exists (
      select 1 from swipes s
      where s.from_pet_id = p_pet_id and s.to_pet_id = p.id
    )
    -- engellenmiş kullanıcıları gösterme
    and p.owner_id <> all (v_blocked)
    -- yaş filtresi
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
      or exists (
        select 1 from profiles me
        where me.id = v_viewer.owner_id and me.owner_visibility <> 'hidden'
      )
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
  order by distance_km asc nulls last
  limit least(coalesce(p_limit, 50), 100);
end;
$$;
