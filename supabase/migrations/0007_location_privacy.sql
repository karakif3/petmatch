-- Konum gizliliği — üçgenleme (trilateration) savunması
--
-- Açık: discover_pets ham ondalık mesafe döndürüyordu. Saldırgan kendi
-- konumunu üç farklı noktaya taşıyıp aynı hedefin mesafesini okursa, üç
-- çemberin kesişimi hedefin evini metrelerle verir. Dating uygulamalarında
-- defalarca sömürülmüş klasik bir saldırı.
--
-- İki katmanlı savunma — biri tek başına yeterli değil:
--
--   1. YAZARKEN: konum ~1 km'lik ızgaraya oturtulur. Ham GPS hiç saklanmaz,
--      veritabanı sızsa bile kimsenin tam adresi çıkmaz.
--   2. OKURKEN: mesafe kova olarak döner ('<1', '1-3', …). Sürekli ondalık
--      tek başına bile sızıntıdır; ızgara varken bile üçgenlemeyi kolaylaştırır.

-- ---------------------------------------------------------------------------
-- 1. Yazarken: ızgaraya oturtma
--
-- 2 ondalık ≈ enlemde 1.1 km, 41°N boylamında ~0.84 km. Aynı hücredeki iki
-- pet birbirine 0 km görünür — kabul edilebilir, çünkü zaten "1 km'den yakın".
-- ---------------------------------------------------------------------------

create or replace function snap_pet_location()
returns trigger
language plpgsql
as $$
begin
  if new.latitude is not null then
    new.latitude := round(new.latitude::numeric, 2)::double precision;
  end if;
  if new.longitude is not null then
    new.longitude := round(new.longitude::numeric, 2)::double precision;
  end if;
  return new;
end;
$$;

create trigger pets_snap_location
  before insert or update of latitude, longitude on pets
  for each row execute function snap_pet_location();

-- Halihazırda yazılmış ham konumlar varsa onları da kabalaştır.
update pets
set latitude = round(latitude::numeric, 2)::double precision,
    longitude = round(longitude::numeric, 2)::double precision
where latitude is not null or longitude is not null;

-- ---------------------------------------------------------------------------
-- 2. Okurken: kova
--
-- core/domain/distance.ts `distanceBucket` ile aynı sınırlar.
-- ---------------------------------------------------------------------------

create or replace function distance_bucket(km double precision)
returns text
language sql
immutable
as $$
  select case
    when km is null then null
    when km <  1 then '<1'
    when km <  3 then '1-3'
    when km <  5 then '3-5'
    when km < 10 then '5-10'
    when km < 25 then '10-25'
    else '25+'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 3. discover_pets artık km değil kova döndürüyor
--
-- Sıralama hâlâ gerçek mesafeye göre (en yakın önce) — o değer sadece
-- sunucuda kalıyor, ağa çıkmıyor.
-- ---------------------------------------------------------------------------

drop function if exists discover_pets(uuid, integer);

create or replace function discover_pets(
  p_pet_id uuid,
  p_limit integer default 50
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
  intent          match_intent,
  bio             text,
  city            text,
  photo_paths     text[],
  distance_bucket text,
  owner_visible   boolean
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
  with candidates as (
    select
      p.*,
      prof.owner_visibility,
      case
        when v_viewer.latitude is null or p.latitude is null then null
        else haversine_km(v_viewer.latitude, v_viewer.longitude, p.latitude, p.longitude)
      end as km
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
  )
  select
    c.id,
    c.owner_id,
    c.name,
    c.species,
    c.breed,
    c.birth_date,
    c.gender,
    c.is_neutered,
    c.size,
    c.energy_level,
    c.temperaments,
    c.good_with_cats,
    c.good_with_dogs,
    c.good_with_kids,
    c.intent,
    c.bio,
    c.city,
    coalesce(
      (select array_agg(ph.storage_path order by ph.position)
       from pet_photos ph where ph.pet_id = c.id),
      '{}'
    ) as photo_paths,
    distance_bucket(c.km) as distance_bucket,
    (c.owner_visibility <> 'hidden') as owner_visible
  from candidates c
  -- Sıralama gerçek mesafeye göre; km değeri sunucuda kalır.
  order by c.km asc nulls last
  limit least(coalesce(p_limit, 50), 100);
end;
$$;
