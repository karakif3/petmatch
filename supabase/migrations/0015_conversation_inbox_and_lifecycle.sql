-- Konuşma kutusu + yaşam döngüsü
--
-- messages INSERT politikası 0009'dan beri conversations.is_active değerine
-- bakıyor. unmatch ve block yalnızca matches.is_active'i kapatırsa mesajlaşma
-- açık kalır. Bu migration iki durumu da conversation seviyesinde kapatır ve
-- istemciye güvenli, tek sorguluk bir inbox görünümü verir.

-- ---------------------------------------------------------------------------
-- 1. Eski, conversation_id'siz eşleşmeleri geriye dönük tamamla
-- ---------------------------------------------------------------------------

do $$
declare
  v_match record;
  v_conversation_id uuid;
begin
  for v_match in
    select id, pet_a_id, pet_b_id
    from matches
    where conversation_id is null
  loop
    insert into conversations (kind, is_active)
    values (
      'match',
      (select is_active from matches where id = v_match.id)
    )
    returning id into v_conversation_id;

    update matches
    set conversation_id = v_conversation_id
    where id = v_match.id;

    insert into conversation_participants (conversation_id, user_id)
    select v_conversation_id, p.owner_id
    from pets p
    where p.id in (v_match.pet_a_id, v_match.pet_b_id)
    on conflict do nothing;
  end loop;
end;
$$;

-- Trigger her eşleşmede conversation ürettiği için artık null kalamaz.
alter table matches alter column conversation_id set not null;

-- ---------------------------------------------------------------------------
-- 2. Unmatch konuşmayı da kapatır
-- ---------------------------------------------------------------------------

create or replace function unmatch(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  select conversation_id into v_conversation_id
  from matches
  where id = p_match_id;

  if v_conversation_id is null
     or not (v_conversation_id = any (my_conversation_ids())) then
    raise exception 'not a participant of match %', p_match_id
      using errcode = '42501';
  end if;

  update matches
  set is_active = false
  where id = p_match_id;

  update conversations
  set is_active = false
  where id = v_conversation_id;
end;
$$;

revoke all on function unmatch(uuid) from public, anon, authenticated;
grant execute on function unmatch(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Engelleme iki kullanıcının tüm konuşmalarını kapatır
-- ---------------------------------------------------------------------------

create or replace function handle_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversations c
  set is_active = false
  where exists (
    select 1
    from conversation_participants mine
    join conversation_participants other
      on other.conversation_id = mine.conversation_id
    where mine.conversation_id = c.id
      and mine.user_id = new.blocker_id
      and other.user_id = new.blocked_id
  );

  update matches m
  set is_active = false
  where m.conversation_id in (
    select mine.conversation_id
    from conversation_participants mine
    join conversation_participants other
      on other.conversation_id = mine.conversation_id
    where mine.user_id = new.blocker_id
      and other.user_id = new.blocked_id
  );

  return new;
end;
$$;

revoke all on function handle_block() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Güvenli inbox RPC
-- ---------------------------------------------------------------------------

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
    other_profile.display_name,
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

-- ---------------------------------------------------------------------------
-- 5. Yeni mesajlar Realtime üzerinden dinlenebilir
-- ---------------------------------------------------------------------------

do $$
begin
  alter publication supabase_realtime add table messages;
exception
  when duplicate_object then null;
end;
$$;
