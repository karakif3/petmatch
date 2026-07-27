-- RLS sertleştirme
--
-- 0003'teki matches/messages UPDATE politikaları "hangi satır" sorusunu
-- yanıtlıyordu ama "hangi kolon" sorusunu açık bırakıyordu:
--
--   * matches üzerinde UPDATE hakkı olan taraf pet_a_id / pet_b_id'yi de
--     değiştirebiliyordu — tek gerçek eşleşmesi olan biri o satırı sistemdeki
--     herhangi bir pete yönlendirip karşı tarafın profilini okuyabilir ve
--     mesaj atabilirdi.
--   * messages üzerinde UPDATE hakkı olan taraf karşı tarafın body'sini
--     değiştirebiliyordu; niyet yalnızca read_at'ti.
--
-- Çözüm: geniş UPDATE politikalarını kaldır, yerine niyeti dar iki RPC koy.
-- Ayrıca engelleme artık mevcut eşleşmeyi de kapatıyor.

-- ---------------------------------------------------------------------------
-- 1. Geniş UPDATE politikalarını kaldır
--
-- Politika kalmayınca RLS altında UPDATE hiçbir satırı görmez; tek yol
-- aşağıdaki SECURITY DEFINER fonksiyonlarıdır.
-- ---------------------------------------------------------------------------

drop policy if exists matches_update_participant on matches;
drop policy if exists messages_update_participant on messages;

-- ---------------------------------------------------------------------------
-- 2. unmatch — eşleşmeyi bozmanın tek yolu
-- ---------------------------------------------------------------------------

create or replace function unmatch(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_match_participant(p_match_id) then
    raise exception 'not a participant of match %', p_match_id using errcode = '42501';
  end if;

  update matches set is_active = false where id = p_match_id;
end;
$$;

revoke all on function unmatch(uuid) from public;
grant execute on function unmatch(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. mark_messages_read — yalnızca karşı tarafın okunmamış mesajlarını işaretler
--
-- Kendi mesajını okundu yapmak anlamsız; sadece read_at dokunulur.
-- Okunan mesaj sayısını döndürür.
-- ---------------------------------------------------------------------------

create or replace function mark_messages_read(p_match_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if not is_match_participant(p_match_id) then
    raise exception 'not a participant of match %', p_match_id using errcode = '42501';
  end if;

  with updated as (
    update messages
    set read_at = now()
    where match_id = p_match_id
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

-- ---------------------------------------------------------------------------
-- 4. Engelleme mevcut eşleşmeyi de bozar
--
-- 0003'te shares_active_match_with() blocks'a bakmıyordu: birini engelledikten
-- sonra o kişi hâlâ profili görüyor ve mesaj atabiliyordu. Eşleşmeyi kapatmak
-- her iki tarafı da tek hamlede keser (pets/profiles görünürlüğü ve
-- messages_insert_participant hepsi is_active'e bağlı).
-- ---------------------------------------------------------------------------

create or replace function handle_block()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update matches m
  set is_active = false
  where m.is_active
    and exists (
      select 1
      from pets a
      join pets b on b.id in (m.pet_a_id, m.pet_b_id) and b.id <> a.id
      where a.id in (m.pet_a_id, m.pet_b_id)
        and a.owner_id = new.blocker_id
        and b.owner_id = new.blocked_id
    );

  return new;
end;
$$;

create trigger on_block_created
  after insert on blocks
  for each row execute function handle_block();

-- ---------------------------------------------------------------------------
-- 5. Engellenen taraf yeni eşleşme doğuramaz
--
-- discover_pets zaten engellenmişi listelemiyor, ama engellemeden ÖNCE atılmış
-- karşılıklı beğeni duruyorsa trigger sonradan yine de match açardı.
-- ---------------------------------------------------------------------------

create or replace function handle_swipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reciprocal boolean;
  v_from_owner uuid;
  v_to_owner   uuid;
begin
  if new.direction <> 'like' then
    return new;
  end if;

  select exists (
    select 1 from swipes
    where from_pet_id = new.to_pet_id
      and to_pet_id = new.from_pet_id
      and direction = 'like'
  ) into v_reciprocal;

  if not v_reciprocal then
    return new;
  end if;

  select owner_id into v_from_owner from pets where id = new.from_pet_id;
  select owner_id into v_to_owner   from pets where id = new.to_pet_id;

  if is_blocked_between(v_from_owner, v_to_owner) then
    return new;
  end if;

  -- pet_a_id < pet_b_id kuralı: çifti sıralı yaz ki unique index çalışsın.
  insert into matches (pet_a_id, pet_b_id)
  values (
    least(new.from_pet_id, new.to_pet_id),
    greatest(new.from_pet_id, new.to_pet_id)
  )
  on conflict (pet_a_id, pet_b_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Kendi swipe'ını geri alabilme
--
-- 0003'te swipes üzerinde DELETE politikası yoktu: yanlışlıkla verilen "pass"
-- kalıcıydı ve unique (from_pet_id, to_pet_id) yüzünden tekrar denenemiyordu.
-- Beğeni geri alınamaz — eşleşme doğmuş olabilir.
-- ---------------------------------------------------------------------------

create policy swipes_delete_own on swipes
  for delete using (actor_id = auth.uid() and direction = 'pass');
