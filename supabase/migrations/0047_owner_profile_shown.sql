-- `owner_visible` yanıltıcı: "gizli değil" ile "görünür" aynı şey değil.
--
-- `discover_playdate_pets` ve `pending_likes`, sahip görünürlüğü
-- `after_match` olan kullanıcılar için `owner_visible = true` döndürüyordu
-- (visibility yalnızca 'hidden' değil demek) ama aynı satırda
-- `owner_display_name`/`owner_avatar_path`/`owner_bio` hep boştu — bu iki
-- yüzeyde sahip profili yalnızca `owner_visibility = 'public'` iken
-- gösteriliyor, `after_match` burada hiç kullanılmıyor (o yalnızca eşleşme
-- sonrası `get_conversation_owner_profile`'da devreye giriyor).
--
-- İstemci bunu `ownerSummary()`'de boş alan kontrolüyle telafi ediyordu.
-- Sunucu artık gerçeği söylüyor: `owner_profile_shown` = bu satırda sahip
-- alanları GERÇEKTEN dolu mu. Davranış değişmiyor (fiili sonuç zaten aynıydı,
-- bkz. boş alan telafisi) — yalnızca isim ve tek kaynak doğruluğu düzeliyor.

drop function if exists discover_playdate_pets(uuid, text[], integer, integer, integer);

create function discover_playdate_pets(
  p_pet_id          uuid,
  p_owner_genders   text[] default null,
  p_owner_min_age   integer default null,
  p_owner_max_age   integer default null,
  p_limit           integer default 50
)
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
  -- Bu satırda sahip alanları gerçekten dolu mu (yalnızca `public`).
  owner_profile_shown  boolean,
  owner_display_name   text,
  owner_avatar_path    text,
  owner_bio            text,
  owner_gender         text,
  owner_age_bucket     text,
  owner_social_open    boolean,
  owner_verified       boolean
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
    d.activity_bucket,
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

drop function if exists pending_likes(integer);

create function pending_likes(p_limit integer default 50)
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
    s.is_super,
    s.created_at
  from swipes s
  join pets fp on fp.id = s.from_pet_id
  join profiles prof on prof.id = fp.owner_id
  where s.to_pet_id = v_my_pet.id
    and s.direction = 'like'
    and fp.is_active
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
