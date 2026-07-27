-- Swipe RPC'si istemcinin gönderdiği hedefe güvenmez.
--
-- UI yalnızca discover_playdate_pets sonucuna swipe atsa da RPC doğrudan
-- çağrılabilir. Tür/yaş/mesafe ve çift yönlü görünürlük gibi kalıcı Keşfet
-- kuralları yazma anında yeniden doğrulanır.

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

  if v_from.id is null
     or v_from.owner_id <> auth.uid()
     or not v_from.is_active then
    raise exception 'active source pet not found' using errcode = '42501';
  end if;

  if v_to.id is null
     or not v_to.is_active
     or v_to.owner_id = auth.uid() then
    raise exception 'target pet not available' using errcode = '42501';
  end if;

  select * into v_me from profiles where id = v_from.owner_id;
  select * into v_target_owner from profiles where id = v_to.owner_id;
  select * into v_prefs
  from discovery_preferences
  where user_id = v_from.owner_id;

  if not ('playdate' = any (v_from.goals))
     or not ('playdate' = any (v_to.goals))
     or v_to.species <> all (v_prefs.species) then
    raise exception 'target pet not available' using errcode = '42501';
  end if;

  if is_blocked_between(v_from.owner_id, v_to.owner_id) then
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

  if v_prefs.require_owner_photo
     and (
       v_target_owner.avatar_url is null
       or v_target_owner.owner_visibility = 'hidden'
     ) then
    raise exception 'target pet not available' using errcode = '42501';
  end if;

  if v_to.birth_date is not null and (
    (
      v_prefs.min_age_years is not null
      and v_to.birth_date
        > current_date - (v_prefs.min_age_years * 365.25)::integer
    )
    or (
      v_prefs.max_age_years is not null
      and v_to.birth_date
        < current_date - (v_prefs.max_age_years * 365.25)::integer
    )
  ) then
    raise exception 'target pet not available' using errcode = '42501';
  end if;

  if v_from.latitude is not null
     and v_to.latitude is not null
     and haversine_km(
       v_from.latitude,
       v_from.longitude,
       v_to.latitude,
       v_to.longitude
     ) > v_prefs.max_distance_km then
    raise exception 'target pet not available' using errcode = '42501';
  end if;

  insert into swipes (
    from_pet_id,
    to_pet_id,
    actor_id,
    direction
  )
  values (
    p_from_pet_id,
    p_to_pet_id,
    auth.uid(),
    p_direction
  );

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

-- Viewer hem playdate hem adoption amaçlıysa adoption-only satırlar ilk
-- p_limit'i tüketmesin. İç RPC'nin güvenlik üst sınırı 100; dış limit kullanıcının
-- istediği deste boyutunu korur.
create or replace function discover_playdate_pets(
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

  return query
  select d.*
  from discover_pets(
    p_pet_id,
    p_owner_genders,
    p_owner_min_age,
    p_owner_max_age,
    100
  ) d
  where 'playdate' = any (d.goals)
  limit least(coalesce(p_limit, 50), 100);
end;
$$;

revoke all on function discover_playdate_pets(uuid, text[], integer, integer, integer)
  from public, anon, authenticated;
grant execute on function discover_playdate_pets(uuid, text[], integer, integer, integer)
  to authenticated;
