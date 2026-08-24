-- Tükenmiş desteye dönüş yolu: geçilen petlerin yeniden dolaşımı
--
-- `0057` arama havuzunu bölgeye kilitledi — doğru karar, ama bir yan etkisi
-- var: havuz artık sonlu ve küçük. `swipes` tablosunda TTL yok, yani "geç"
-- kalıcı. Kadıköy'de 60 aday varsa kullanıcı bir seansta hepsini tüketip
-- KALICI boş desteye düşüyor. Boş deste ekranındaki birincil eylem
-- ("Yarıçapı genişlet") de bunu çözmüyor: yarıçap bölge sınırını aşamaz,
-- 25 km ile 100 km aynı havuzu verir.
--
-- Karar: **taze arz varken kimse tekrar gösterilmez; deste boşalınca
-- geçilenler geri gelir.** Blanket TTL (herkesi 30 günde bir tekrar göster)
-- yoğun bölgede taze adayın önünü keserdi; tükenmeye bağlı dolaşım yalnızca
-- gerçekten çıkmazda olan kullanıcıyı kurtarır.
--
-- 7 günlük kapı sonsuz döngüyü engelliyor: hepsini geçen kullanıcı aynı
-- oturumda aynı destede dönüp durmuyor, bir hafta bekliyor.
--
-- ---------------------------------------------------------------------------
-- Yazma yolundaki tuzak
--
-- `swipes` üzerinde `unique (from_pet_id, to_pet_id)` var. Yeniden gösterilen
-- bir peti kullanıcı tekrar değerlendirince o satır güncellenmeli — ama
-- UPDATE ile DEĞİL: eşleşmeyi `on_swipe_created` trigger'ı doğuruyor ve o
-- yalnızca INSERT'te ateşleniyor. Eski satırın üzerine UPDATE yazsaydık
-- yeniden dolaşımdan gelen bir "beğen" sessizce eşleşme üretmezdi.
--
-- Bu yüzden `swipe_pet` önce **bayatlamış pass satırını siler**, sonra normal
-- INSERT yolundan gider. Taze bir pass ya da herhangi bir like varsa silme
-- hiçbir satıra dokunmaz ve unique kısıt eskisi gibi korur.
-- ---------------------------------------------------------------------------

-- Kural tek yerde: hem okuma (keşfet) hem yazma (swipe_pet) yolu bunu okur.
create or replace function passed_recirculation_cutoff()
returns timestamptz
language sql
stable
as $$
  select now() - interval '7 days';
$$;

revoke all on function passed_recirculation_cutoff()
  from public, anon, authenticated;

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
  -- Bu kart daha önce geçilmişti ve deste tükendiği için geri geldi.
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
      -- Satır ancak bayatlamış bir pass'se buraya kadar gelebiliyor.
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
      -- Hiç değerlendirilmemiş ya da bayatlamış bir "geç". Beğeniler kalıcı:
      -- beğendiğin biri hiçbir koşulda desteye geri dönmez.
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
      -- Mesafe: bölge içinde, önce bounding box sonra haversine. Konumu
      -- olmayan taraf bölge havuzunda kalır, mesafe etiketi almaz (`0057`).
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
    c.was_passed,
    (c.owner_visibility = 'public'),
    case when c.owner_visibility = 'public' then c.prof_display_name end,
    case when c.owner_visibility = 'public' then c.avatar_url end,
    case when c.owner_visibility = 'public' then c.prof_bio end,
    case
      when c.owner_visibility = 'public'
       and v_me.owner_visibility = 'public'
       and v_me.gender is not null
      then c.prof_gender
    end,
    case
      when c.owner_visibility = 'public'
       and v_me.owner_visibility = 'public'
       and v_me.birth_date is not null
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
  -- Yeniden dolaşım YALNIZCA taze aday hiç kalmadığında. Tek bir taze kart
  -- varsa deste tazedir; kullanıcı aynı profilleri boşuna tekrar görmez.
  where not c.was_passed
     or not exists (select 1 from candidates fresh where not fresh.was_passed)
  order by c.km asc nulls last
  limit least(coalesce(p_limit, 50), 100);
end;
$$;

revoke all on function discover_playdate_pets(uuid, text[], integer, integer, integer)
  from public, anon, authenticated;
grant execute on function discover_playdate_pets(uuid, text[], integer, integer, integer)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Yazma yolu: bayatlamış pass silinir, insert normal yolundan gider.
--
-- Ayrıca sahip filtresi kontrolleri `0059`'daki `public` kapısına hizalandı.
-- Keşfet daha sıkı, swipe daha gevşek kalsaydı görünmeyen bir pet teorik
-- olarak swipe edilebilir kalırdı; iki yüzeyin aynı kuralı söylemesi bu
-- deponun kuralı.
-- ---------------------------------------------------------------------------

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
  if v_prefs.require_owner_social and (
    not v_target_owner.owner_social_open
    or v_target_owner.owner_visibility <> 'public'
  ) then
    raise exception 'target pet not available' using errcode = '42501';
  end if;
  if v_prefs.require_verified_owner and (
    v_target_owner.verification_status is distinct from 'approved'
    or v_target_owner.owner_visibility <> 'public'
  ) then
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

  -- Yeniden dolaşımdan gelen kart. Yalnızca bayatlamış bir "geç" silinir;
  -- taze pass ve her türlü like dokunulmadan kalır, unique kısıt onları
  -- eskisi gibi korur. UPDATE yerine DELETE+INSERT olmasının sebebi
  -- `on_swipe_created`: eşleşme yalnızca INSERT'te doğuyor.
  delete from swipes
  where from_pet_id = p_from_pet_id
    and to_pet_id = p_to_pet_id
    and direction = 'pass'
    and created_at <= passed_recirculation_cutoff();

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
