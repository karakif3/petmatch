-- RETURNS TABLE çıktı değişkenleri (`id`, `user_id`) tablo kolonlarıyla aynı
-- isimde olduğunda PL/pgSQL bunları belirsiz görür. Tüm kolonlar alias'lanır.

create or replace function discover_playdate_pets(
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

  select p.* into v_me
  from profiles p
  where p.id = auth.uid();

  select dp.* into v_prefs
  from discovery_preferences dp
  where dp.user_id = auth.uid();

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
      then owner_age_bucket(prof.birth_date)
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

create or replace function get_conversation_owner_profile(p_conversation_id uuid)
returns table (
  user_id       uuid,
  display_name  text,
  avatar_path   text,
  bio           text,
  gender        text,
  age_bucket    text,
  social_open   boolean,
  verified      boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me profiles%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1
    from conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = auth.uid()
  ) then
    raise exception 'not a participant of conversation' using errcode = '42501';
  end if;

  select p.* into v_me
  from profiles p
  where p.id = auth.uid();

  return query
  select
    other_profile.id,
    other_profile.display_name,
    other_profile.avatar_url,
    other_profile.bio,
    case
      when v_me.owner_visibility <> 'hidden' and v_me.gender is not null
      then other_profile.gender
    end,
    case
      when v_me.owner_visibility <> 'hidden' and v_me.birth_date is not null
      then owner_age_bucket(other_profile.birth_date)
    end,
    other_profile.owner_social_open,
    other_profile.verification_status = 'approved'
  from conversations c
  join conversation_participants mine
    on mine.conversation_id = c.id and mine.user_id = auth.uid()
  join conversation_participants other
    on other.conversation_id = c.id and other.user_id <> auth.uid()
  join profiles other_profile on other_profile.id = other.user_id
  where c.id = p_conversation_id
    and (
      other_profile.owner_visibility = 'public'
      or (other_profile.owner_visibility = 'after_match' and c.is_active)
    )
  limit 1;
end;
$$;

revoke all on function get_conversation_owner_profile(uuid)
  from public, anon, authenticated;
grant execute on function get_conversation_owner_profile(uuid) to authenticated;
