-- Konuşma katmanı + sahiplendirme
--
-- Sahiplendirme sohbeti matches'e sığmıyor: matches iki pet gerektiriyor,
-- başvuran kullanıcının peti olmayabilir (hayvansız gelen kullanıcı huninin
-- girişi). Çözüm: messages doğrudan match'e değil conversation'a bağlanır;
-- matches ve adoption_interests ikisi de bir conversation açar.
--
-- Ayrıca: pet SİLİNEMEZ hale geliyor. matches → pets ve messages → matches
-- cascade olduğu için silme, KARŞI TARAFIN sohbet geçmişini de siliyordu.

-- ---------------------------------------------------------------------------
-- 1. conversations
-- ---------------------------------------------------------------------------

create table conversations (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('match', 'adoption')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

alter table matches
  add column conversation_id uuid references conversations (id) on delete cascade;

-- Eşleşme doğduğunda konuşması da doğar.
create or replace function open_match_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  insert into conversations (kind) values ('match') returning id into v_conversation_id;
  update matches set conversation_id = v_conversation_id where id = new.id;
  return new;
end;
$$;

create trigger on_match_created
  after insert on matches
  for each row execute function open_match_conversation();

-- ---------------------------------------------------------------------------
-- 2. messages konuşmaya bağlanır
--
-- Politikalar match_id'ye bağlı olduğu için kolondan ÖNCE düşürülüyor;
-- yenileri §6'da conversation üzerinden kuruluyor.
-- ---------------------------------------------------------------------------

drop policy if exists messages_select_participant on messages;
drop policy if exists messages_insert_participant on messages;

alter table messages add column conversation_id uuid references conversations (id) on delete cascade;
alter table messages drop column match_id;
alter table messages alter column conversation_id set not null;

drop index if exists messages_match_idx;
create index messages_conversation_idx on messages (conversation_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. adoption_interests — karşılıklı beğeni değil, başvuru
-- ---------------------------------------------------------------------------

create type adoption_status as enum ('pending', 'accepted', 'declined', 'withdrawn');

create table adoption_interests (
  id              uuid primary key default gen_random_uuid(),
  pet_id          uuid not null references pets (id) on delete cascade,
  applicant_id    uuid not null references profiles (id) on delete cascade,
  note            text check (char_length(note) <= 1000),
  status          adoption_status not null default 'pending',
  conversation_id uuid references conversations (id) on delete set null,
  created_at      timestamptz not null default now(),
  responded_at    timestamptz,
  unique (pet_id, applicant_id)
);

create index adoption_interests_pet_idx       on adoption_interests (pet_id, status);
create index adoption_interests_applicant_idx on adoption_interests (applicant_id);

-- ---------------------------------------------------------------------------
-- 4. Konuşma üyeliği — RLS yardımcıları (0006 deseni: dizi, satır-bağımsız)
-- ---------------------------------------------------------------------------

create or replace function my_conversation_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct cid), '{}')
  from (
    -- eşleşme konuşmaları: taraf olduğum eşleşmeler
    select m.conversation_id as cid
    from matches m
    where m.conversation_id is not null
      and (m.pet_a_id = any (my_pet_ids()) or m.pet_b_id = any (my_pet_ids()))
    union
    -- sahiplendirme konuşmaları: başvuran olarak
    select ai.conversation_id
    from adoption_interests ai
    where ai.conversation_id is not null and ai.applicant_id = auth.uid()
    union
    -- sahiplendirme konuşmaları: ilan sahibi olarak
    select ai.conversation_id
    from adoption_interests ai
    join pets p on p.id = ai.pet_id
    where ai.conversation_id is not null and p.owner_id = auth.uid()
  ) s
  where cid is not null;
$$;

-- ---------------------------------------------------------------------------
-- 5. Sahiplendirme akışı
-- ---------------------------------------------------------------------------

