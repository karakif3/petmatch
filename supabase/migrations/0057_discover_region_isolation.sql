-- Keşfet coğrafyası: seçilen yaşama/erişim bölgesi AYNI ZAMANDA arama
-- bölgesidir (kapalı İstanbul pilotu).
--
-- 0037 `profiles.region_slug` ekledi ama keşfet RPC'leri onu kullanmıyordu.
-- `discover_pets` mesafeyi yalnızca iki tarafın da koordinatı varken
-- uyguluyor; konum vermeyen bir Kadıköy kullanıcısı Nişantaşı / Beşiktaş /
-- bekleme listesi (`other`) petlerini görebiliyordu. Onboarding metni ise
-- bölgenin kimlerle eşleşeceğini belirlediğini söylüyordu.
--
-- Kilitli kural (Faz 2 "başka bölgeye bak" YOK):
--   1. Kullanıcının seçtiği bölge = Keşfet arama havuzu.
--   2. Cihaz konumu (~1 km yuvarlanmış) yalnızca O bölge içinde mesafe
--      filtresi / sıralama içindir.
--   3. Konum vermeyen kullanıcı yine kendi bölgesindeki adayları görür;
--      mesafe etiketi çıkmaz (distance_bucket null).
--   4. Ham koordinat karşı tarafa gitmez — yalnızca bölge + varsa kova.
--   5. `other` (bekleme listesi) ve boş bölge keşfedilebilir değildir.

create function shares_discover_region(p_viewer_id uuid, p_other_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from profiles viewer
    join profiles other on other.id = p_other_id
    join regions r on r.slug = viewer.region_slug
    where viewer.id = p_viewer_id
      and viewer.region_slug is not null
      and other.region_slug is not null
      and viewer.region_slug = other.region_slug
      and r.is_pilot
      and r.is_active
  );
$$;

