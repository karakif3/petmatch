-- "Şimdi parktayım": eşleşme gerektirmeyen anlık buluşma.
--
-- Kullanıcı bölgesindeki doğrulanmış bir buluşma yerini ve 30–180 dk'lık bir
-- pencereyi işaretler; aynı bölgedeki uygun sahipler bunu görür ve push alır.
-- Katılmak = aynı yerde kendi check-in'ini açmak; karşılıklı beğeni yok.
-- Boş deste sorununu atlar: bölgede 5 aktif kullanıcıyla bile buluşma olur.
--
-- Gizlilik: yalnız küratörlü halka açık yer (0038/0052) — serbest konum,
-- adres ya da canlı konum yok. Pet her zaman, sahip adı yalnız `public`
-- sahipte görünür (A18). Engel iki yönde süzer. Serbest metin yok
-- (moderasyon yüzeyi açmamak için).

-- 1 -------------------------------------------------------------------------
create table park_checkins (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles (id) on delete cascade,
  pet_id      uuid not null references pets (id) on delete cascade,
  place_id    uuid not null references meetup_places (id) on delete cascade,
  region_slug text not null references regions (slug) on delete cascade,
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null,
  ended_at    timestamptz,
  created_at  timestamptz not null default now(),
  check (ends_at > starts_at and ends_at <= starts_at + interval '3 hours')
);

-- Kullanıcı başına tek açık check-in; yenisi eskisini kapatır.
create unique index park_checkins_one_open_per_user
  on park_checkins (user_id) where ended_at is null;
create index park_checkins_region_active_idx
  on park_checkins (region_slug, ends_at) where ended_at is null;

alter table park_checkins enable row level security;
revoke all on table park_checkins from anon, authenticated;
grant all on table park_checkins to service_role;

alter table discovery_preferences
  add column if not exists notify_on_park boolean not null default true;

alter table notification_deliveries
  drop constraint notification_deliveries_event_type_check;
alter table notification_deliveries
  add constraint notification_deliveries_event_type_check
  check (event_type in (
    'match', 'message', 'new_candidate', 'super_like', 'verification', 'park_checkin'
  ));

alter table product_events drop constraint product_events_event_name_check;
alter table product_events add constraint product_events_event_name_check check (
  event_name in (
    'onboarding_completed',
    'discovery_viewed',
    'swipe_like',
    'swipe_pass',
    'swipe_super_like',
    'match_created',
    'match_celebration_viewed',
    'match_chat_opened',
    'match_celebration_dismissed',
    'match_conversation_failed',
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
    'account_delete_requested',
    'park_now_viewed',
    'park_checkin_started',
    'park_checkin_ended'
  )
);

