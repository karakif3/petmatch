-- Geri bildirim sorusunu buluşma KAYDINA bağla
--
-- 0043 buluşmayı öneri → yanıt → gerçekleşme akışı olan bir kayda çevirdi
-- ama asıl getiri o zaman uygulanmadı: `list_my_conversations` hâlâ 0036'nın
-- sezgisini kullanıyordu ("4+ mesaj, 2 farklı gönderen, ilk mesaj 3 günden
-- eski"). Artık kayıt var: onaylanmış (`accepted`) ve zamanı geçmiş bir
-- buluşma varsa soru KESİN sorulmalı ve yerini/tarihini adıyla anmalı.
-- Kayıt yoksa eski sezgi yedek kalıyor — konuşma buluşma önerisi hiç
-- görmeden olgunlaşmış olabilir.

drop function if exists list_my_conversations();

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
  unread_count             bigint,
  awaiting_my_reply        boolean,
  ask_meetup_feedback      boolean,
  -- Kayıttan gelen soruda yeri/tarihi adıyla anmak için. Sezgiden gelen
  -- sorularda ikisi de null kalır.
  meetup_place_name        text,
  meetup_scheduled_at      timestamptz
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
    coalesce(unread.total, 0),
    -- Sıra sende: son sözü karşı taraf söyledi.
    coalesce(latest_message.sender_id <> auth.uid(), false),
    -- Buluşma sorusu: kayıtlı ve zamanı geçmiş onaylı buluşma varsa kesin,
    -- yoksa eski sezgiye (iki yönlü, olgunlaşmış, cevapsız konuşma) düş.
    (
      c.is_active
      and not exists (
        select 1 from meetup_feedback mf
        where mf.conversation_id = c.id and mf.user_id = auth.uid()
      )
      and (
        confirmed_meetup.id is not null
        or (
          stats.total_messages >= 4
          and stats.distinct_senders >= 2
          and stats.first_message_at < now() - interval '3 days'
        )
      )
    ),
    confirmed_meetup.place_name,
    confirmed_meetup.scheduled_at
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
    select msg.body, msg.created_at, msg.sender_id
    from messages msg
    where msg.conversation_id = c.id
    -- `id` ikincil anahtar: aynı damgaya düşen iki mesajda "son mesaj" aksi
    -- halde belirsiz kalıyor ve sıra göstergesi yanlış tarafa dönebiliyor.
    -- Sayfalamadaki keyset ile aynı gerekçe.
    order by msg.created_at desc, msg.id desc
    limit 1
  ) latest_message on true
  left join lateral (
    select count(*) as total
    from messages msg
    where msg.conversation_id = c.id
      and msg.sender_id <> auth.uid()
      and msg.read_at is null
  ) unread on true
  left join lateral (
    select
      count(*) as total_messages,
      count(distinct msg.sender_id) as distinct_senders,
      min(msg.created_at) as first_message_at
    from messages msg
    where msg.conversation_id = c.id
  ) stats on true
  left join lateral (
    select mt.id, mp.name as place_name, mt.scheduled_at
    from meetups mt
    join meetup_places mp on mp.id = mt.place_id
    where mt.conversation_id = c.id
      and mt.status = 'accepted'
      and mt.scheduled_at < now()
    order by mt.scheduled_at desc
    limit 1
  ) confirmed_meetup on true
  where mine.user_id = auth.uid()
  -- Sırası sende olanlar üste. Hinge'in göstergesini etkili kılan şey
  -- rozetin kendisi değil, konuşmayı görünür yere taşıması.
  order by
    coalesce(latest_message.sender_id <> auth.uid(), false) desc,
    coalesce(latest_message.created_at, c.created_at) desc;
$$;

revoke all on function list_my_conversations() from public, anon;
grant execute on function list_my_conversations() to authenticated;
