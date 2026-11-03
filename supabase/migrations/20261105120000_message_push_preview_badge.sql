-- Kişisel mesaj push'u + uygulama rozeti (backlog: "Mesaj push metni kişisiz").
--
-- 1) `notify_message_preview`: push'ta gönderen pet adı ve mesajın ilk
--    satırı görünsün mü. Kilit ekranında mesaj içeriği görünmesini
--    istemeyen kullanıcı kapatır; kapalıyken push eski adsız metinle gider.
--    Varsayılan AÇIK: geri dönüş oranını taşıyan şey içerik.
-- 2) `update_notification_preferences` üçüncü parametreyi alıyor. Eski
--    istemciler iki parametreyle çağırmaya devam edebilsin diye
--    `p_message_preview` varsayılanı null = "değiştirme".
-- 3) `unread_message_count(p_user)`: push'a konan rozet sayısı. Yalnız
--    service_role (Edge Function) çağırır; istemci kendi sayısını
--    `list_my_conversations`'tan topluyor — aynı tanım.

alter table discovery_preferences
  add column notify_message_preview boolean not null default true;

drop function update_notification_preferences(boolean, boolean);

create function update_notification_preferences(
  p_notify_on_match   boolean,
  p_notify_on_message boolean,
  p_message_preview   boolean default null
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
    notify_on_message = p_notify_on_message,
    notify_message_preview = coalesce(p_message_preview, notify_message_preview)
  where user_id = auth.uid();

  if not found then
    raise exception 'notification preferences not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function update_notification_preferences(boolean, boolean, boolean)
  from public, anon, authenticated;
grant execute on function update_notification_preferences(boolean, boolean, boolean)
  to authenticated;

create function unread_message_count(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from conversation_participants cp
  join messages msg on msg.conversation_id = cp.conversation_id
  where cp.user_id = p_user
    and msg.sender_id <> p_user
    and msg.read_at is null;
$$;

revoke all on function unread_message_count(uuid) from public, anon, authenticated;
grant execute on function unread_message_count(uuid) to service_role;
