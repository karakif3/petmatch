-- Üç değişiklik, tek migration çünkü hepsi aynı ekranın (sahip profili)
-- "tanışma amacı" bölümünü etkiliyor:
--
-- 1. "Açık" seçmek artık `public` görünürlüğü ZORLAMIYOR, yalnızca `hidden`
--    ile birlikte olamıyor. Gerekçe: "eşleşince görünür + açık" gerçek bir
--    kullanıcı isteği — pet uyumu önce, romantik sinyal yalnızca eşleşince
--    ortaya çıksın. Keşif tarafındaki `case when owner_visibility = 'public'
--    then owner_social_open else false end` kalıbı zaten bu durumu doğru
--    ele alıyor (public değilse filtrede "açık" sayılmıyor) — orada hiçbir
--    değişiklik gerekmiyor, yalnızca KAYIT ANINDAKİ zorlama gevşiyor.
--
-- 2. Opsiyonel, FİLTRELEMEYEN bağlantı etiketi (`connection_tag`). Sabit
--    taksonomi (temperaments/interests ile aynı desen) — serbest metin
--    değil, çünkü serbest metin moderasyon yükü ister. Yalnızca "açık"
--    seçilince anlamlı ama DB seviyesinde zorlanmıyor (UI'da gösteriliyor).
--
-- 3. `legal_acceptances`e `gender_preference_consent` document_type'ı.
--    Yalnızca altyapı — aydınlatma metni yazılıp cinsiyet filtresi
--    açılana kadar hiçbir ekrandan çağrılmıyor.

alter table profiles add column if not exists connection_tag text;

-- Fonksiyondaki kontrolün DB seviyesindeki ikizi (`0021`) — aynı gevşeme
-- burada da uygulanmazsa üstteki RPC izin verse bile tablo reddediyor.
alter table profiles
  drop constraint profiles_owner_social_prerequisites;
alter table profiles
  add constraint profiles_owner_social_prerequisites check (
    not owner_social_open
    or (
      owner_visibility <> 'hidden'
      and avatar_url is not null
      and nullif(trim(display_name), '') is not null
    )
  );

alter table legal_acceptances drop constraint legal_acceptances_document_type_check;
alter table legal_acceptances add constraint legal_acceptances_document_type_check
  check (
    document_type in (
      'terms',
      'privacy_notice',
      'kvkk_notice',
      'location_consent',
      'public_profile_consent',
      'gender_preference_consent'
    )
  );

create or replace function record_optional_legal_consent(
  p_consent_type text,
  p_document_version text,
  p_accepted boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_consent_type not in (
    'location_consent', 'public_profile_consent', 'gender_preference_consent'
  ) then
    raise exception 'invalid optional consent type' using errcode = '22023';
  end if;
  if nullif(trim(p_document_version), '') is null
     or char_length(p_document_version) > 40 then
    raise exception 'invalid document version' using errcode = '22023';
  end if;
  insert into legal_acceptances (
    user_id, document_type, document_version, accepted
  )
  values (
    auth.uid(), p_consent_type, trim(p_document_version), coalesce(p_accepted, false)
  );
end;
$$;

drop function if exists update_my_owner_details(
  text, text, date, text, owner_visibility, text, boolean, text[]
);

create or replace function update_my_owner_details(
  p_display_name       text,
  p_bio                text,
  p_birth_date         date,
  p_gender             text,
  p_owner_visibility   owner_visibility,
  p_avatar_path        text,
  p_owner_social_open  boolean,
  p_interests          text[],
  p_connection_tag     text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name      text := nullif(trim(p_display_name), '');
  v_bio       text := nullif(trim(p_bio), '');
  v_gender    text := nullif(trim(p_gender), '');
  v_avatar    text := nullif(trim(p_avatar_path), '');
  v_interests text[] := coalesce(p_interests, '{}');
  v_tag       text := nullif(trim(p_connection_tag), '');
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
  -- Önceki kural `<> 'public'` idi (yalnızca herkese açık serbestti).
  -- Şimdi tek engel `hidden`: varlığını hiç göstermeyip aynı anda "yeni
  -- insanlarla tanışmak istiyorum" demek içsel çelişki, ama "eşleşince
  -- görünür + açık" değil — o, pet uyumu önce romantik sinyal sonra
  -- diyen makul bir tercih.
  if p_owner_social_open and (
    v_name is null
    or v_avatar is null
    or p_owner_visibility = 'hidden'
  ) then
    raise exception 'social mode requires a visible owner name and photo'
      using errcode = '23514';
  end if;
  if v_tag is not null and v_tag <> all (array[
    'new_friends', 'open_minded', 'not_sure_yet'
  ]) then
    raise exception 'invalid connection tag' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(v_interests) value
    where value <> all (array[
      'walks', 'hiking', 'running', 'agility', 'training', 'beach_trips',
      'dog_park_regular', 'cat_behavior', 'coffee', 'photography',
      'board_games', 'reading', 'cooking', 'travel', 'live_music',
      'volunteering'
    ])
  ) then
    raise exception 'invalid interest' using errcode = '22023';
  end if;
  if cardinality(v_interests) <> (
    select count(distinct value) from unnest(v_interests) value
  ) then
    raise exception 'duplicate interest' using errcode = '22023';
  end if;
  if cardinality(v_interests) > 8 then
    raise exception 'too many interests' using errcode = '22023';
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
    interests = v_interests,
    connection_tag = case when p_owner_social_open then v_tag else null end,
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
  text, text, date, text, owner_visibility, text, boolean, text[], text
) from public, anon, authenticated;
grant execute on function update_my_owner_details(
  text, text, date, text, owner_visibility, text, boolean, text[], text
) to authenticated;
