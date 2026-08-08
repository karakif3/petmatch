-- Süper beğeni: experience-roadmap.md §6b — enum'a değer eklemek yerine
-- ayrı `is_super` kolonu (PostgreSQL'de `alter type ... add value` bazı
-- akışlarda transaction içinde çalışmıyor; ayrı kolon migration riskini
-- sıfırlıyor). Sadece 'like' üstüne süper olunabilir, 'pass' olamaz.
--
-- Faz 0: ödeme altyapısı yok, süper beğeni sınırsız — swipe limiti için
-- zaten benimsenen "önce ölç, kıtlığı sonra ekle" duruşuyla aynı çizgide.

alter table swipes add column if not exists is_super boolean not null default false;

alter table swipes
  add constraint swipes_super_requires_like check (not is_super or direction = 'like');

drop function if exists swipe_pet(uuid, uuid, swipe_direction);

create or replace function swipe_pet(
  p_from_pet_id uuid,
  p_to_pet_id   uuid,
  p_direction   swipe_direction,
  p_is_super    boolean default false
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
  v_is_super     boolean := coalesce(p_is_super, false);
  v_match_id     uuid;
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

  insert into swipes (from_pet_id, to_pet_id, actor_id, direction, is_super)
  values (p_from_pet_id, p_to_pet_id, auth.uid(), p_direction, v_is_super);

  select m.id into v_match_id
  from matches m
  where m.pet_a_id = least(p_from_pet_id, p_to_pet_id)
    and m.pet_b_id = greatest(p_from_pet_id, p_to_pet_id)
    and m.is_active;

  return v_match_id;
end;
$$;

revoke all on function swipe_pet(uuid, uuid, swipe_direction, boolean)
  from public, anon, authenticated;
grant execute on function swipe_pet(uuid, uuid, swipe_direction, boolean)
  to authenticated;

-- Beğeniler listesinde süper beğeniler öne çıksın (§6b: "karşı tarafın
-- destesinde öne çıkarsın" — deste zaten swipe edilmiş çiftleri göstermiyor,
-- bu yüzden "öne çıkma" pratikte Beğeniler sırası demek). is_super kilitli
-- kartta bile görünür — bu bir kimlik değil, sadece "bu beğeni özel" sinyali.
drop function if exists pending_likes(integer);

create or replace function pending_likes(p_limit integer default 50)
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
  owner_verified      boolean,
  is_super            boolean,
  liked_at            timestamptz
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
    (prof.owner_visibility <> 'hidden'),
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

-- Bulgu: `product_events.event_name` kısıtı 0027'den beri hiç genişletilmemiş.
-- `core/api/observability.ts`'teki ProductEventName birçok tur önce büyüdü
-- (meetup_*, discovery_segment_changed, adoption_*) ama bu olaylar sessizce
-- REDDEDİLİYORDU — `track_product_event` hatayı yutup `console.warn`'a
-- düşürüyor, kullanıcı hiç görmüyor. Aynı "hata yutma" ailesinden ama bu
-- kez veritabanı seviyesinde. `swipe_super_like` eklerken hepsini kapatıyoruz.
alter table product_events drop constraint product_events_event_name_check;
alter table product_events add constraint product_events_event_name_check check (
  event_name in (
    'onboarding_completed',
    'discovery_viewed',
    'swipe_like',
    'swipe_pass',
    'swipe_super_like',
    'match_created',
    'message_sent',
    'report_submitted',
    'verification_submitted',
    'meetup_proposed',
    'meetup_accepted',
    'meetup_declined',
    'meetup_cancelled',
    'meetup_feedback',
    'discovery_segment_changed',
    'adoption_surface_viewed',
    'adoption_interest_sent',
    'account_delete_requested'
  )
);