-- 2 -------------------------------------------------------------------------
create or replace function start_park_checkin(
  p_place_id         uuid,
  p_duration_minutes integer
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_region text;
  v_pet_id uuid;
  v_id     uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_duration_minutes is null or p_duration_minutes not between 30 and 180 then
    raise exception 'duration must be 30-180 minutes' using errcode = '22023';
  end if;

  select p.region_slug into v_region
  from profiles p
  join regions r on r.slug = p.region_slug and r.is_pilot and r.is_active
  where p.id = auth.uid();
  if v_region is null then
    raise exception 'park check-in requires a pilot region' using errcode = '42501';
  end if;

  if not exists (
    select 1 from meetup_places mp
    where mp.id = p_place_id
      and mp.region_slug = v_region
      and mp.is_verified
      and mp.is_active
  ) then
    raise exception 'place not available' using errcode = '42501';
  end if;

  select id into v_pet_id
  from pets
  where owner_id = auth.uid() and is_active and 'playdate' = any (goals)
  limit 1;
  if v_pet_id is null then
    raise exception 'active pet required' using errcode = '42501';
  end if;

  if (
    select count(*) from park_checkins
    where user_id = auth.uid() and created_at > now() - interval '24 hours'
  ) >= 4 then
    raise exception 'rate_limited:park_checkins' using errcode = 'P0001';
  end if;

  update park_checkins set ended_at = now()
  where user_id = auth.uid() and ended_at is null;

  insert into park_checkins (user_id, pet_id, place_id, region_slug, ends_at)
  values (
    auth.uid(), v_pet_id, p_place_id, v_region,
    now() + make_interval(mins => p_duration_minutes)
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function end_my_park_checkin()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  update park_checkins set ended_at = now()
  where user_id = (select auth.uid()) and ended_at is null;
end;
$$;

-- Bölgedeki aktif check-in'ler (kendi satırım dahil, `is_mine` ile).
create or replace function list_park_now()
returns table (
  checkin_id     uuid,
  place_id       uuid,
  place_name     text,
  pet_id         uuid,
  pet_name       text,
  species        species,
  size           pet_size,
  pet_photo_path text,
  owner_name     text,
  ends_at        timestamptz,
  is_mine        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    pc.id,
    mp.id,
    mp.name,
    pt.id,
    pt.name,
    pt.species,
    pt.size,
    (select ph.storage_path from pet_photos ph
      where ph.pet_id = pt.id order by ph.position limit 1),
    case when owner.owner_visibility = 'public' then owner.display_name end,
    pc.ends_at,
    pc.user_id = (select auth.uid())
  from park_checkins pc
  join profiles me on me.id = (select auth.uid())
  join regions r on r.slug = me.region_slug and r.is_pilot and r.is_active
  join meetup_places mp on mp.id = pc.place_id and mp.is_active
  join pets pt on pt.id = pc.pet_id and pt.is_active
  join profiles owner on owner.id = pc.user_id
  where pc.region_slug = me.region_slug
    and pc.ended_at is null
    and pc.ends_at > now()
    and pc.user_id <> all ((select blocked_user_ids())::uuid[])
  order by mp.sort_order, mp.name, pc.starts_at;
$$;

create or replace function set_park_notifications(p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  update discovery_preferences
  set notify_on_park = coalesce(p_enabled, true)
  where user_id = (select auth.uid());
end;
$$;

create or replace function my_park_notifications_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select notify_on_park from discovery_preferences where user_id = (select auth.uid())),
    true
  );
$$;

-- 3 -------------------------------------------------------------------------
-- Alıcı seçimi SQL'de (inceleme Y4: edge function'da alıcı başına sorgu
-- ölçeklenmiyordu). Yalnız service_role (send-notification) çağırır.
-- Alıcı başına 2 saatte en fazla bir park bildirimi; en fazla 200 alıcı.
create or replace function park_checkin_recipients(p_checkin_id uuid)
returns table (user_id uuid)
language sql
stable
security definer
set search_path = public
as $$
  select p.id
  from park_checkins pc
  join profiles p
    on p.region_slug = pc.region_slug
   and p.id <> pc.user_id
   and p.onboarded_at is not null
  join discovery_preferences dp on dp.user_id = p.id and dp.notify_on_park
  where pc.id = p_checkin_id
    and pc.ended_at is null
    and pc.ends_at > now()
    and exists (
      select 1 from pets v
      where v.owner_id = p.id and v.is_active and 'playdate' = any (v.goals)
    )
    and not is_blocked_between(pc.user_id, p.id)
    and not exists (
      select 1 from park_checkins mine
      where mine.user_id = p.id and mine.ended_at is null and mine.ends_at > now()
    )
    and not exists (
      select 1 from notification_deliveries nd
      where nd.recipient_id = p.id
        and nd.event_type = 'park_checkin'
        and nd.attempted_at > now() - interval '2 hours'
    )
  order by p.last_active_at desc
  limit 200;
$$;

revoke all on function start_park_checkin(uuid, integer) from public, anon, authenticated;
revoke all on function end_my_park_checkin() from public, anon, authenticated;
revoke all on function list_park_now() from public, anon, authenticated;
revoke all on function set_park_notifications(boolean) from public, anon, authenticated;
revoke all on function my_park_notifications_enabled() from public, anon, authenticated;
revoke all on function park_checkin_recipients(uuid) from public, anon, authenticated;

grant execute on function start_park_checkin(uuid, integer) to authenticated;
grant execute on function end_my_park_checkin() to authenticated;
grant execute on function list_park_now() to authenticated;
grant execute on function set_park_notifications(boolean) to authenticated;
grant execute on function my_park_notifications_enabled() to authenticated;
grant execute on function park_checkin_recipients(uuid) to service_role;
