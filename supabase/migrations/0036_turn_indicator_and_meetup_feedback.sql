-- "Sıra sende" göstergesi + buluşma geri beslemesi
--
-- İkisi de docs/benchmark.md'den geliyor:
--
--   * Hinge'in yanıt sırası göstergesi, konuşmaya dönüşmeden ölen eşleşmeleri
--     %25 azaltmış. Sohbetlerin yaklaşık %40'ı ikinci-üçüncü mesajdan sonra
--     ölüyor; kullanıcı çoğu zaman kötü niyetli değil, sadece sıranın kendisinde
--     olduğunu unutuyor.
--
--   * Hinge'in "We Met" döngüsü, başarıyı uygulamada geçen süreyle değil
--     kurulan buluşma sayısıyla ölçmeyi mümkün kılıyor. Bizde bu ayrıca
--     sıralama tasarımındaki açık soruyu kapatıyor: mesafe, son aktiflik, uyum
--     ve boost yarışıyordu ama hangisinin işe yaradığını gösteren sinyal yoktu.

-- ---------------------------------------------------------------------------
-- 1. Buluşma geri beslemesi
-- ---------------------------------------------------------------------------

create type meetup_outcome as enum ('met', 'not_yet', 'declined');

create table meetup_feedback (
  conversation_id uuid not null references conversations (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  outcome         meetup_outcome not null,
  created_at      timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index meetup_feedback_user_idx on meetup_feedback (user_id, outcome);

alter table meetup_feedback enable row level security;

-- Kendi cevabını görürsün; karşı tarafınkini GÖRMEZSİN. "O buluştuk dedi mi"
-- bilgisi tek başına baskı yaratır ve dürüst cevabı bozar.
create policy meetup_feedback_select_own on meetup_feedback
  for select to authenticated
  using (user_id = (select auth.uid()));

/** Buluşma sorusuna cevap verir. Yalnızca konuşmanın katılımcısı. */
create or replace function record_meetup_feedback(
  p_conversation_id uuid,
  p_outcome meetup_outcome
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not (p_conversation_id = any (my_conversation_ids())) then
    raise exception 'not a participant of conversation %', p_conversation_id
      using errcode = '42501';
  end if;

  insert into meetup_feedback (conversation_id, user_id, outcome)
  values (p_conversation_id, auth.uid(), p_outcome)
  on conflict (conversation_id, user_id)
  do update set outcome = excluded.outcome, created_at = now();
end;
$$;

revoke all on function record_meetup_feedback(uuid, meetup_outcome)
  from public, anon;
grant execute on function record_meetup_feedback(uuid, meetup_outcome) to authenticated;

/**
 * Bir sahibin buluşmaya dönüşen konuşma oranı.
 *
 * Sıralamaya HENÜZ bağlanmadı — veri yokken sıralamayı buna dayandırmak
 * yeni kullanıcıları cezalandırırdı. Önce sinyal birikecek.
 */
create or replace function owner_meetup_rate(p_user_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select count(*) filter (where mf.outcome = 'met')::numeric
            / nullif(count(*), 0)
     from meetup_feedback mf
     where mf.user_id = p_user_id and mf.outcome <> 'declined'),
    0
  );
$$;

revoke all on function owner_meetup_rate(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Inbox: sıra kimde + buluşma sorusu zamanı geldi mi
--
-- Soruyu ne zaman soracağımız bir sezgi: konuşma gerçekten iki yönlü olmalı
-- (tek taraflı "selam"lar sayılmaz), üstünden birkaç gün geçmeli, ve kullanıcı
-- daha önce cevaplamamış olmalı.
-- ---------------------------------------------------------------------------

-- Dönüş tipi değiştiği için `create or replace` yetmiyor; önce düşürülmeli.
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
  ask_meetup_feedback      boolean
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
    -- Buluşma sorusu: iki yönlü, olgunlaşmış, henüz cevaplanmamış konuşma.
    (
      c.is_active
      and stats.total_messages >= 4
      and stats.distinct_senders >= 2
      and stats.first_message_at < now() - interval '3 days'
      and not exists (
        select 1 from meetup_feedback mf
        where mf.conversation_id = c.id and mf.user_id = auth.uid()
      )
    )
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
  where mine.user_id = auth.uid()
  -- Sırası sende olanlar üste. Hinge'in göstergesini etkili kılan şey
  -- rozetin kendisi değil, konuşmayı görünür yere taşıması.
  order by
    coalesce(latest_message.sender_id <> auth.uid(), false) desc,
    coalesce(latest_message.created_at, c.created_at) desc;
$$;

revoke all on function list_my_conversations() from public, anon;
grant execute on function list_my_conversations() to authenticated;
