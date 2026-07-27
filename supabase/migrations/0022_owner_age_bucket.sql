-- Kesin sahip yaşı istemciye çıkmaz. 18–19 yaş için "10'lu yaşlar" gibi
-- yanıltıcı bir etiket üretmemek adına genç yetişkin aralıkları ayrıdır.

create or replace function owner_age_bucket(p_birth_date date)
returns text
language sql
stable
set search_path = public
as $$
  select case
    when p_birth_date is null then null
    when extract(year from age(current_date, p_birth_date)) between 18 and 24
      then '18–24 yaş'
    when extract(year from age(current_date, p_birth_date)) between 25 and 29
      then '25–29 yaş'
    else
      (floor(extract(year from age(current_date, p_birth_date)) / 10) * 10)::integer
      || '''lu yaşlar'
  end;
$$;

revoke all on function owner_age_bucket(date) from public, anon;
grant execute on function owner_age_bucket(date) to authenticated;

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
