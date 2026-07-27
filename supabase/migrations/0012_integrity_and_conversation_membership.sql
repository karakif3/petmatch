-- Bütünlük ve yazma yolu sertleştirmesi
--
-- 1. RLS satırı korur, kolonu değil: kullanıcı kendi doğrulama durumunu
--    değiştirememeli.
-- 2. adoption_interests UPDATE politikası yalnızca "withdraw" niyetindeydi
--    ama satırdaki her kolonu değiştirmeye izin veriyordu.
-- 3. Konuşma üyeliği petin GÜNCEL sahibinden türetiliyordu. Pet devredilince
--    yeni sahip eski konuşmaları görür, eski sahip kendi geçmişini kaybederdi.
-- 4. Tek aktif pet kararı yalnızca istemci davranışı değil DB invariant'ı olur.
-- 5. require_visible_owner tek kaynağa (profiles) indirilir.

-- ---------------------------------------------------------------------------
-- 1. Kolon düzeyi yazma yetkileri
-- ---------------------------------------------------------------------------

revoke update on table profiles from anon, authenticated;
grant update (
  display_name,
  avatar_url,
  bio,
  city,
  owner_visibility,
  require_visible_owner,
  birth_date,
  gender,
  last_active_at
) on table profiles to authenticated;

-- owner_id, id ve sistem kolonları istemciden değiştirilemez.
revoke update on table pets from anon, authenticated;
grant update (
  name,
  species,
  breed,
  birth_date,
  gender,
  is_neutered,
  size,
  energy_level,
  temperaments,
  good_with_cats,
  good_with_dogs,
  good_with_kids,
  goals,
  bio,
  latitude,
  longitude,
  city,
  is_active
) on table pets to authenticated;

-- Onboarding tamamlanması ayrı, doğrulanabilir bir yazma yoludur.
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
      and nullif(trim(p.display_name), '') is not null
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

-- ---------------------------------------------------------------------------
-- 2. Başvuru geri çekme yalnızca RPC ile
-- ---------------------------------------------------------------------------

drop policy if exists adoption_interests_withdraw on adoption_interests;

