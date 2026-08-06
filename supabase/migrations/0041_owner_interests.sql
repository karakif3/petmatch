-- İlgi alanları: sahip profilinde, sonradan doldurulan, sabit taksonomi.
-- Gerekçe ve taksonomi sınırı docs/experience-roadmap.md §6'da.

alter table profiles add column if not exists interests text[] not null default '{}';

drop function if exists update_my_owner_details(
  text, text, date, text, owner_visibility, text, boolean
);

create or replace function update_my_owner_details(
  p_display_name       text,
  p_bio                text,
  p_birth_date         date,
  p_gender             text,
  p_owner_visibility   owner_visibility,
  p_avatar_path        text,
  p_owner_social_open  boolean,
  p_interests          text[]
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
  text, text, date, text, owner_visibility, text, boolean, text[]
) from public, anon, authenticated;
grant execute on function update_my_owner_details(
  text, text, date, text, owner_visibility, text, boolean, text[]
) to authenticated;
