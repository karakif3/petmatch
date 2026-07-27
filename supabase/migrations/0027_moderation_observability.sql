-- Moderasyon operasyonu, 24 saat SLA ve gizlilik odaklı ürün/hata olayları.

create table app_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('moderator', 'admin')),
  created_at timestamptz not null default now()
);

alter table app_user_roles enable row level security;
revoke all on table app_user_roles from public, anon, authenticated;

create or replace function is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_user_roles
    where user_id = auth.uid() and role in ('moderator', 'admin')
  );
$$;

revoke all on function is_moderator() from public, anon;
grant execute on function is_moderator() to authenticated;

create policy verification_photos_select_moderator on storage.objects
  for select to authenticated
  using (bucket_id = 'verification-photos' and is_moderator());

create table product_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_name text not null check (
    event_name in (
      'onboarding_completed',
      'discovery_viewed',
      'swipe_like',
      'swipe_pass',
      'match_created',
      'message_sent',
      'report_submitted',
      'verification_submitted',
      'account_delete_requested'
    )
  ),
  properties jsonb not null default '{}',
  created_at timestamptz not null default now(),
  check (jsonb_typeof(properties) = 'object'),
  check (octet_length(properties::text) <= 4096)
);

create index product_events_name_created_idx
  on product_events (event_name, created_at desc);

create table client_errors (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  error_name text not null check (char_length(error_name) between 1 and 120),
  message text not null check (char_length(message) between 1 and 1000),
  stack text check (char_length(stack) <= 4000),
  route text check (char_length(route) <= 200),
  app_version text check (char_length(app_version) <= 80),
  created_at timestamptz not null default now()
);

create index client_errors_created_idx on client_errors (created_at desc);

alter table product_events enable row level security;
alter table client_errors enable row level security;
revoke all on table product_events from public, anon, authenticated;
revoke all on table client_errors from public, anon, authenticated;

create or replace function track_product_event(
  p_event_name text,
  p_properties jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  insert into product_events (user_id, event_name, properties)
  values (auth.uid(), p_event_name, coalesce(p_properties, '{}'));
end;
$$;

create or replace function capture_client_error(
  p_error_name text,
  p_message text,
  p_stack text default null,
  p_route text default null,
  p_app_version text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return; end if;
  insert into client_errors (
    user_id, error_name, message, stack, route, app_version
  )
  values (
    auth.uid(),
    left(coalesce(nullif(trim(p_error_name), ''), 'Error'), 120),
    left(coalesce(nullif(trim(p_message), ''), 'Bilinmeyen hata'), 1000),
    left(p_stack, 4000),
    left(p_route, 200),
    left(p_app_version, 80)
  );
end;
$$;

revoke all on function track_product_event(text, jsonb)
  from public, anon, authenticated;
revoke all on function capture_client_error(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function track_product_event(text, jsonb) to authenticated;
grant execute on function capture_client_error(text, text, text, text, text)
  to authenticated;

create or replace function get_moderation_queue(p_limit integer default 50)
returns table (
  id uuid,
  kind moderation_kind,
  status moderation_status,
  subject_user_id uuid,
  subject_pet_id uuid,
  reason report_reason,
  payload jsonb,
  note text,
  created_at timestamptz,
  age_hours numeric,
  sla_breached boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_moderator() then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  return query
  select
    m.id, m.kind, m.status, m.subject_user_id, m.subject_pet_id,
    m.reason, m.payload, m.note, m.created_at,
    round(extract(epoch from (now() - m.created_at)) / 3600, 1),
    m.created_at < now() - interval '24 hours'
  from moderation_items m
  where m.status = 'pending'
  order by m.created_at asc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end;
$$;

create or replace function review_moderation_item(
  p_item_id uuid,
  p_decision moderation_status,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item moderation_items%rowtype;
begin
  if not is_moderator() then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'decision must be approved or rejected' using errcode = '22023';
  end if;
  if p_decision = 'rejected' and nullif(trim(p_note), '') is null then
    raise exception 'rejection note is required' using errcode = '22023';
  end if;

  update moderation_items
  set
    status = p_decision,
    note = nullif(trim(p_note), ''),
    reviewed_at = now(),
    reviewed_by = auth.uid()
  where moderation_items.id = p_item_id and status = 'pending'
  returning * into v_item;

  if v_item.id is null then
    raise exception 'pending moderation item not found' using errcode = 'P0002';
  end if;

  if v_item.kind = 'verification' and v_item.subject_user_id is not null then
    update profiles
    set
      verification_status = p_decision,
      verified_at = case when p_decision = 'approved' then now() else null end
    where profiles.id = v_item.subject_user_id;
  end if;
end;
$$;

create or replace function get_operations_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not is_moderator() then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'moderation_pending', (
      select count(*) from moderation_items where status = 'pending'
    ),
    'moderation_sla_breached', (
      select count(*) from moderation_items
      where status = 'pending' and created_at < now() - interval '24 hours'
    ),
    'notification_failed_24h', (
      select count(*) from notification_deliveries
      where status = 'failed' and attempted_at >= now() - interval '24 hours'
    ),
    'client_errors_24h', (
      select count(*) from client_errors
      where created_at >= now() - interval '24 hours'
    ),
    'funnel_7d', (
      select coalesce(jsonb_object_agg(event_name, total), '{}')
      from (
        select event_name, count(*) total
        from product_events
        where created_at >= now() - interval '7 days'
        group by event_name
      ) events
    )
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function get_moderation_queue(integer)
  from public, anon, authenticated;
revoke all on function review_moderation_item(uuid, moderation_status, text)
  from public, anon, authenticated;
revoke all on function get_operations_metrics()
  from public, anon, authenticated;
grant execute on function get_moderation_queue(integer) to authenticated;
grant execute on function review_moderation_item(uuid, moderation_status, text)
  to authenticated;
grant execute on function get_operations_metrics() to authenticated;