create or replace function withdraw_adoption_interest(p_interest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update adoption_interests
  set status = 'withdrawn'
  where id = p_interest_id
    and applicant_id = auth.uid()
    and status = 'pending';

  if not found then
    raise exception 'pending adoption interest not found' using errcode = '42501';
  end if;
end;
$$;

revoke all on function withdraw_adoption_interest(uuid) from public, anon, authenticated;
grant execute on function withdraw_adoption_interest(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Konuşma katılımcıları sahiplikten bağımsız, kalıcı üyelik
-- ---------------------------------------------------------------------------

create table conversation_participants (
  conversation_id uuid not null references conversations (id) on delete cascade,
  user_id         uuid not null references profiles (id) on delete cascade,
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_participants_user_idx
  on conversation_participants (user_id, conversation_id);

-- Mevcut eşleşme ve sahiplendirme konuşmalarını geriye dönük doldur.
insert into conversation_participants (conversation_id, user_id)
select distinct source.conversation_id, source.user_id
from (
  select m.conversation_id, p.owner_id as user_id
  from matches m
  join pets p on p.id in (m.pet_a_id, m.pet_b_id)
  where m.conversation_id is not null

  union

  select ai.conversation_id, ai.applicant_id
  from adoption_interests ai
  where ai.conversation_id is not null

  union

  select ai.conversation_id, p.owner_id
  from adoption_interests ai
  join pets p on p.id = ai.pet_id
  where ai.conversation_id is not null
) source
on conflict do nothing;

alter table conversation_participants enable row level security;
revoke all on table conversation_participants from anon, authenticated;

create or replace function my_conversation_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(cp.conversation_id), '{}')
  from conversation_participants cp
  where cp.user_id = auth.uid();
$$;

revoke all on function my_conversation_ids() from public, anon, authenticated;
grant execute on function my_conversation_ids() to authenticated;

-- Yeni eşleşmede iki mevcut sahibi katılımcı olarak dondur.
create or replace function open_match_conversation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  insert into conversations (kind)
  values ('match')
  returning id into v_conversation_id;

  update matches
  set conversation_id = v_conversation_id
  where id = new.id;

  insert into conversation_participants (conversation_id, user_id)
  select v_conversation_id, p.owner_id
  from pets p
  where p.id in (new.pet_a_id, new.pet_b_id)
  on conflict do nothing;

  return new;
end;
$$;

revoke all on function open_match_conversation() from public, anon, authenticated;

-- Kabul edilen sahiplendirme başvurusunda ilan sahibi + başvuran konuşur.
create or replace function respond_to_adoption_interest(
  p_interest_id uuid,
  p_accept boolean
)
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
  select ai.* into v_interest
  from adoption_interests ai
  where ai.id = p_interest_id;

  select p.owner_id into v_owner
  from pets p
  where p.id = v_interest.pet_id;

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

  insert into conversations (kind)
  values ('adoption')
  returning id into v_conv;

  insert into conversation_participants (conversation_id, user_id)
  values
    (v_conv, v_owner),
    (v_conv, v_interest.applicant_id)
  on conflict do nothing;

  update adoption_interests
  set status = 'accepted', responded_at = now(), conversation_id = v_conv
  where id = p_interest_id;

  return v_conv;
end;
$$;

revoke all on function respond_to_adoption_interest(uuid, boolean)
  from public, anon, authenticated;
grant execute on function respond_to_adoption_interest(uuid, boolean)
  to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Tek aktif pet + güvenli sahiplik devri
-- ---------------------------------------------------------------------------

-- Eski veride birden fazla aktif pet varsa en son güncelleneni aktif bırak.
with ranked as (
  select
    id,
    row_number() over (
      partition by owner_id
      order by updated_at desc, created_at desc, id desc
    ) as position
  from pets
  where is_active
)
update pets p
set is_active = false
from ranked r
where p.id = r.id and r.position > 1;

create unique index pets_one_active_per_owner_idx
  on pets (owner_id)
  where is_active;

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
  select ai.* into v_interest
  from adoption_interests ai
  where ai.id = p_interest_id;

  select p.owner_id into v_owner
  from pets p
  where p.id = v_interest.pet_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not the listing owner' using errcode = '42501';
  end if;
  if v_interest.status <> 'accepted' then
    raise exception 'interest not accepted' using errcode = '42501';
  end if;

  update conversations
  set is_active = false
  where id in (
    select m.conversation_id
    from matches m
    where m.pet_a_id = v_interest.pet_id or m.pet_b_id = v_interest.pet_id
    union
    select ai.conversation_id
    from adoption_interests ai
    where ai.pet_id = v_interest.pet_id
  );

  update matches
  set is_active = false
  where pet_a_id = v_interest.pet_id or pet_b_id = v_interest.pet_id;

  delete from swipes
  where from_pet_id = v_interest.pet_id or to_pet_id = v_interest.pet_id;

  update adoption_interests
  set status = 'declined', responded_at = now()
  where pet_id = v_interest.pet_id and status = 'pending';

  -- Yeni sahibin önceki aktif peti arşivlenir. Konuşma katılımcıları artık
  -- sahiplikten bağımsız olduğu için eski sohbetlerin üyeliği değişmez.
  update pets
  set is_active = false
  where owner_id = v_interest.applicant_id and is_active;

  update pets
  set owner_id = v_interest.applicant_id,
      goals = '{playdate}',
      is_active = true
  where id = v_interest.pet_id;
end;
$$;

revoke all on function complete_adoption(uuid) from public, anon, authenticated;
grant execute on function complete_adoption(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Sahip görünürlüğü zorunluluğunda tek kaynak: profiles
-- ---------------------------------------------------------------------------

-- İki eski kopyadan biri true ise kullanıcının tercihini kaybetme.
update profiles p
set require_visible_owner = p.require_visible_owner or d.require_visible_owner
from discovery_preferences d
where d.user_id = p.id;

alter table discovery_preferences drop column require_visible_owner;

create or replace function discover_pets(
  p_pet_id          uuid,
  p_owner_genders   text[] default null,
  p_owner_min_age   integer default null,
  p_owner_max_age   integer default null,
  p_limit           integer default 50
)
returns table (
  id              uuid,
  owner_id        uuid,
  name            text,
  species         species,
  breed           text,
  birth_date      date,
  gender          pet_gender,
  is_neutered     boolean,
  size            pet_size,
  energy_level    smallint,
  temperaments    text[],
  good_with_cats  boolean,
  good_with_dogs  boolean,
  good_with_kids  boolean,
  goals           match_goal[],
  bio             text,
  city            text,
  photo_paths     text[],
  distance_bucket text,
  activity_bucket text,
  owner_visible   boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer  pets%rowtype;
  v_me      profiles%rowtype;
  v_prefs   discovery_preferences%rowtype;
  v_blocked uuid[];
  v_lat_pad double precision;
  v_lon_pad double precision;
begin
  if not owns_pet(p_pet_id) then
    raise exception 'not authorized for pet %', p_pet_id using errcode = '42501';
  end if;

  select * into v_viewer from pets where pets.id = p_pet_id;
  select * into v_me from profiles where profiles.id = v_viewer.owner_id;
  select * into v_prefs from discovery_preferences where user_id = v_viewer.owner_id;

  if p_owner_genders is not null and v_me.gender is null then
    raise exception 'gender filter requires disclosing your own gender'
      using errcode = '42501';
  end if;
  if (p_owner_min_age is not null or p_owner_max_age is not null)
     and v_me.birth_date is null then
    raise exception 'age filter requires disclosing your own age'
      using errcode = '42501';
  end if;

  v_blocked := blocked_user_ids();
  v_lat_pad := v_prefs.max_distance_km / 111.0;
  v_lon_pad := v_prefs.max_distance_km
    / greatest(1.0, 111.0 * cos(radians(coalesce(v_viewer.latitude, 0))));

  return query
  with candidates as (
    select
      p.*,
      prof.owner_visibility,
      prof.avatar_url,
      prof.last_active_at,
      case
        when v_viewer.latitude is null or p.latitude is null then null
        else haversine_km(
          v_viewer.latitude,
          v_viewer.longitude,
          p.latitude,
          p.longitude
        )
      end as km
    from pets p
    join profiles prof on prof.id = p.owner_id
    where p.is_active
      and p.owner_id <> v_viewer.owner_id
      and p.species = any (v_prefs.species)
      and p.goals && v_viewer.goals
      and not exists (
        select 1
        from swipes s
        where s.from_pet_id = p_pet_id and s.to_pet_id = p.id
      )
      and p.owner_id <> all (v_blocked)
      and (
        p.birth_date is null
        or (
          (
            v_prefs.min_age_years is null
            or p.birth_date
              <= current_date - (v_prefs.min_age_years * 365.25)::integer
          )
          and (
            v_prefs.max_age_years is null
            or p.birth_date
              >= current_date - (v_prefs.max_age_years * 365.25)::integer
          )
        )
      )
      -- Tek kaynaktan çift yönlü kural.
      and (not v_me.require_visible_owner or prof.owner_visibility <> 'hidden')
      and (
        not prof.require_visible_owner
        or v_me.owner_visibility <> 'hidden'
      )
      and (
        not v_prefs.require_owner_photo
        or (prof.avatar_url is not null and prof.owner_visibility <> 'hidden')
      )
      and (
        p_owner_genders is null
        or (
          prof.gender = any (p_owner_genders)
          and prof.owner_visibility <> 'hidden'
        )
      )
      and (
        p_owner_min_age is null
        or (
          prof.birth_date is not null
          and prof.birth_date
            <= current_date - (p_owner_min_age || ' years')::interval
        )
      )
      and (
        p_owner_max_age is null
        or (
          prof.birth_date is not null
          and prof.birth_date
            >= current_date - ((p_owner_max_age + 1) || ' years')::interval
        )
      )
      and (
        v_viewer.latitude is null
        or p.latitude is null
        or (
          p.latitude
            between v_viewer.latitude - v_lat_pad
            and v_viewer.latitude + v_lat_pad
          and p.longitude
            between v_viewer.longitude - v_lon_pad
            and v_viewer.longitude + v_lon_pad
          and haversine_km(
            v_viewer.latitude,
            v_viewer.longitude,
            p.latitude,
            p.longitude
          ) <= v_prefs.max_distance_km
        )
      )
  )
  select
    c.id,
    c.owner_id,
    c.name,
    c.species,
    c.breed,
    c.birth_date,
    c.gender,
    c.is_neutered,
    c.size,
    c.energy_level,
    c.temperaments,
    c.good_with_cats,
    c.good_with_dogs,
    c.good_with_kids,
    c.goals,
    c.bio,
    c.city,
    coalesce(
      (
        select array_agg(ph.storage_path order by ph.position)
        from pet_photos ph
        where ph.pet_id = c.id
      ),
      '{}'
    ),
    distance_bucket(c.km),
    activity_bucket(c.last_active_at),
    (c.owner_visibility <> 'hidden')
  from candidates c
  order by c.km asc nulls last
  limit least(coalesce(p_limit, 50), 100);
end;
$$;
