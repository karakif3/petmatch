-- Engel sonrası erişim (G03 raporu, docs/otonom/raporlar PR #9).
--
-- 1) blocks: engel istemciden değiştirilemez ve silinemez. `for all` politikası
--    UPDATE ile engeli tetikleyicisiz başka kullanıcıya taşımaya, DELETE ile
--    sessizce kaldırmaya izin veriyordu (0006:230-232; handle_block yalnız
--    INSERT'te, 0005:117-119). Tek yazma yolu block_user (0020, SECURITY
--    DEFINER); istemcide başka yol yok (core/api/safety.ts). Kalıcı engel:
--    geri alma ürün kararı olarak açık (G03 Sahip kararı 1).
-- 2) Realtime ephemeral kanal: yalnız aktif konuşma ve karşı tarafla engel
--    yokken; engel/unmatch sonrası yazıyor/çevrimiçi sinyali kesilir.
-- 3) get_conversation_owner_profile: engellenen ya da engelleyen taraf karşı
--    tarafın sahip profilini ve aktiflik kovasını okuyamaz.

-- 1 -------------------------------------------------------------------------
drop policy if exists blocks_own on blocks;

create policy blocks_select_own on blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

revoke insert, update, delete on table blocks from anon, authenticated;

-- 2 -------------------------------------------------------------------------
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
    join conversations c on c.id = cp.conversation_id
    where cp.conversation_id = v_conversation_id
      and cp.user_id = auth.uid()
      and c.is_active
      and not exists (
        select 1
        from conversation_participants other
        where other.conversation_id = cp.conversation_id
          and other.user_id <> auth.uid()
          and other.user_id = any ((select blocked_user_ids())::uuid[])
      )
  );
end;
$$;

-- 3 -------------------------------------------------------------------------
-- 0068:433-484 ile aynı; yalnız engel koşulu eklendi. Boş sonuç istemcide
-- zaten null (core/api/conversations.ts), imza değişmiyor.
create or replace function get_conversation_owner_profile(p_conversation_id uuid)
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
begin
  if auth.uid() is null or not exists (
    select 1
    from conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = auth.uid()
  ) then
    raise exception 'not a participant of conversation' using errcode = '42501';
  end if;

  return query
  select
    other_profile.id,
    other_profile.display_name,
    other_profile.avatar_url,
    other_profile.bio,
    other_profile.gender,
    owner_age_bucket(other_profile.birth_date),
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
    and other_profile.id <> all ((select blocked_user_ids())::uuid[])
  limit 1;
end;
$$;
