-- Kullanıcı güvenliği ve tam pet profili yazma yolları.
--
-- İstemci tablo ayrıntılarına güvenmeden yalnızca kendi hesabı/peti veya
-- katıldığı konuşma üzerinde işlem yapar. Fotoğraf sırası tek transaction'da
-- değiştirilir; storage yükleme/temizleme istemcide bu RPC'nin etrafında yapılır.

-- ---------------------------------------------------------------------------
-- 1. Kullanıcı engelleme
-- ---------------------------------------------------------------------------

create or replace function block_user(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_blocked_id is null or p_blocked_id = auth.uid() then
    raise exception 'cannot block yourself' using errcode = '22023';
  end if;
  if not exists (select 1 from profiles where id = p_blocked_id) then
    raise exception 'user not found' using errcode = 'P0002';
  end if;

  insert into blocks (blocker_id, blocked_id)
  values (auth.uid(), p_blocked_id)
  on conflict do nothing;
end;
$$;

revoke all on function block_user(uuid) from public, anon, authenticated;
grant execute on function block_user(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Conversation kimliğiyle eşleşmeyi kaldırma
-- ---------------------------------------------------------------------------

create or replace function unmatch_conversation(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1
    from conversation_participants
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
  ) then
    raise exception 'not a participant of conversation' using errcode = '42501';
  end if;

  update matches
  set is_active = false
  where conversation_id = p_conversation_id
    and is_active;

  if not found then
    raise exception 'active match not found' using errcode = 'P0002';
  end if;

  update conversations
  set is_active = false
  where id = p_conversation_id;
end;
$$;

revoke all on function unmatch_conversation(uuid) from public, anon, authenticated;
grant execute on function unmatch_conversation(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Aktif petin ayrıntılarını güncelleme
-- ---------------------------------------------------------------------------

create or replace function update_my_pet_profile(
  p_pet_id          uuid,
  p_name            text,
  p_breed           text,
  p_birth_date      date,
  p_size            pet_size,
  p_energy_level    smallint,
  p_is_neutered     boolean,
  p_temperaments    text[],
  p_good_with_cats  boolean,
  p_good_with_dogs  boolean,
  p_good_with_kids  boolean,
  p_bio             text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name         text := nullif(trim(p_name), '');
  v_breed        text := nullif(trim(p_breed), '');
  v_bio          text := nullif(trim(p_bio), '');
  v_temperaments text[] := coalesce(p_temperaments, '{}');
  v_pet_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) > 40 then
    raise exception 'pet name must be between 1 and 40 characters'
      using errcode = '22023';
  end if;
  if v_breed is not null and char_length(v_breed) > 80 then
    raise exception 'breed is too long' using errcode = '22023';
  end if;
  if p_birth_date is not null and p_birth_date > current_date then
    raise exception 'birth date cannot be in the future' using errcode = '22023';
  end if;
  if p_energy_level not between 1 and 5 then
    raise exception 'energy level must be between 1 and 5' using errcode = '22023';
  end if;
  if v_bio is not null and char_length(v_bio) > 500 then
    raise exception 'bio is too long' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(v_temperaments) value
    where value <> all (array[
      'playful', 'calm', 'shy', 'curious', 'protective',
      'affectionate', 'independent'
    ])
  ) then
    raise exception 'invalid temperament' using errcode = '22023';
  end if;
  if cardinality(v_temperaments) <> (
    select count(distinct value) from unnest(v_temperaments) value
  ) then
    raise exception 'duplicate temperament' using errcode = '22023';
  end if;

  update pets
  set
    name = v_name,
    breed = v_breed,
    birth_date = p_birth_date,
    size = p_size,
    energy_level = p_energy_level,
    is_neutered = p_is_neutered,
    temperaments = v_temperaments,
    good_with_cats = p_good_with_cats,
    good_with_dogs = p_good_with_dogs,
    good_with_kids = p_good_with_kids,
    bio = v_bio
  where id = p_pet_id
    and owner_id = auth.uid()
    and is_active
  returning id into v_pet_id;

  if v_pet_id is null then
    raise exception 'active pet not found' using errcode = 'P0002';
  end if;
  return v_pet_id;
end;
$$;

revoke all on function update_my_pet_profile(
  uuid, text, text, date, pet_size, smallint, boolean, text[],
  boolean, boolean, boolean, text
) from public, anon, authenticated;
grant execute on function update_my_pet_profile(
  uuid, text, text, date, pet_size, smallint, boolean, text[],
  boolean, boolean, boolean, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Fotoğraf sırasını atomik olarak değiştir
-- ---------------------------------------------------------------------------

create or replace function replace_pet_photo_order(
  p_pet_id       uuid,
  p_storage_paths text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_paths text[] := coalesce(p_storage_paths, '{}');
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from pets
    where id = p_pet_id and owner_id = auth.uid() and is_active
  ) then
    raise exception 'active pet not found' using errcode = '42501';
  end if;
  if cardinality(v_paths) not between 1 and 6 then
    raise exception 'between 1 and 6 photos are required' using errcode = '22023';
  end if;
  if cardinality(v_paths) <> (
    select count(distinct value) from unnest(v_paths) value
  ) then
    raise exception 'duplicate storage path' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(v_paths) value
    where value is null
      or value = ''
      or value not like auth.uid()::text || '/' || p_pet_id::text || '/%'
  ) then
    raise exception 'invalid storage path' using errcode = '22023';
  end if;

  delete from pet_photos where pet_id = p_pet_id;

  insert into pet_photos (pet_id, storage_path, position)
  select p_pet_id, value, (ordinality - 1)::smallint
  from unnest(v_paths) with ordinality as ordered(value, ordinality);
end;
$$;

revoke all on function replace_pet_photo_order(uuid, text[])
  from public, anon, authenticated;
grant execute on function replace_pet_photo_order(uuid, text[]) to authenticated;

-- `report_content` eski migration'da public'ten geri alınmıştı; yeni roller
-- açıkça kapatılarak anonim erişim varsayımlara bırakılmaz.
revoke all on function report_content(report_reason, uuid, uuid, text)
  from public, anon;
grant execute on function report_content(report_reason, uuid, uuid, text)
  to authenticated;
