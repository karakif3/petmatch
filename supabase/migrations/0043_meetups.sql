-- Buluşmayı bir KAYDA çevir
--
-- Bugüne kadar sohbetteki "Buluşma planla" hızlı yanıtı sadece metin
-- yazıyordu. `meetup_places` (0038) doğrulanmış yerleri tutuyor,
-- `meetup_feedback` (0036) "buluştunuz mu?" diye soruyor — ama arada
-- buluşmanın kendisi hiçbir yerde kayıtlı değildi.
--
-- Bunun iki bedeli vardı:
--
-- 1. **Geri bildirim tahmine dayanıyordu.** 0036 şu sezgiyi kullanıyor:
--    "4+ mesaj, 2 farklı gönderen, ilk mesaj 3 günden eski" → buluşmuş
--    olabilirler. Çok konuşup hiç buluşmayan çifte de soruyor, ilk gün
--    buluşup az yazana da sormuyor.
-- 2. **Ürünün başarı metriği ölçülemiyordu.** benchmark.md'ye göre metrik
--    "kaç konuşma buluşmaya döndü"; buluşma kayıt değilse o oran
--    hesaplanamaz.
--
-- Bu migration buluşmayı öneri → yanıt → gerçekleşme akışı olan bir kayıt
-- haline getiriyor.

create type meetup_status as enum ('proposed', 'accepted', 'declined', 'cancelled');

