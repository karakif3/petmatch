-- Keşfet yüzeyi yalnızca playdate içindir ve swipe yazma yolu RPC'dir.
--
-- Sahiplendirme kendi başvuru akışına sahiptir; adoption amaçlı bir pet,
-- yalnızca bu amacı paylaştığı için sosyal eşleşme destesine girmemeli.
-- Ayrıca doğrudan swipes INSERT politikası, bilinen bir pet UUID'sine deste
-- kurallarını atlayarak beğeni gönderilmesine izin veriyordu.

-- ---------------------------------------------------------------------------
-- 1. Playdate'e özel okuma yüzeyi
-- ---------------------------------------------------------------------------

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
    p_limit
  ) d
  where 'playdate' = any (d.goals);
end;
$$;

revoke all on function discover_playdate_pets(uuid, text[], integer, integer, integer)
  from public, anon, authenticated;
grant execute on function discover_playdate_pets(uuid, text[], integer, integer, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Swipe yazma yolu
-- ---------------------------------------------------------------------------

drop policy if exists swipes_insert_own on swipes;

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
  v_from     pets%rowtype;
  v_to       pets%rowtype;
  v_match_id uuid;
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

  if not ('playdate' = any (v_from.goals))
     or not ('playdate' = any (v_to.goals)) then
    raise exception 'pet is not available for playdate' using errcode = '42501';
  end if;

  if is_blocked_between(v_from.owner_id, v_to.owner_id) then
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

  -- on_swipe_created trigger'ı karşılıklı like varsa match'i bu transaction
  -- içinde açar; istemci böylece ayrı ve yarışa açık bir sorgu yapmaz.
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
