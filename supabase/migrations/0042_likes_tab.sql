-- Beğeniler sekmesi: monetization.md "Kim beğendi — RLS gevşetilmez" kuralı.
-- swipes_select_own politikası aynen kalıyor; katman farkı burada, iki
-- SECURITY DEFINER fonksiyonun içinde yaşıyor.
--
-- Ödeme altyapısı henüz yok (Faz 0 = gelir yok), bu yüzden şimdilik ikisi de
-- authenticated'a açık — istemci tarafı ücretsiz görünümü sayı + bulanık
-- tuzer kartlarla simüle ediyor. `pending_likes()`'ı gerçek bir ücretli
-- katmanın arkasına almak ileride burada tek satırlık bir kontrol.

create or replace function pending_likes_count()
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_my_pet_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select id into v_my_pet_id from pets where owner_id = auth.uid() and is_active;
  if v_my_pet_id is null then
    return 0;
  end if;

  return (
    select count(*)::integer
    from swipes s
    join pets fp on fp.id = s.from_pet_id
    where s.to_pet_id = v_my_pet_id
      and s.direction = 'like'
      and fp.is_active
      and not is_blocked_between(auth.uid(), fp.owner_id)
      and not exists (
        select 1 from swipes back
        where back.from_pet_id = v_my_pet_id and back.to_pet_id = s.from_pet_id
      )
  );
end;
$$;

revoke all on function pending_likes_count() from public, anon, authenticated;
grant execute on function pending_likes_count() to authenticated;

create or replace function pending_likes(p_limit integer default 50)
returns table (
  id                  uuid,
  owner_id            uuid,
  name                text,
  species             species,
  breed               text,
  birth_date          date,
  gender              pet_gender,
  is_neutered         boolean,
  size                pet_size,
  energy_level        smallint,
  temperaments        text[],
  good_with_cats      boolean,
  good_with_dogs      boolean,
  good_with_kids      boolean,
  goals               match_goal[],
  bio                 text,
  city                text,
  photo_paths         text[],
  distance_bucket     text,
  activity_bucket     text,
  owner_visible       boolean,
  owner_display_name  text,
  owner_avatar_path   text,
  owner_bio           text,
  owner_gender        text,
  owner_age_bucket    text,
  owner_social_open   boolean,
  owner_verified      boolean,
  liked_at            timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_me       profiles%rowtype;
  v_my_pet   pets%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into v_me from profiles where profiles.id = auth.uid();
  select * into v_my_pet from pets where pets.owner_id = auth.uid() and pets.is_active;
  if v_my_pet.id is null then
    return;
  end if;

  return query
  select
    fp.id, fp.owner_id, fp.name, fp.species, fp.breed, fp.birth_date, fp.gender,
    fp.is_neutered, fp.size, fp.energy_level, fp.temperaments,
    fp.good_with_cats, fp.good_with_dogs, fp.good_with_kids, fp.goals, fp.bio,
    fp.city,
    coalesce(
      (
        select array_agg(ph.storage_path order by ph.position)
        from pet_photos ph
        where ph.pet_id = fp.id
      ),
      '{}'
    ),
    distance_bucket(
      case
        when v_my_pet.latitude is null or fp.latitude is null then null
        else haversine_km(v_my_pet.latitude, v_my_pet.longitude, fp.latitude, fp.longitude)
      end
    ),
    activity_bucket(prof.last_active_at),
    (prof.owner_visibility <> 'hidden'),
    case when prof.owner_visibility = 'public' then prof.display_name end,
    case when prof.owner_visibility = 'public' then prof.avatar_url end,
    case when prof.owner_visibility = 'public' then prof.bio end,
    case
      when prof.owner_visibility = 'public'
       and v_me.owner_visibility = 'public'
       and v_me.gender is not null
      then prof.gender
    end,
    case
      when prof.owner_visibility = 'public'
       and v_me.owner_visibility = 'public'
       and v_me.birth_date is not null
       and prof.birth_date is not null
      then owner_age_bucket(prof.birth_date)
    end,
    case when prof.owner_visibility = 'public' then prof.owner_social_open else false end,
    case
      when prof.owner_visibility = 'public'
      then prof.verification_status = 'approved'
      else false
    end,
    s.created_at
  from swipes s
  join pets fp on fp.id = s.from_pet_id
  join profiles prof on prof.id = fp.owner_id
  where s.to_pet_id = v_my_pet.id
    and s.direction = 'like'
    and fp.is_active
    and not is_blocked_between(auth.uid(), fp.owner_id)
    and not exists (
      select 1 from swipes back
      where back.from_pet_id = v_my_pet.id and back.to_pet_id = s.from_pet_id
    )
  order by s.created_at desc
  limit least(coalesce(p_limit, 50), 100);
end;
$$;

revoke all on function pending_likes(integer) from public, anon, authenticated;
grant execute on function pending_likes(integer) to authenticated;