create table if not exists meetups (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  proposed_by     uuid not null references profiles(id) on delete cascade,
  -- Yer serbest metin DEĞİL: yalnızca doğrulanmış buluşma yerleri.
  -- Güvenlik vaadimiz "halka açık, teyit edilmiş yer"di; serbest metin
  -- kullanıcıyı istediği adrese çağırmanın yolu olurdu.
  place_id        uuid not null references meetup_places(id),
  scheduled_at    timestamptz not null,
  status          meetup_status not null default 'proposed',
  responded_at    timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists meetups_conversation_idx
  on meetups (conversation_id, created_at desc);

-- Bir sohbette aynı anda tek canlı buluşma. Aksi halde iki taraf birbirine
-- üst üste öneri gönderip hangisinin geçerli olduğu belirsizleşir.
create unique index if not exists meetups_one_live_per_conversation
  on meetups (conversation_id)
  where status in ('proposed', 'accepted');

alter table meetups enable row level security;

-- Okuma: yalnızca sohbetin iki tarafı. Yazma yolu yok — RPC'lerden geçiyor.
--
-- Üyelik kontrolü `conversation_participants`'ı doğrudan sorgulamıyor,
-- `my_conversation_ids()` dizi yardımcısını kullanıyor. Sebebi 0006'da
-- kurulan desen: politika içinden BAŞKA bir RLS'li tabloyu okumak, o
-- tablonun politikasına da tabi olur ve sessizce boş küme döner. İlk
-- yazımda `exists (select 1 from conversation_participants ...)` kullandım
-- ve katılımcı kendi buluşmasını okuyamadı; test yakaladı.
--
-- `messages_select_participant` (0009) da aynı yardımcıyı kullanıyor.
create policy meetups_select_participant on meetups
  for select to authenticated
  using (conversation_id = any ((select my_conversation_ids())::uuid[]));

-- ---------------------------------------------------------------------------
-- Geri bildirimi buluşmaya bağla
--
-- Kolon nullable: 0036'dan önce girilmiş geri bildirimlerin buluşma kaydı
-- yok ve olmayacak. Ayrıca yapılandırılmış buluşma kullanmadan buluşan
-- çiftler de olacak; onların geri bildirimi de meetup_id'siz gelir.
-- ---------------------------------------------------------------------------

alter table meetup_feedback
  add column if not exists meetup_id uuid references meetups(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Öneri
-- ---------------------------------------------------------------------------

create or replace function propose_meetup(
  p_conversation_id uuid,
  p_place_id        uuid,
  p_scheduled_at    timestamptz
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not exists (
    select 1 from conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = auth.uid()
  ) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  if not exists (
    select 1 from conversations c
    where c.id = p_conversation_id and c.is_active
  ) then
    raise exception 'conversation is not active' using errcode = '22023';
  end if;

  -- Doğrulanmamış yere buluşma önerilemez; 0038'in tüm amacı buydu.
  if not exists (
    select 1 from meetup_places mp
    where mp.id = p_place_id and mp.is_verified and mp.is_active
  ) then
    raise exception 'place is not verified' using errcode = '22023';
  end if;

  if p_scheduled_at <= now() then
    raise exception 'meetup must be in the future' using errcode = '22023';
  end if;

  insert into meetups (conversation_id, proposed_by, place_id, scheduled_at)
  values (p_conversation_id, auth.uid(), p_place_id, p_scheduled_at)
  returning id into v_id;

  return v_id;
exception
  when unique_violation then
    raise exception 'a live meetup already exists' using errcode = '23505';
end;
$$;

-- ---------------------------------------------------------------------------
-- Yanıt — yalnızca KARŞI taraf
-- ---------------------------------------------------------------------------

create or replace function respond_to_meetup(
  p_meetup_id uuid,
  p_accept    boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meetup meetups%rowtype;
begin
  select * into v_meetup from meetups where id = p_meetup_id;
  if not found then
    raise exception 'meetup not found' using errcode = '22023';
  end if;

  if not exists (
    select 1 from conversation_participants cp
    where cp.conversation_id = v_meetup.conversation_id
      and cp.user_id = auth.uid()
  ) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  -- Kendi önerisini onaylayamaz. Onaylamak karşı tarafın rızası demek;
  -- öneren taraf onaylayabilseydi "kabul edildi" hiçbir şey ifade etmezdi.
  if v_meetup.proposed_by = auth.uid() then
    raise exception 'proposer cannot respond' using errcode = '42501';
  end if;

  if v_meetup.status <> 'proposed' then
    raise exception 'meetup is not awaiting a response' using errcode = '22023';
  end if;

  update meetups
     set status = case when p_accept then 'accepted' else 'declined' end::meetup_status,
         responded_at = now()
   where id = p_meetup_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- İptal — iki taraf da yapabilir
-- ---------------------------------------------------------------------------

create or replace function cancel_meetup(p_meetup_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meetup meetups%rowtype;
begin
  select * into v_meetup from meetups where id = p_meetup_id;
  if not found then
    raise exception 'meetup not found' using errcode = '22023';
  end if;

  if not exists (
    select 1 from conversation_participants cp
    where cp.conversation_id = v_meetup.conversation_id
      and cp.user_id = auth.uid()
  ) then
    raise exception 'not a participant' using errcode = '42501';
  end if;

  if v_meetup.status not in ('proposed', 'accepted') then
    raise exception 'meetup is already closed' using errcode = '22023';
  end if;

  update meetups
     set status = 'cancelled', responded_at = now()
   where id = p_meetup_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Sohbetin canlı buluşması
-- ---------------------------------------------------------------------------

create or replace function conversation_meetup(p_conversation_id uuid)
returns table (
  id           uuid,
  place_id     uuid,
  place_name   text,
  place_note   text,
  scheduled_at timestamptz,
  status       meetup_status,
  proposed_by  uuid,
  mine         boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.place_id, mp.name, mp.note, m.scheduled_at, m.status,
         m.proposed_by, m.proposed_by = auth.uid()
  from meetups m
  join meetup_places mp on mp.id = m.place_id
  where m.conversation_id = p_conversation_id
    and exists (
      select 1 from conversation_participants cp
      where cp.conversation_id = m.conversation_id
        and cp.user_id = auth.uid()
    )
    and m.status in ('proposed', 'accepted')
  order by m.created_at desc
  limit 1;
$$;

revoke all on function propose_meetup(uuid, uuid, timestamptz) from public, anon;
revoke all on function respond_to_meetup(uuid, boolean) from public, anon;
revoke all on function cancel_meetup(uuid) from public, anon;
revoke all on function conversation_meetup(uuid) from public, anon;

grant execute on function propose_meetup(uuid, uuid, timestamptz) to authenticated;
grant execute on function respond_to_meetup(uuid, boolean) to authenticated;
grant execute on function cancel_meetup(uuid) to authenticated;
grant execute on function conversation_meetup(uuid) to authenticated;
