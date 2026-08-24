-- Süper beğeni push bildirimi
--
-- 0044 bilerek kapsam dışı bırakmıştı: süper beğeni gönderildiğinde alıcıya
-- anlık push gitmiyordu. Önce 0044'teki "kısıt güncellenmedi, olaylar
-- sessizce reddediliyor" hatasının (product_events) burada da olup olmadığı
-- doğrulandı — `notification_deliveries_event_type_check` 0029'da zaten
-- 'match'/'message'/'new_candidate' ile güncel; aynı hata burada YOK. Yeni
-- 'super_like' değeri normal bir genişletme.
--
-- Eşleşme olmadan (tek taraflı süper beğeni) bildirim göndermek için
-- istemcinin bir olay kimliğine ihtiyacı var — `swipe_pet` şimdiye kadar
-- yalnızca eşleşme id'sini (varsa) döndürüyordu. Artık satırın kendi id'sini
-- de döndürüyor.

alter table notification_deliveries
  drop constraint notification_deliveries_event_type_check;
alter table notification_deliveries
  add constraint notification_deliveries_event_type_check
  check (event_type in ('match', 'message', 'new_candidate', 'super_like'));

drop function if exists swipe_pet(uuid, uuid, swipe_direction, boolean);

create function swipe_pet(
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
