-- Sahip adı onboarding için opsiyoneldir; pet adı ürünün birincil kimliğidir.
-- Profil düzenleme, sahip + aktif pet değişikliklerini tek transaction içinde
-- uygular ve konumu sunucuda da yaklaşık 1 km çözünürlüğe yuvarlar.

alter table profiles
  alter column display_name drop not null;

update profiles
set display_name = null
where display_name = 'Yeni kullanıcı'
  and onboarded_at is null;

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into profiles (id, display_name)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), '')
  )
  on conflict (id) do nothing;

  insert into discovery_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create or replace function mark_onboarding_complete()
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
    from profiles p
    where p.id = auth.uid()
      and p.birth_date is not null
      and p.birth_date <= current_date - interval '18 years'
      and nullif(trim(p.city), '') is not null
  ) then
    raise exception 'owner profile is incomplete' using errcode = '23514';
  end if;

  if not exists (
    select 1
    from pets p
    where p.owner_id = auth.uid()
      and p.is_active
      and exists (select 1 from pet_photos ph where ph.pet_id = p.id)
  ) then
    raise exception 'an active pet with a photo is required' using errcode = '23514';
  end if;

  update profiles
  set onboarded_at = coalesce(onboarded_at, now())
  where id = auth.uid();
end;
$$;

revoke all on function mark_onboarding_complete() from public, anon, authenticated;
grant execute on function mark_onboarding_complete() to authenticated;

create or replace function update_my_profile(
  p_display_name      text,
  p_city              text,
  p_owner_visibility owner_visibility,
  p_pet_name          text,
  p_update_location   boolean,
  p_latitude          double precision,
  p_longitude         double precision
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display_name text := nullif(trim(p_display_name), '');
  v_city         text := nullif(trim(p_city), '');
  v_pet_name     text := nullif(trim(p_pet_name), '');
  v_pet_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if v_display_name is not null and char_length(v_display_name) > 60 then
    raise exception 'display name is too long' using errcode = '22023';
  end if;
  if v_city is null then
    raise exception 'city is required' using errcode = '22023';
  end if;
  if v_pet_name is null or char_length(v_pet_name) > 40 then
    raise exception 'pet name must be between 1 and 40 characters' using errcode = '22023';
  end if;
  if p_update_location and (
    p_latitude is null
    or p_longitude is null
    or p_latitude not between -90 and 90
    or p_longitude not between -180 and 180
  ) then
    raise exception 'valid coordinates are required' using errcode = '22023';
  end if;

  update profiles
  set
    display_name = v_display_name,
    city = v_city,
    owner_visibility = p_owner_visibility
  where id = auth.uid();

  update pets
  set
    name = v_pet_name,
    city = v_city,
    latitude = case
      when p_update_location then round(p_latitude::numeric, 2)::double precision
      else latitude
    end,
    longitude = case
      when p_update_location then round(p_longitude::numeric, 2)::double precision
      else longitude
    end
  where owner_id = auth.uid()
    and is_active
  returning id into v_pet_id;

  if v_pet_id is null then
    raise exception 'active pet not found' using errcode = 'P0002';
  end if;

  return v_pet_id;
end;
$$;

revoke all on function update_my_profile(
  text,
  text,
  owner_visibility,
  text,
  boolean,
  double precision,
  double precision
) from public, anon, authenticated;
grant execute on function update_my_profile(
  text,
  text,
  owner_visibility,
  text,
  boolean,
  double precision,
  double precision
) to authenticated;
