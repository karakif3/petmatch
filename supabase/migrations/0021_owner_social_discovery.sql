-- Sahip profili, pet buluşmasında sosyalleşme modu ve karşılıklı açıklama.
--
-- Ürün dili bilinçli olarak insan "dating" niyeti kurmaz. Kullanıcı yalnızca
-- pet buluşmasında kendisinin de sosyalleşmeye açık olduğunu belirtebilir.
-- Bu mod, adı ve yüzü görünmeyen bir kişi tarafından etkinleştirilemez.

-- ---------------------------------------------------------------------------
-- 1. Profil ve filtre alanları
-- ---------------------------------------------------------------------------

alter table profiles
  add column owner_social_open boolean not null default false;

alter table discovery_preferences
  add column require_owner_social boolean not null default false,
  add column require_verified_owner boolean not null default false;

-- Cinsiyet saklanabilir ama görünürlük kapalıyken keşfete çıkmaz. Önceki
-- constraint kullanıcının profilini gizlemek için cinsiyetini silmesini
-- gerektiriyordu; karşılıklı açıklama RPC'de uygulanır.
alter table profiles
  drop constraint if exists profiles_disclosed_owner_visible;

alter table profiles
  add constraint profiles_avatar_owned_path check (
    avatar_url is null or avatar_url like id::text || '/%'
  ),
  add constraint profiles_owner_social_prerequisites check (
    not owner_social_open
    or (
      owner_visibility = 'public'
      and avatar_url is not null
      and nullif(trim(display_name), '') is not null
    )
  );

-- Avatar yolu yalnızca doğrulayan RPC üzerinden değişir.
revoke update (avatar_url) on table profiles from authenticated;

-- Filtre yazma yolları da dar RPC'lerde kalır.
revoke update on table discovery_preferences from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Private avatar okuma ve verification storage
-- ---------------------------------------------------------------------------

create policy owner_avatars_read_visible on storage.objects
  for select to authenticated
  using (
    bucket_id = 'owner-avatars'
    and exists (
      select 1
      from profiles p
      where p.id::text = (storage.foldername(name))[1]
        and not is_blocked_between(auth.uid(), p.id)
        and (
          p.id = auth.uid()
          or p.owner_visibility = 'public'
          or (
            p.owner_visibility = 'after_match'
            and shares_active_match_with(p.id)
          )
        )
    )
  );

insert into storage.buckets (id, name, public)
values ('verification-photos', 'verification-photos', false)
on conflict (id) do nothing;

create policy verification_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy verification_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'verification-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy verification_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'verification-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- 3. Sahip profilini güvenli güncelle
-- ---------------------------------------------------------------------------