/** İlgilenen başvurusunu bırakır. Kendi petine başvuramaz. */
create or replace function express_adoption_interest(p_pet_id uuid, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pet pets%rowtype;
  v_id  uuid;
begin
  select * into v_pet from pets where id = p_pet_id;

  if v_pet.id is null or not v_pet.is_active then
    raise exception 'pet not available' using errcode = '42501';
  end if;
  if v_pet.owner_id = auth.uid() then
    raise exception 'cannot apply to your own pet' using errcode = '42501';
  end if;
  if not ('adoption' = any (v_pet.goals)) then
    raise exception 'pet is not listed for adoption' using errcode = '42501';
  end if;
  if is_blocked_between(auth.uid(), v_pet.owner_id) then
    raise exception 'pet not available' using errcode = '42501';
  end if;

  insert into adoption_interests (pet_id, applicant_id, note)
  values (p_pet_id, auth.uid(), p_note)
  on conflict (pet_id, applicant_id) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

/** İlan sahibi başvuruyu kabul eder — konuşma burada açılır. */
create or replace function respond_to_adoption_interest(p_interest_id uuid, p_accept boolean)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_interest adoption_interests%rowtype;
  v_owner    uuid;
  v_conv     uuid;
begin
  select ai.* into v_interest from adoption_interests ai where ai.id = p_interest_id;
  select p.owner_id into v_owner from pets p where p.id = v_interest.pet_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not the listing owner' using errcode = '42501';
  end if;
  if v_interest.status <> 'pending' then
    raise exception 'interest already resolved' using errcode = '42501';
  end if;

  if not p_accept then
    update adoption_interests
    set status = 'declined', responded_at = now()
    where id = p_interest_id;
    return null;
  end if;

  insert into conversations (kind) values ('adoption') returning id into v_conv;

  update adoption_interests
  set status = 'accepted', responded_at = now(), conversation_id = v_conv
  where id = p_interest_id;

  return v_conv;
end;
$$;

/**
 * Sahiplendirme tamamlanır: pet yeni sahibine geçer.
 *
 * Devirle birlikte TÜM konuşmalar kapanır ve swipe geçmişi silinir —
 * aksi halde yeni sahip eski sahibin sohbetlerini okur.
 */
create or replace function complete_adoption(p_interest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_interest adoption_interests%rowtype;
  v_owner    uuid;
begin
  select ai.* into v_interest from adoption_interests ai where ai.id = p_interest_id;
  select p.owner_id into v_owner from pets p where p.id = v_interest.pet_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not the listing owner' using errcode = '42501';
  end if;
  if v_interest.status <> 'accepted' then
    raise exception 'interest not accepted' using errcode = '42501';
  end if;

  -- Petin geçmişteki tüm konuşmaları kapanır.
  update conversations set is_active = false
  where id in (
    select m.conversation_id from matches m
    where m.pet_a_id = v_interest.pet_id or m.pet_b_id = v_interest.pet_id
    union
    select ai.conversation_id from adoption_interests ai where ai.pet_id = v_interest.pet_id
  );

  update matches set is_active = false
  where pet_a_id = v_interest.pet_id or pet_b_id = v_interest.pet_id;

  -- Swipe geçmişi sıfırlanır: yeni sahip temiz bir desteyle başlar.
  delete from swipes where from_pet_id = v_interest.pet_id or to_pet_id = v_interest.pet_id;

  -- Bekleyen diğer başvurular kapanır.
  update adoption_interests
  set status = 'declined', responded_at = now()
  where pet_id = v_interest.pet_id and status = 'pending';

  -- Devir. Yeni sahibin aktif peti olur; amaç sahiplendirmeden çıkar.
  update pets
  set owner_id = v_interest.applicant_id,
      goals    = '{playdate}'
  where id = v_interest.pet_id;
end;
$$;

revoke all on function express_adoption_interest(uuid, text) from public;
revoke all on function respond_to_adoption_interest(uuid, boolean) from public;
revoke all on function complete_adoption(uuid) from public;
grant execute on function express_adoption_interest(uuid, text)   to authenticated;
grant execute on function respond_to_adoption_interest(uuid, boolean) to authenticated;
grant execute on function complete_adoption(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. RLS
-- ---------------------------------------------------------------------------

alter table conversations       enable row level security;
alter table adoption_interests  enable row level security;

create policy conversations_select_participant on conversations
  for select to authenticated
  using (id = any ((select my_conversation_ids())::uuid[]));

-- Başvuru: kendi başvurunu ve kendi petine gelenleri görürsün.
create policy adoption_interests_select on adoption_interests
  for select to authenticated
  using (
    applicant_id = (select auth.uid())
    or pet_id = any ((select my_pet_ids())::uuid[])
  );

-- Yazma yolu RPC'ler; doğrudan INSERT/UPDATE yok. Tek istisna: başvuruyu geri çekmek.
create policy adoption_interests_withdraw on adoption_interests
  for update to authenticated
  using (applicant_id = (select auth.uid()) and status = 'pending')
  with check (applicant_id = (select auth.uid()));

-- messages artık conversation üzerinden yetkileniyor (eskiler §2'de düşürüldü).
create policy messages_select_participant on messages
  for select to authenticated
  using (conversation_id = any ((select my_conversation_ids())::uuid[]));

create policy messages_insert_participant on messages
  for insert to authenticated
  with check (
    sender_id = (select auth.uid())
    and conversation_id = any ((select my_conversation_ids())::uuid[])
    and exists (select 1 from conversations c where c.id = conversation_id and c.is_active)
  );

-- ---------------------------------------------------------------------------
-- 7. Pet silme kapatılıyor
--
-- Silme, cascade ile karşı tarafın sohbet geçmişini de götürüyordu.
-- Yerine is_active = false; vefat durumunda profil anı olarak kalır.
-- ---------------------------------------------------------------------------

drop policy if exists pets_delete_own on pets;

-- ---------------------------------------------------------------------------
-- 8. Ticari satış şikâyet sebebi olur
-- ---------------------------------------------------------------------------

alter type report_reason add value 'commercial_sale';

-- ---------------------------------------------------------------------------
-- 9. 0005'teki yardımcılar conversation'a taşınıyor
-- ---------------------------------------------------------------------------

drop function if exists mark_messages_read(uuid);

create or replace function mark_messages_read(p_conversation_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not (p_conversation_id = any (my_conversation_ids())) then
    raise exception 'not a participant of conversation %', p_conversation_id
      using errcode = '42501';
  end if;

  with updated as (
    update messages
    set read_at = now()
    where conversation_id = p_conversation_id
      and sender_id <> auth.uid()
      and read_at is null
    returning 1
  )
  select count(*) into v_count from updated;

  return v_count;
end;
$$;

revoke all on function mark_messages_read(uuid) from public;
grant execute on function mark_messages_read(uuid) to authenticated;