revoke all on function shares_discover_region(uuid, uuid)
  from public, anon, authenticated;

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
  v_lon_pad := v_prefs.max_distance_km
    / greatest(1.0, 111.0 * cos(radians(coalesce(v_viewer.latitude, 0))));

  return query
  with candidates as (
    select
      p.*,
      prof.owner_visibility,
      prof.avatar_url,
      prof.last_active_at,
      case
        when v_viewer.latitude is null or p.latitude is null then null
        else haversine_km(
          v_viewer.latitude,
          v_viewer.longitude,
          p.latitude,
          p.longitude
        )
      end as km
    from pets p
    join profiles prof on prof.id = p.owner_id
    where p.is_active
      and p.owner_id <> v_viewer.owner_id
      and shares_discover_region(v_viewer.owner_id, p.owner_id)
      and p.species = any (v_prefs.species)
      and p.goals && v_viewer.goals
      and not exists (
        select 1
        from swipes s
        where s.from_pet_id = p_pet_id and s.to_pet_id = p.id
      )
      and p.owner_id <> all (v_blocked)
      and (
        p.birth_date is null
        or (
          (
            v_prefs.min_age_years is null
            or p.birth_date
              <= current_date - (v_prefs.min_age_years * 365.25)::integer
          )
          and (
            v_prefs.max_age_years is null
            or p.birth_date
              >= current_date - (v_prefs.max_age_years * 365.25)::integer
          )
        )
      )
      and (not v_me.require_visible_owner or prof.owner_visibility <> 'hidden')
      and (
        not prof.require_visible_owner
        or v_me.owner_visibility <> 'hidden'
      )
      and (
        not v_prefs.require_owner_photo
        or (prof.avatar_url is not null and prof.owner_visibility <> 'hidden')
      )
      and (
        p_owner_genders is null
        or (
          prof.gender = any (p_owner_genders)
          and prof.owner_visibility <> 'hidden'
        )
      )
      and (
        p_owner_min_age is null
        or (
          prof.birth_date is not null
          and prof.birth_date
            <= current_date - (p_owner_min_age || ' years')::interval
        )
      )
      and (
        p_owner_max_age is null
        or (
          prof.birth_date is not null
          and prof.birth_date
            >= current_date - ((p_owner_max_age + 1) || ' years')::interval
        )
      )
      and (
        v_viewer.latitude is null
        or p.latitude is null
        or (
          p.latitude
            between v_viewer.latitude - v_lat_pad
            and v_viewer.latitude + v_lat_pad
          and p.longitude
            between v_viewer.longitude - v_lon_pad
            and v_viewer.longitude + v_lon_pad
          and haversine_km(
            v_viewer.latitude,
            v_viewer.longitude,
            p.latitude,
            p.longitude
          ) <= v_prefs.max_distance_km
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
    c.goals,
    c.bio,
    c.city,
    coalesce(
      (
        select array_agg(ph.storage_path order by ph.position)
        from pet_photos ph
        where ph.pet_id = c.id
      ),
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

create or replace function swipe_pet(
  p_from_pet_id uuid,
  p_to_pet_id   uuid,
  p_direction   swipe_direction,
  p_is_super    boolean default false
)
returns table (match_id uuid, swipe_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from         pets%rowtype;
  v_to           pets%rowtype;
  v_me           profiles%rowtype;
  v_target_owner profiles%rowtype;
  v_prefs        discovery_preferences%rowtype;
  v_is_super     boolean := coalesce(p_is_super, false);
  v_match_id     uuid;
  v_swipe_id     uuid;
begin
  if v_is_super and p_direction <> 'like' then
    raise exception 'super like requires like direction' using errcode = '22023';
  end if;

  select * into v_from from pets where id = p_from_pet_id;
  select * into v_to   from pets where id = p_to_pet_id;

  if v_from.id is null or v_from.owner_id <> auth.uid() or not v_from.is_active then
    raise exception 'active source pet not found' using errcode = '42501';
  end if;
  if v_to.id is null or not v_to.is_active or v_to.owner_id = auth.uid() then
    raise exception 'target pet not available' using errcode = '42501';
  end if;

  select * into v_me from profiles where id = v_from.owner_id;
  select * into v_target_owner from profiles where id = v_to.owner_id;
  select * into v_prefs from discovery_preferences where user_id = v_from.owner_id;

  if not ('playdate' = any (v_from.goals))
     or not ('playdate' = any (v_to.goals))
     or v_to.species <> all (v_prefs.species)
     or is_blocked_between(v_from.owner_id, v_to.owner_id)
     or not shares_discover_region(v_from.owner_id, v_to.owner_id) then
    raise exception 'target pet not available' using errcode = '42501';
  end if;
  if v_me.require_visible_owner
     and v_target_owner.owner_visibility = 'hidden' then
    raise exception 'target pet not available' using errcode = '42501';
  end if;
  if v_target_owner.require_visible_owner
     and v_me.owner_visibility = 'hidden' then
    raise exception 'target pet not available' using errcode = '42501';
  end if;
  if v_prefs.require_owner_photo and (
    v_target_owner.avatar_url is null
    or v_target_owner.owner_visibility <> 'public'
  ) then
    raise exception 'target pet not available' using errcode = '42501';
  end if;
  if v_prefs.require_owner_social and not v_target_owner.owner_social_open then
    raise exception 'target pet not available' using errcode = '42501';
  end if;
  if v_prefs.require_verified_owner
     and v_target_owner.verification_status is distinct from 'approved' then
    raise exception 'target pet not available' using errcode = '42501';
  end if;
  if v_to.birth_date is not null and (
    (
      v_prefs.min_age_years is not null
      and v_to.birth_date > current_date - (v_prefs.min_age_years * 365.25)::integer
    )
    or (
      v_prefs.max_age_years is not null
      and v_to.birth_date < current_date - (v_prefs.max_age_years * 365.25)::integer
    )
  ) then
    raise exception 'target pet not available' using errcode = '42501';
  end if;
  if v_from.latitude is not null
     and v_to.latitude is not null
     and haversine_km(
       v_from.latitude, v_from.longitude, v_to.latitude, v_to.longitude
     ) > v_prefs.max_distance_km then
    raise exception 'target pet not available' using errcode = '42501';
  end if;

  insert into swipes (from_pet_id, to_pet_id, actor_id, direction, is_super)
  values (p_from_pet_id, p_to_pet_id, auth.uid(), p_direction, v_is_super)
  returning id into v_swipe_id;

  select m.id into v_match_id
  from matches m
  where m.pet_a_id = least(p_from_pet_id, p_to_pet_id)
    and m.pet_b_id = greatest(p_from_pet_id, p_to_pet_id)
    and m.is_active;

  return query select v_match_id, v_swipe_id;
end;
$$;

revoke all on function swipe_pet(uuid, uuid, swipe_direction, boolean)
  from public, anon, authenticated;
grant execute on function swipe_pet(uuid, uuid, swipe_direction, boolean)
  to authenticated;

create or replace function pending_likes_count()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_my_pet_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select id into v_my_pet_id from pets where owner_id = auth.uid() and is_active;
  if v_my_pet_id is null then
    return 0;
  end if;

  return (
    select count(*)::integer
    from swipes s
    join pets fp on fp.id = s.from_pet_id
    where s.to_pet_id = v_my_pet_id
      and s.direction = 'like'
      and fp.is_active
      and shares_discover_region(auth.uid(), fp.owner_id)
      and not is_blocked_between(auth.uid(), fp.owner_id)
      and not exists (
        select 1 from swipes back
        where back.from_pet_id = v_my_pet_id and back.to_pet_id = s.from_pet_id
      )
  );
end;
$$;

revoke all on function pending_likes_count() from public, anon, authenticated;
grant execute on function pending_likes_count() to authenticated;

create or replace function pending_likes(p_limit integer default 50)
returns table (
  id                   uuid,
  owner_id             uuid,
  name                 text,
  species              species,
  breed                text,
  birth_date           date,
  gender               pet_gender,
  is_neutered          boolean,
  size                 pet_size,
  energy_level         smallint,
  temperaments         text[],
  good_with_cats       boolean,
  good_with_dogs       boolean,
  good_with_kids       boolean,
  goals                match_goal[],
  bio                  text,
  city                 text,
  photo_paths          text[],
  distance_bucket      text,
  activity_bucket      text,
  owner_profile_shown  boolean,
  owner_display_name   text,
  owner_avatar_path    text,
  owner_bio            text,
  owner_gender         text,
  owner_age_bucket     text,
  owner_social_open    boolean,
  owner_verified       boolean,
  owner_interests      text[],
  is_super             boolean,
  liked_at             timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me       profiles%rowtype;
  v_my_pet   pets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_me from profiles where profiles.id = auth.uid();
  select * into v_my_pet from pets where pets.owner_id = auth.uid() and pets.is_active;
  if v_my_pet.id is null then
    return;
  end if;

  return query
  select
    fp.id, fp.owner_id, fp.name, fp.species, fp.breed, fp.birth_date, fp.gender,
    fp.is_neutered, fp.size, fp.energy_level, fp.temperaments,
    fp.good_with_cats, fp.good_with_dogs, fp.good_with_kids, fp.goals, fp.bio,
    fp.city,
    coalesce(
      (
        select array_agg(ph.storage_path order by ph.position)
        from pet_photos ph
        where ph.pet_id = fp.id
      ),
      '{}'
    ),
    distance_bucket(
      case
        when v_my_pet.latitude is null or fp.latitude is null then null
        else haversine_km(v_my_pet.latitude, v_my_pet.longitude, fp.latitude, fp.longitude)
      end
    ),
    activity_bucket(prof.last_active_at),
    (prof.owner_visibility = 'public'),
    case when prof.owner_visibility = 'public' then prof.display_name end,
    case when prof.owner_visibility = 'public' then prof.avatar_url end,
    case when prof.owner_visibility = 'public' then prof.bio end,
    case
      when prof.owner_visibility = 'public'
       and v_me.owner_visibility = 'public'
       and v_me.gender is not null
      then prof.gender
    end,
    case
      when prof.owner_visibility = 'public'
       and v_me.owner_visibility = 'public'
       and v_me.birth_date is not null
       and prof.birth_date is not null
      then owner_age_bucket(prof.birth_date)
    end,
    case when prof.owner_visibility = 'public' then prof.owner_social_open else false end,
    case
      when prof.owner_visibility = 'public'
      then prof.verification_status = 'approved'
      else false
    end,
    case when prof.owner_visibility = 'public' then prof.interests else '{}'::text[] end,
    s.is_super,
    s.created_at
  from swipes s
  join pets fp on fp.id = s.from_pet_id
  join profiles prof on prof.id = fp.owner_id
  where s.to_pet_id = v_my_pet.id
    and s.direction = 'like'
    and fp.is_active
    and shares_discover_region(auth.uid(), fp.owner_id)
    and not is_blocked_between(auth.uid(), fp.owner_id)
    and not exists (
      select 1 from swipes back
      where back.from_pet_id = v_my_pet.id and back.to_pet_id = s.from_pet_id
    )
  order by s.is_super desc, s.created_at desc
  limit least(coalesce(p_limit, 50), 100);
end;
$$;

revoke all on function pending_likes(integer) from public, anon, authenticated;
grant execute on function pending_likes(integer) to authenticated;