create or replace function update_my_owner_details(
  p_display_name       text,
  p_bio                text,
  p_birth_date         date,
  p_gender             text,
  p_owner_visibility   owner_visibility,
  p_avatar_path        text,
  p_owner_social_open  boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name   text := nullif(trim(p_display_name), '');
  v_bio    text := nullif(trim(p_bio), '');
  v_gender text := nullif(trim(p_gender), '');
  v_avatar text := nullif(trim(p_avatar_path), '');
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_name is not null and char_length(v_name) > 60 then
    raise exception 'display name is too long' using errcode = '22023';
  end if;
  if v_bio is not null and char_length(v_bio) > 500 then
    raise exception 'bio is too long' using errcode = '22023';
  end if;
  if p_birth_date is null
     or p_birth_date > current_date - interval '18 years' then
    raise exception 'owner must be at least 18' using errcode = '22023';
  end if;
  if v_gender is not null and v_gender <> all (array['female', 'male', 'other']) then
    raise exception 'invalid gender' using errcode = '22023';
  end if;
  if v_avatar is not null
     and v_avatar not like auth.uid()::text || '/%' then
    raise exception 'invalid avatar path' using errcode = '22023';
  end if;
  if p_owner_social_open and (
    v_name is null
    or v_avatar is null
    or p_owner_visibility <> 'public'
  ) then
    raise exception 'social mode requires a public owner name and photo'
      using errcode = '23514';
  end if;

  update profiles
  set
    display_name = v_name,
    bio = v_bio,
    birth_date = p_birth_date,
    gender = v_gender,
    owner_visibility = p_owner_visibility,
    avatar_url = v_avatar,
    owner_social_open = p_owner_social_open
  where id = auth.uid();

  if not p_owner_social_open then
    update discovery_preferences
    set require_owner_social = false
    where user_id = auth.uid();
  end if;
end;
$$;

revoke all on function update_my_owner_details(
  text, text, date, text, owner_visibility, text, boolean
) from public, anon, authenticated;
grant execute on function update_my_owner_details(
  text, text, date, text, owner_visibility, text, boolean
) to authenticated;

-- Temel profil ekranı görünürlüğü public'ten kapatırsa sosyal modu da kapatır.
create or replace function update_my_profile(
  p_display_name      text,
  p_city              text,
  p_owner_visibility owner_visibility,
  p_pet_name          text,
  p_update_location   boolean,
  p_latitude          double precision,
  p_longitude         double precision
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text := nullif(trim(p_display_name), '');
  v_city         text := nullif(trim(p_city), '');
  v_pet_name     text := nullif(trim(p_pet_name), '');
  v_pet_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_display_name is not null and char_length(v_display_name) > 60 then
    raise exception 'display name is too long' using errcode = '22023';
  end if;
  if v_city is null then
    raise exception 'city is required' using errcode = '22023';
  end if;
  if v_pet_name is null or char_length(v_pet_name) > 40 then
    raise exception 'pet name must be between 1 and 40 characters' using errcode = '22023';
  end if;
  if p_update_location and (
    p_latitude is null
    or p_longitude is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180
  ) then
    raise exception 'valid coordinates are required' using errcode = '22023';
  end if;

  update profiles
  set
    display_name = v_display_name,
    city = v_city,
    owner_visibility = p_owner_visibility,
    owner_social_open = case
      when p_owner_visibility = 'public' then owner_social_open
      else false
    end
  where id = auth.uid();

  if p_owner_visibility <> 'public' then
    update discovery_preferences
    set require_owner_social = false
    where user_id = auth.uid();
  end if;

  update pets
  set
    name = v_pet_name,
    city = v_city,
    latitude = case
      when p_update_location then round(p_latitude::numeric, 2)::double precision
      else latitude
    end,
    longitude = case
      when p_update_location then round(p_longitude::numeric, 2)::double precision
      else longitude
    end
  where owner_id = auth.uid()
    and is_active
  returning id into v_pet_id;

  if v_pet_id is null then
    raise exception 'active pet not found' using errcode = 'P0002';
  end if;
  return v_pet_id;
end;
$$;

revoke all on function update_my_profile(
  text, text, owner_visibility, text, boolean, double precision, double precision
) from public, anon, authenticated;
grant execute on function update_my_profile(
  text, text, owner_visibility, text, boolean, double precision, double precision
) to authenticated;

create or replace function update_owner_discovery_filters(
  p_require_owner_photo    boolean,
  p_require_owner_social   boolean,
  p_require_verified_owner boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_require_owner_social and not exists (
    select 1
    from profiles
    where id = auth.uid() and owner_social_open
  ) then
    raise exception 'enable your owner social profile first' using errcode = '23514';
  end if;

  update discovery_preferences
  set
    require_owner_photo = p_require_owner_photo or p_require_owner_social,
    require_owner_social = p_require_owner_social,
    require_verified_owner = p_require_verified_owner
  where user_id = auth.uid();
end;
$$;

revoke all on function update_owner_discovery_filters(boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function update_owner_discovery_filters(boolean, boolean, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Sahip + pet doğrulama başvurusu
-- ---------------------------------------------------------------------------

create or replace function submit_verification(p_pet_id uuid, p_photo_path text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from pets
    where id = p_pet_id and owner_id = auth.uid() and is_active
  ) then
    raise exception 'active pet not found' using errcode = '42501';
  end if;
  if nullif(trim(p_photo_path), '') is null
     or p_photo_path not like auth.uid()::text || '/' || p_pet_id::text || '/%' then
    raise exception 'invalid verification photo path' using errcode = '22023';
  end if;
  if exists (
    select 1 from moderation_items
    where kind = 'verification'
      and created_by = auth.uid()
      and status = 'pending'
  ) then
    raise exception 'a verification request is already pending'
      using errcode = '23505';
  end if;

  insert into moderation_items (
    kind, created_by, subject_user_id, subject_pet_id, payload
  )
  values (
    'verification',
    auth.uid(),
    auth.uid(),
    p_pet_id,
    jsonb_build_object('photo_path', p_photo_path)
  )
  returning id into v_id;

  update profiles
  set verification_status = 'pending'
  where id = auth.uid();

  return v_id;
end;
$$;

revoke all on function submit_verification(uuid, text)
  from public, anon, authenticated;
grant execute on function submit_verification(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Keşfet: görünür sahip özeti + sosyal/doğrulama filtreleri
-- ---------------------------------------------------------------------------

drop function if exists discover_playdate_pets(uuid, text[], integer, integer, integer);

create function discover_playdate_pets(
  p_pet_id          uuid,
  p_owner_genders   text[] default null,
  p_owner_min_age   integer default null,
  p_owner_max_age   integer default null,
  p_limit           integer default 50
)
returns table (
  id                  uuid,
  owner_id            uuid,
  name                text,
  species             species,
  breed               text,
  birth_date          date,
  gender              pet_gender,
  is_neutered         boolean,
  size                pet_size,
  energy_level        smallint,
  temperaments        text[],
  good_with_cats      boolean,
  good_with_dogs      boolean,
  good_with_kids      boolean,
  goals               match_goal[],
  bio                 text,
  city                text,
  photo_paths         text[],
  distance_bucket     text,
  activity_bucket     text,
  owner_visible       boolean,
  owner_display_name  text,
  owner_avatar_path   text,
  owner_bio           text,
  owner_gender        text,
  owner_age_bucket    text,
  owner_social_open   boolean,
  owner_verified      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me    profiles%rowtype;
  v_prefs discovery_preferences%rowtype;
begin
  if not exists (
    select 1
    from pets p
    where p.id = p_pet_id
      and p.owner_id = auth.uid()
      and p.is_active
      and 'playdate' = any (p.goals)
  ) then
    raise exception 'an active playdate pet is required' using errcode = '42501';
  end if;

  select * into v_me from profiles where id = auth.uid();
  select * into v_prefs from discovery_preferences where user_id = auth.uid();

  if p_owner_genders is not null and (
    v_me.gender is null or v_me.owner_visibility <> 'public'
  ) then
    raise exception 'gender filter requires a public disclosed owner profile'
      using errcode = '42501';
  end if;
  if (p_owner_min_age is not null or p_owner_max_age is not null)
     and (v_me.birth_date is null or v_me.owner_visibility <> 'public') then
    raise exception 'age filter requires a public disclosed owner profile'
      using errcode = '42501';
  end if;
  if v_prefs.require_owner_social and not v_me.owner_social_open then
    raise exception 'owner social filter requires social mode'
      using errcode = '42501';
  end if;

  return query
  select
    d.id, d.owner_id, d.name, d.species, d.breed, d.birth_date, d.gender,
    d.is_neutered, d.size, d.energy_level, d.temperaments,
    d.good_with_cats, d.good_with_dogs, d.good_with_kids,
    d.goals, d.bio, d.city, d.photo_paths, d.distance_bucket,
    d.activity_bucket, d.owner_visible,
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
      then (floor(extract(year from age(current_date, prof.birth_date)) / 10) * 10)::integer
           || '''lu yaşlar'
    end,
    case when prof.owner_visibility = 'public' then prof.owner_social_open else false end,
    case
      when prof.owner_visibility = 'public'
      then prof.verification_status = 'approved'
      else false
    end
  from discover_pets(
    p_pet_id,
    p_owner_genders,
    p_owner_min_age,
    p_owner_max_age,
    100
  ) d
  join profiles prof on prof.id = d.owner_id
  where 'playdate' = any (d.goals)
    and (
      not v_prefs.require_owner_photo
      or (prof.avatar_url is not null and prof.owner_visibility = 'public')
    )
    and (not v_prefs.require_owner_social or prof.owner_social_open)
    and (
      not v_prefs.require_verified_owner
      or prof.verification_status = 'approved'
    )
  limit least(coalesce(p_limit, 50), 100);
end;
$$;

revoke all on function discover_playdate_pets(uuid, text[], integer, integer, integer)
  from public, anon, authenticated;
grant execute on function discover_playdate_pets(uuid, text[], integer, integer, integer)
  to authenticated;

-- Swipe yazma anında kalıcı sosyal/doğrulama filtreleri tekrar doğrulanır.
create or replace function swipe_pet(
  p_from_pet_id uuid,
  p_to_pet_id   uuid,
  p_direction   swipe_direction
)
returns uuid
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
  v_match_id     uuid;
begin
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
     or is_blocked_between(v_from.owner_id, v_to.owner_id) then
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

  insert into swipes (from_pet_id, to_pet_id, actor_id, direction)
  values (p_from_pet_id, p_to_pet_id, auth.uid(), p_direction);

  select m.id into v_match_id
  from matches m
  where m.pet_a_id = least(p_from_pet_id, p_to_pet_id)
    and m.pet_b_id = greatest(p_from_pet_id, p_to_pet_id)
    and m.is_active;

  return v_match_id;
end;
$$;

revoke all on function swipe_pet(uuid, uuid, swipe_direction)
  from public, anon, authenticated;
grant execute on function swipe_pet(uuid, uuid, swipe_direction)
  to authenticated;
