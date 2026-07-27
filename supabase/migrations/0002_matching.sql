-- Eşleşme mantığı: karşılıklı beğeni tetikleyicisi + keşfet RPC'si.

-- ---------------------------------------------------------------------------
-- Yardımcılar
-- ---------------------------------------------------------------------------

/** Verilen pet oturumdaki kullanıcıya mı ait? */
create or replace function owns_pet(p_pet_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from pets where id = p_pet_id and owner_id = auth.uid()
  );
$$;

/** Kullanıcının bu eşleşmede tarafı olan bir peti var mı? */
create or replace function is_match_participant(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from matches m
    join pets p on p.id in (m.pet_a_id, m.pet_b_id)
    where m.id = p_match_id and p.owner_id = auth.uid()
  );
$$;

/** İki kullanıcı arasında (her iki yönde) engelleme var mı? */
create or replace function is_blocked_between(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from blocks
    where (blocker_id = p_user_a and blocked_id = p_user_b)
       or (blocker_id = p_user_b and blocked_id = p_user_a)
  );
$$;

/** İki koordinat arası kuş uçuşu mesafe (km) — core/domain/distance.ts ile aynı formül. */
create or replace function haversine_km(
  lat1 double precision, lon1 double precision,
  lat2 double precision, lon2 double precision
)
returns double precision
language sql
immutable
as $$
  select 2 * 6371 * asin(
    least(1, sqrt(
      pow(sin(radians(lat2 - lat1) / 2), 2)
      + cos(radians(lat1)) * cos(radians(lat2)) * pow(sin(radians(lon2 - lon1) / 2), 2)
    ))
  );
$$;

-- ---------------------------------------------------------------------------
-- Karşılıklı beğeni → eşleşme
-- ---------------------------------------------------------------------------

create or replace function handle_swipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reciprocal boolean;
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

  if v_reciprocal then
    -- pet_a_id < pet_b_id kuralı: çifti sıralı yaz ki unique index çalışsın.
    insert into matches (pet_a_id, pet_b_id)
    values (
      least(new.from_pet_id, new.to_pet_id),
      greatest(new.from_pet_id, new.to_pet_id)
    )
    on conflict (pet_a_id, pet_b_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_swipe_created
  after insert on swipes
  for each row execute function handle_swipe();

-- ---------------------------------------------------------------------------
-- discover_pets — keşfet listesi
--
-- Neden RPC: pets tablosunda ham lat/lng var ve hiçbir istemciye
-- SELECT ettirilmiyor. Mesafe burada hesaplanıp yalnızca km olarak dönüyor.
-- Eleme kuralları core/domain/matching.ts `isEligible` ile aynı; sıralama
-- (uyum skoru) istemci tarafında yapılır.
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
  v_lat_pad double precision;
  v_lon_pad double precision;
begin
  if not owns_pet(p_pet_id) then
    raise exception 'not authorized for pet %', p_pet_id using errcode = '42501';
  end if;

  select * into v_viewer from pets where pets.id = p_pet_id;
  select * into v_prefs from discovery_preferences where user_id = v_viewer.owner_id;

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
    and not is_blocked_between(v_viewer.owner_id, p.owner_id)
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
