-- Inbox, owner_visibility='hidden' olan katılımcının adını fallback olarak
-- döndürmez. Normal eşleşmede başlık pet adıdır; pet sahipliği değiştiğinde
-- dahi gizli sahip tercihi korunur.

create or replace function list_my_conversations()
returns table (
  conversation_id          uuid,
  conversation_kind        text,
  is_active                boolean,
  counterpart_user_id      uuid,
  counterpart_display_name text,
  pet_id                   uuid,
  pet_name                 text,
  pet_photo_path           text,
  last_message             text,
  last_message_at          timestamptz,
  unread_count             bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.kind,
    c.is_active,
    other_participant.user_id,
    case
      when other_profile.owner_visibility = 'hidden' then null
      else other_profile.display_name
    end,
    coalesce(match_pet.id, adoption_pet.id),
    coalesce(match_pet.name, adoption_pet.name),
    first_photo.storage_path,
    latest_message.body,
    latest_message.created_at,
    coalesce(unread.total, 0)
  from conversation_participants mine
  join conversations c on c.id = mine.conversation_id
  left join lateral (
    select cp.user_id
    from conversation_participants cp
    where cp.conversation_id = c.id
      and cp.user_id <> auth.uid()
    order by cp.joined_at
    limit 1
  ) other_participant on true
  left join profiles other_profile
    on other_profile.id = other_participant.user_id
  left join matches m
    on m.conversation_id = c.id
  left join lateral (
    select p.id, p.name
    from pets p
    where p.id in (m.pet_a_id, m.pet_b_id)
      and p.owner_id = other_participant.user_id
    limit 1
  ) match_pet on true
  left join adoption_interests ai
    on ai.conversation_id = c.id
  left join pets adoption_pet
    on adoption_pet.id = ai.pet_id
  left join lateral (
    select ph.storage_path
    from pet_photos ph
    where ph.pet_id = coalesce(match_pet.id, adoption_pet.id)
    order by ph.position
    limit 1
  ) first_photo on true
  left join lateral (
    select msg.body, msg.created_at
    from messages msg
    where msg.conversation_id = c.id
    order by msg.created_at desc
    limit 1
  ) latest_message on true
  left join lateral (
    select count(*) as total
    from messages msg
    where msg.conversation_id = c.id
      and msg.sender_id <> auth.uid()
      and msg.read_at is null
  ) unread on true
  where mine.user_id = auth.uid()
  order by coalesce(latest_message.created_at, c.created_at) desc;
$$;

revoke all on function list_my_conversations() from public, anon, authenticated;
grant execute on function list_my_conversations() to authenticated;
