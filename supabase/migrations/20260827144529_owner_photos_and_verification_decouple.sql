-- Sahip galerisi + doğrulamayı profil fotoğrafından ayırma
--
-- ---------------------------------------------------------------------------
-- NEDEN
--
-- Doğrulama zaten ayrı bir kamerayla `verification-photos` bucket'ına
-- gidiyor (`submit_verification`): sahip ve aktif pet AYNI karede, yüzler
-- net. Profil avatarı / galeri bunun yerine geçmez ve profilde gösterilmez.
--
-- Buna rağmen `update_my_owner_details` onaylı rozeti `avatar_url`
-- değişince düşürüyordu — galeri fotoğrafını doğrulama kanıtı sanıyordu.
-- Rozet, incelemenin onayladığı o birlikte-çekilmiş kareye bağlı kalmalı.
--
-- Çoklu sahip fotoğrafı pet'teki `pet_photos` düzenini kopyalar: kapak
-- `profiles.avatar_url` (keşfet hapı, sosyal önkoşul, filtreler bozulmasın),
-- extras `owner_photos`. Keşfet kartına extras dökülmez.
-- ---------------------------------------------------------------------------

create table owner_photos (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references profiles (id) on delete cascade,
  storage_path text not null,
  position     smallint not null default 0 check (position between 0 and 3),
  created_at   timestamptz not null default now(),
  unique (owner_id, position)
);

create index owner_photos_owner_idx on owner_photos (owner_id, position);

alter table owner_photos enable row level security;

-- Okuma, avatar storage politikasıyla aynı görünürlük: kendin, public,
-- ya da after_match + aktif eşleşme; engellenenler yok.
create policy owner_photos_select on owner_photos
  for select to authenticated
  using (
    owner_id = (select auth.uid())
    or exists (
      select 1
      from profiles p
      where p.id = owner_photos.owner_id
        and p.id <> all ((select blocked_user_ids())::uuid[])
        and (
          p.owner_visibility = 'public'
          or (
            p.owner_visibility = 'after_match'
            and shares_active_match_with(p.id)
          )
        )
    )
  );

create policy owner_photos_write_own on owner_photos
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

grant select, insert, update, delete on table owner_photos to authenticated;
grant all on table owner_photos to service_role;

insert into owner_photos (owner_id, storage_path, position)
select id, avatar_url, 0
from profiles
where avatar_url is not null
  and length(trim(avatar_url)) > 0
on conflict (owner_id, position) do nothing;

create or replace function replace_owner_photo_order(p_storage_paths text[])
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
  if cardinality(v_paths) > 4 then
    raise exception 'at most 4 owner photos are allowed' using errcode = '22023';
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
      or value not like auth.uid()::text || '/%'
  ) then
    raise exception 'invalid storage path' using errcode = '22023';
  end if;

  delete from owner_photos where owner_id = auth.uid();

  insert into owner_photos (owner_id, storage_path, position)
  select auth.uid(), value, (ordinality - 1)::smallint
  from unnest(v_paths) with ordinality as ordered(value, ordinality);

  update profiles
  set avatar_url = case
    when cardinality(v_paths) = 0 then null
    else v_paths[1]
  end
  where id = auth.uid();
end;
$$;

revoke all on function replace_owner_photo_order(text[])
  from public, anon, authenticated;
grant execute on function replace_owner_photo_order(text[]) to authenticated;

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

  -- Galeri kapağı `avatar_url`. Doğrulama rozeti `verification-photos`
  -- kanıtına bağlı; kapak değişince düşmez.
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
    connection_tag = case when p_owner_social_open then v_tag else null end
  where id = auth.uid();

  if v_avatar is null then
    delete from owner_photos where owner_id = auth.uid();
  else
    insert into owner_photos (owner_id, storage_path, position)
    values (auth.uid(), v_avatar, 0)
    on conflict (owner_id, position) do update
      set storage_path = excluded.storage_path;
    delete from owner_photos
    where owner_id = auth.uid()
      and position <> 0
      and storage_path = v_avatar;
  end if;

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
