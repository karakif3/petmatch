-- Gösterim tek yönlü, filtre karşılıklı
--
-- Public sahibin yaş kovası ve cinsiyeti, izleyici gizli / eşleşince olsa
-- da kartta ve sohbette çıkar. Filtrelemek hâlâ kendi public + dolu alan
-- ister (`0064` guard'ları duruyor).
--
-- Neden: ad/foto/bio zaten public izleyiciye çıkıyordu; yaş aralığını
-- saklamak paylaşanı değil izleyiciyi cezalandırıyordu. Kesin yaş hâlâ
-- `owner_age_bucket()` — 18–24 / 25–29 / 30'lu yaşlar.

create or replace function discover_playdate_pets(
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
  -- Bu kart daha önce geçilmişti ve deste tükendiği için geri geldi (`0060`).
  previously_passed    boolean,
  -- Bu satırda sahip alanları gerçekten dolu mu (yalnızca `public`).
  owner_profile_shown  boolean,
  owner_display_name   text,
  owner_avatar_path    text,
  owner_bio            text,
  owner_gender         text,
  owner_age_bucket     text,
  owner_social_open    boolean,
  owner_verified       boolean,
  owner_interests      text[]
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
  v_seed    text;
begin
  select p.* into v_viewer
  from pets p
  where p.id = p_pet_id
    and p.owner_id = auth.uid()
    and p.is_active
    and 'playdate' = any (p.goals);

  if v_viewer.id is null then
    raise exception 'an active playdate pet is required' using errcode = '42501';
  end if;

  select p.* into v_me
  from profiles p
  where p.id = auth.uid();

  select dp.* into v_prefs
  from discovery_preferences dp
  where dp.user_id = auth.uid();

  -- Karşılıklı açıklama: kendi sahip profilini açmadan karşı tarafınkine
  -- göre filtre kuramazsın (`0021`).
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

  v_blocked := blocked_user_ids();

  v_lat_pad := v_prefs.max_distance_km / 111.0;
  v_lon_pad := v_prefs.max_distance_km
    / greatest(1.0, 111.0 * cos(radians(coalesce(v_viewer.latitude, 0))));

  -- Kullanıcıya ve saate bağlı karıştırma tohumu: aynı saat içinde kararlı,
  -- saat başı dönüşümlü.
  v_seed := auth.uid()::text || date_trunc('hour', now())::text;

  return query
  with candidates as (
    select
      p.*,
      prof.owner_visibility,
      prof.avatar_url,
      prof.last_active_at,
      prof.display_name        as prof_display_name,
      prof.bio                 as prof_bio,
      prof.gender              as prof_gender,
      prof.birth_date          as prof_birth_date,
      prof.owner_social_open   as prof_social_open,
      prof.verification_status as prof_verification_status,
      prof.interests           as prof_interests,
      -- Satır ancak bayatlamış bir pass'se buraya kadar gelebiliyor (`0060`).
      (sw.id is not null)      as was_passed,
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
    left join swipes sw
      on sw.from_pet_id = p_pet_id
     and sw.to_pet_id = p.id
    where p.is_active
      and p.owner_id <> v_viewer.owner_id
      -- Seçilen bölge = arama havuzu (`0057`).
      and shares_discover_region(v_viewer.owner_id, p.owner_id)
      -- Bu yüzey yalnızca playdate; sahiplendirme ayrı yüzeyde (`0008`).
      and 'playdate' = any (p.goals)
      and p.species = any (v_prefs.species)
      and p.gender = any (v_prefs.pet_genders)
      -- Hiç değerlendirilmemiş ya da bayatlamış bir "geç" (`0060`).
      and (
        sw.id is null
        or (
          sw.direction = 'pass'
          and sw.created_at <= passed_recirculation_cutoff()
        )
      )
      and p.owner_id <> all (v_blocked)
      -- Pet yaş filtresi
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
      -- Sahip görünürlüğü zorunluluğu — çift yönlü, tek kaynaktan.
      and (not v_me.require_visible_owner or prof.owner_visibility <> 'hidden')
      and (
        not prof.require_visible_owner
        or v_me.owner_visibility <> 'hidden'
      )
      -- Sahip katmanı filtreleri: hepsi `public` kapısından geçer (`0059`).
      and (
        not v_prefs.require_owner_photo
        or (prof.avatar_url is not null and prof.owner_visibility = 'public')
      )
      and (
        not v_prefs.require_owner_social
        or (prof.owner_social_open and prof.owner_visibility = 'public')
      )
      and (
        not v_prefs.require_verified_owner
        or (
          prof.verification_status = 'approved'
          and prof.owner_visibility = 'public'
        )
      )
      and (
        p_owner_genders is null
        or (
          prof.owner_visibility = 'public'
          and prof.gender = any (p_owner_genders)
        )
      )
      and (
        p_owner_min_age is null
        or (
          prof.owner_visibility = 'public'
          and prof.birth_date is not null
          and prof.birth_date
            <= current_date - (p_owner_min_age || ' years')::interval
        )
      )
      and (
        p_owner_max_age is null
        or (
          prof.owner_visibility = 'public'
          and prof.birth_date is not null
          and prof.birth_date
            >= current_date - ((p_owner_max_age + 1) || ' years')::interval
        )
      )
      -- Mesafe artık YALNIZCA kullanıcı açıkça istediyse eliyor. Kapalıyken
      -- bölgedeki herkes destede kalır; mesafe sıralamaya etki eder.
      and (
        not v_prefs.distance_filter_enabled
        or v_viewer.latitude is null
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
    c.was_passed,
    (c.owner_visibility = 'public'),
    case when c.owner_visibility = 'public' then c.prof_display_name end,
    case when c.owner_visibility = 'public' then c.avatar_url end,
    case when c.owner_visibility = 'public' then c.prof_bio end,
    case
      when c.owner_visibility = 'public'
      then c.prof_gender
    end,
    case
      when c.owner_visibility = 'public'
       and c.prof_birth_date is not null
      then owner_age_bucket(c.prof_birth_date)
    end,
    case when c.owner_visibility = 'public' then c.prof_social_open else false end,
    case
      when c.owner_visibility = 'public'
      then c.prof_verification_status = 'approved'
      else false
    end,
    case when c.owner_visibility = 'public' then c.prof_interests else '{}'::text[] end
  from candidates c
  -- Yeniden dolaşım YALNIZCA taze aday hiç kalmadığında (`0060`).
  where not c.was_passed
     or not exists (select 1 from candidates fresh where not fresh.was_passed)
  order by
    array_position(
      array['<1', '1-3', '3-5', '5-10', '10-25', '25+'],
      distance_bucket(c.km)
    ) nulls last,
    array_position(
      array['today', 'this_week', 'this_month', 'older'],
      activity_bucket(c.last_active_at)
    ) nulls last,
    md5(c.id::text || v_seed)
  limit least(coalesce(p_limit, 50), 100);
end;
$$;

revoke all on function discover_playdate_pets(uuid, text[], integer, integer, integer)
  from public, anon, authenticated;
grant execute on function discover_playdate_pets(uuid, text[], integer, integer, integer)
  to authenticated;

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
  v_my_pet   pets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

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
      then prof.gender
    end,
    case
      when prof.owner_visibility = 'public'
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

drop function if exists get_conversation_owner_profile(uuid);

create function get_conversation_owner_profile(p_conversation_id uuid)
returns table (
  user_id         uuid,
  display_name    text,
  avatar_path     text,
  bio             text,
  gender          text,
  age_bucket      text,
  social_open     boolean,
  verified        boolean,
  activity_bucket text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = auth.uid()
  ) then
    raise exception 'not a participant of conversation' using errcode = '42501';
  end if;

  return query
  select
    other_profile.id,
    other_profile.display_name,
    other_profile.avatar_url,
    other_profile.bio,
    other_profile.gender,
    owner_age_bucket(other_profile.birth_date),
    other_profile.owner_social_open,
    other_profile.verification_status = 'approved',
    activity_bucket(other_profile.last_active_at)
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
