-- Premium sohbet sinyalleri ve doğrulama sertleştirmesi.
--
-- Kalıcı mesajlar public.messages + RLS üzerinden akar. Yazıyor/Presence
-- sinyalleri saklanmaz ve yalnız konuşmanın katılımcılarına açık private
-- Realtime kanalında taşınır.

create or replace function can_access_conversation_realtime(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  if auth.uid() is null
     or p_topic !~ '^conversation:[0-9a-fA-F-]{36}:ephemeral$' then
    return false;
  end if;

  begin
    v_conversation_id := split_part(p_topic, ':', 2)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return exists (
    select 1
    from conversation_participants cp
    where cp.conversation_id = v_conversation_id
      and cp.user_id = auth.uid()
  );
end;
$$;

revoke all on function can_access_conversation_realtime(text)
  from public, anon, authenticated;
grant execute on function can_access_conversation_realtime(text) to authenticated;

create policy conversation_ephemeral_read on realtime.messages
  for select to authenticated
  using (
    realtime.messages.extension in ('broadcast', 'presence')
    and can_access_conversation_realtime((select realtime.topic()))
  );

create policy conversation_ephemeral_write on realtime.messages
  for insert to authenticated
  with check (
    realtime.messages.extension in ('broadcast', 'presence')
    and can_access_conversation_realtime((select realtime.topic()))
  );

-- Tam zaman damgası istemciye verilmez. Yaklaşık aktivite kovası eşleşme
-- kalitesine yardımcı olurken gözetim/taciz sinyali üretmez.
drop function if exists get_conversation_owner_profile(uuid);

create function get_conversation_owner_profile(p_conversation_id uuid)
returns table (
  user_id         uuid,
  display_name    text,
  avatar_path     text,
  bio             text,
  gender          text,
  age_bucket      text,
  social_open     boolean,
  verified        boolean,
  activity_bucket text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me profiles%rowtype;
begin
  if auth.uid() is null or not exists (
    select 1
    from conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = auth.uid()
  ) then
    raise exception 'not a participant of conversation' using errcode = '42501';
  end if;

  select p.* into v_me
  from profiles p
  where p.id = auth.uid();

  return query
  select
    other_profile.id,
    other_profile.display_name,
    other_profile.avatar_url,
    other_profile.bio,
    case
      when v_me.owner_visibility <> 'hidden' and v_me.gender is not null
      then other_profile.gender
    end,
    case
      when v_me.owner_visibility <> 'hidden' and v_me.birth_date is not null
      then owner_age_bucket(other_profile.birth_date)
    end,
    other_profile.owner_social_open,
    other_profile.verification_status = 'approved',
    activity_bucket(other_profile.last_active_at)
  from conversations c
  join conversation_participants mine
    on mine.conversation_id = c.id and mine.user_id = auth.uid()
  join conversation_participants other
    on other.conversation_id = c.id and other.user_id <> auth.uid()
  join profiles other_profile on other_profile.id = other.user_id
  where c.id = p_conversation_id
    and (
      other_profile.owner_visibility = 'public'
      or (other_profile.owner_visibility = 'after_match' and c.is_active)
    )
  limit 1;
end;
$$;

revoke all on function get_conversation_owner_profile(uuid)
  from public, anon, authenticated;
grant execute on function get_conversation_owner_profile(uuid) to authenticated;

-- Aynı anda tek bekleyen başvurunun yanında otomasyon/kötüye kullanım için
-- günde en fazla üç gönderim. Reddedilen kullanıcı yeniden deneyebilir.
create or replace function submit_verification(p_pet_id uuid, p_photo_path text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_path text := nullif(trim(p_photo_path), '');
begin
  if auth.uid() is null or not owns_pet(p_pet_id) then
    raise exception 'not your pet' using errcode = '42501';
  end if;
  if v_path is null
     or v_path not like auth.uid()::text || '/' || p_pet_id::text || '/%' then
    raise exception 'invalid verification photo path' using errcode = '22023';
  end if;
  if exists (
    select 1 from moderation_items
    where created_by = auth.uid()
      and kind = 'verification'
      and status = 'pending'
  ) then
    raise exception 'a verification request is already pending'
      using errcode = '23505';
  end if;
  if (
    select count(*)
    from moderation_items
    where created_by = auth.uid()
      and kind = 'verification'
      and created_at > now() - interval '24 hours'
  ) >= 3 then
    raise exception 'verification submission limit reached'
      using errcode = '22023';
  end if;

  insert into moderation_items (
    kind, created_by, subject_user_id, subject_pet_id, payload
  )
  values (
    'verification', auth.uid(), auth.uid(), p_pet_id,
    jsonb_build_object('photo_path', v_path)
  )
  returning id into v_id;

  update profiles
  set verification_status = 'pending', verified_at = null
  where id = auth.uid();

  return v_id;
end;
$$;

revoke all on function submit_verification(uuid, text)
  from public, anon, authenticated;
grant execute on function submit_verification(uuid, text) to authenticated;

-- Rozet sahip fotoğrafıyla birlikte gösterildiği için onaydan sonra fotoğraf
-- değişirse doğrulama yeniden istenir. Diğer profil metni değişiklikleri rozeti
-- düşürmez.
create or replace function update_my_owner_details(
  p_display_name       text,
  p_bio                text,
  p_birth_date         date,
  p_gender             text,
  p_owner_visibility   owner_visibility,
  p_avatar_path        text,
  p_owner_social_open  boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name   text := nullif(trim(p_display_name), '');
  v_bio    text := nullif(trim(p_bio), '');
  v_gender text := nullif(trim(p_gender), '');
  v_avatar text := nullif(trim(p_avatar_path), '');
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_name is not null and char_length(v_name) > 60 then
    raise exception 'display name is too long' using errcode = '22023';
  end if;
  if v_bio is not null and char_length(v_bio) > 500 then
    raise exception 'bio is too long' using errcode = '22023';
  end if;
  if p_birth_date is null
     or p_birth_date > current_date - interval '18 years' then
    raise exception 'owner must be at least 18' using errcode = '22023';
  end if;
  if v_gender is not null and v_gender <> all (array['female', 'male', 'other']) then
    raise exception 'invalid gender' using errcode = '22023';
  end if;
  if v_avatar is not null
     and v_avatar not like auth.uid()::text || '/%' then
    raise exception 'invalid avatar path' using errcode = '22023';
  end if;
  if p_owner_social_open and (
    v_name is null
    or v_avatar is null
    or p_owner_visibility <> 'public'
  ) then
    raise exception 'social mode requires a public owner name and photo'
      using errcode = '23514';
  end if;

  update profiles
  set
    display_name = v_name,
    bio = v_bio,
    birth_date = p_birth_date,
    gender = v_gender,
    owner_visibility = p_owner_visibility,
    avatar_url = v_avatar,
    owner_social_open = p_owner_social_open,
    verification_status = case
      when avatar_url is distinct from v_avatar
       and verification_status = 'approved'
      then null
      else verification_status
    end,
    verified_at = case
      when avatar_url is distinct from v_avatar
       and verification_status = 'approved'
      then null
      else verified_at
    end
  where id = auth.uid();

  if not p_owner_social_open then
    update discovery_preferences
    set require_owner_social = false
    where user_id = auth.uid();
  end if;
end;
$$;

revoke all on function update_my_owner_details(
  text, text, date, text, owner_visibility, text, boolean
) from public, anon, authenticated;
grant execute on function update_my_owner_details(
  text, text, date, text, owner_visibility, text, boolean
) to authenticated;
