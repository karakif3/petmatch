-- Push bildirimleri
--
-- Token yazımı dar RPC'lere alınır. Böylece aynı cihazda hesap değişince token
-- güvenli biçimde yeni kullanıcıya taşınabilir ve istemci başka kullanıcıların
-- token kayıtlarını okuyamaz. Teslimat günlüğü yalnızca service_role içindir.

alter table push_tokens
  add column updated_at timestamptz not null default now();

create table notification_deliveries (
  event_type   text not null check (event_type in ('match', 'message')),
  event_id     uuid not null,
  recipient_id uuid not null references profiles (id) on delete cascade,
  status       text not null default 'processing'
               check (status in ('processing', 'sent', 'skipped', 'failed')),
  ticket_id    text,
  last_error   text check (char_length(last_error) <= 1000),
  attempted_at timestamptz not null default now(),
  sent_at      timestamptz,
  primary key (event_type, event_id, recipient_id)
);

create index notification_deliveries_recipient_idx
  on notification_deliveries (recipient_id, attempted_at desc);

alter table notification_deliveries enable row level security;

revoke all on table push_tokens from anon, authenticated;
revoke all on table notification_deliveries from anon, authenticated;

create or replace function register_push_token(
  p_token    text,
  p_platform text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text := trim(p_token);
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_platform not in ('ios', 'android') then
    raise exception 'unsupported push platform' using errcode = '22023';
  end if;
  if char_length(v_token) > 512
     or v_token !~ '^(ExponentPushToken|ExpoPushToken)\[[^]]+\]$' then
    raise exception 'invalid Expo push token' using errcode = '22023';
  end if;

  insert into push_tokens (token, user_id, platform, updated_at)
  values (v_token, auth.uid(), p_platform, now())
  on conflict (token) do update
  set
    user_id = excluded.user_id,
    platform = excluded.platform,
    updated_at = now();
end;
$$;

create or replace function unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from push_tokens
  where token = trim(p_token)
    and user_id = auth.uid();
$$;

create or replace function update_notification_preferences(
  p_notify_on_match   boolean,
  p_notify_on_message boolean
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

  update discovery_preferences
  set
    notify_on_match = p_notify_on_match,
    notify_on_message = p_notify_on_message
  where user_id = auth.uid();

  if not found then
    raise exception 'notification preferences not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function register_push_token(text, text)
  from public, anon, authenticated;
revoke all on function unregister_push_token(text)
  from public, anon, authenticated;
revoke all on function update_notification_preferences(boolean, boolean)
  from public, anon, authenticated;

grant execute on function register_push_token(text, text) to authenticated;
grant execute on function unregister_push_token(text) to authenticated;
grant execute on function update_notification_preferences(boolean, boolean)
  to authenticated;
