-- PetMatch — temel şema
-- Taşınabilirlik notu: hiçbir yerde proje ref'i / hesap kimliği yok.
-- Bu migration herhangi bir Supabase projesine olduğu gibi uygulanabilir.

-- ---------------------------------------------------------------------------
-- Enum'lar
-- ---------------------------------------------------------------------------

create type species as enum ('cat', 'dog');
create type pet_gender as enum ('male', 'female');
create type pet_size as enum ('small', 'medium', 'large');
create type match_intent as enum ('playdate', 'mating', 'both');
create type owner_visibility as enum ('hidden', 'after_match', 'public');
create type swipe_direction as enum ('like', 'pass');
create type report_reason as enum ('spam', 'harassment', 'fake_profile', 'animal_welfare', 'other');

-- ---------------------------------------------------------------------------
-- profiles — sahip profili (auth.users ile 1:1)
-- ---------------------------------------------------------------------------

create table profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  display_name           text not null check (char_length(trim(display_name)) between 1 and 60),
  avatar_url             text,
  bio                    text check (char_length(bio) <= 500),
  city                   text,
  -- Sahip profilimi karşı tarafa ne zaman göstereyim.
  owner_visibility       owner_visibility not null default 'after_match',
  -- Kullanıcının koyabildiği zorunluluk: sadece sahibi görünen petleri göster.
  require_visible_owner  boolean not null default false,
  onboarded_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- pets
-- ---------------------------------------------------------------------------

create table pets (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references profiles (id) on delete cascade,
  name            text not null check (char_length(trim(name)) between 1 and 40),
  species         species not null,
  breed           text,
  birth_date      date check (birth_date <= current_date),
  gender          pet_gender not null,
  is_neutered     boolean not null default false,
  size            pet_size not null default 'medium',
  energy_level    smallint not null default 3 check (energy_level between 1 and 5),
  temperaments    text[] not null default '{}',
  good_with_cats  boolean not null default false,
  good_with_dogs  boolean not null default false,
  good_with_kids  boolean not null default false,
  intent          match_intent not null default 'playdate',
  bio             text check (char_length(bio) <= 500),
  -- Hassas konum: doğrudan hiçbir istemciye SELECT edilmez, sadece
  -- discover_pets() RPC'si içinde mesafe hesaplamak için okunur.
  latitude        double precision check (latitude between -90 and 90),
  longitude       double precision check (longitude between -180 and 180),
  city            text,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index pets_owner_idx on pets (owner_id);
-- Keşfet sorgusunun bounding-box ön elemesi için.
create index pets_discovery_idx on pets (species, is_active, latitude, longitude);

-- ---------------------------------------------------------------------------
-- pet_photos
-- ---------------------------------------------------------------------------

create table pet_photos (
  id           uuid primary key default gen_random_uuid(),
  pet_id       uuid not null references pets (id) on delete cascade,
  storage_path text not null,
  position     smallint not null default 0 check (position between 0 and 5),
  created_at   timestamptz not null default now(),
  unique (pet_id, position)
);

create index pet_photos_pet_idx on pet_photos (pet_id, position);

-- ---------------------------------------------------------------------------
-- discovery_preferences — keşfet filtreleri (kullanıcı başına tek satır)
-- ---------------------------------------------------------------------------

create table discovery_preferences (
  user_id               uuid primary key references profiles (id) on delete cascade,
  species               species[] not null default '{cat,dog}',
  intents               match_intent[] not null default '{playdate}',
  max_distance_km       integer not null default 25 check (max_distance_km between 1 and 500),
  min_age_years         numeric(4, 1) check (min_age_years >= 0),
  max_age_years         numeric(4, 1) check (max_age_years >= 0),
  require_visible_owner boolean not null default false,
  notify_on_match       boolean not null default true,
  notify_on_message     boolean not null default true,
  language              text not null default 'tr',
  updated_at            timestamptz not null default now(),
  check (min_age_years is null or max_age_years is null or min_age_years <= max_age_years)
);

-- ---------------------------------------------------------------------------
-- swipes
-- ---------------------------------------------------------------------------

create table swipes (
  id           uuid primary key default gen_random_uuid(),
  from_pet_id  uuid not null references pets (id) on delete cascade,
  to_pet_id    uuid not null references pets (id) on delete cascade,
  actor_id     uuid not null references profiles (id) on delete cascade,
  direction    swipe_direction not null,
  created_at   timestamptz not null default now(),
  unique (from_pet_id, to_pet_id),
  check (from_pet_id <> to_pet_id)
);

create index swipes_to_pet_idx on swipes (to_pet_id, direction);
create index swipes_from_pet_idx on swipes (from_pet_id);

-- ---------------------------------------------------------------------------
-- matches
--
-- pet_a_id < pet_b_id kuralı zorunlu: aynı çiftin iki kez kaydedilmesini
-- unique index ile engellemenin en ucuz yolu.
-- ---------------------------------------------------------------------------

create table matches (
  id          uuid primary key default gen_random_uuid(),
  pet_a_id    uuid not null references pets (id) on delete cascade,
  pet_b_id    uuid not null references pets (id) on delete cascade,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (pet_a_id, pet_b_id),
  check (pet_a_id < pet_b_id)
);

create index matches_pet_a_idx on matches (pet_a_id);
create index matches_pet_b_idx on matches (pet_b_id);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

create table messages (
  id         uuid primary key default gen_random_uuid(),
  match_id   uuid not null references matches (id) on delete cascade,
  sender_id  uuid not null references profiles (id) on delete cascade,
  body       text not null check (char_length(trim(body)) between 1 and 2000),
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index messages_match_idx on messages (match_id, created_at desc);

-- ---------------------------------------------------------------------------
-- blocks / reports
-- ---------------------------------------------------------------------------

create table blocks (
  blocker_id uuid not null references profiles (id) on delete cascade,
  blocked_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references profiles (id) on delete cascade,
  reported_user_id uuid references profiles (id) on delete cascade,
  reported_pet_id  uuid references pets (id) on delete cascade,
  reason           report_reason not null,
  note             text check (char_length(note) <= 1000),
  created_at       timestamptz not null default now(),
  check (reported_user_id is not null or reported_pet_id is not null)
);

-- ---------------------------------------------------------------------------
-- push_tokens
-- ---------------------------------------------------------------------------

create table push_tokens (
  token      text primary key,
  user_id    uuid not null references profiles (id) on delete cascade,
  platform   text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now()
);

create index push_tokens_user_idx on push_tokens (user_id);

-- ---------------------------------------------------------------------------
-- updated_at tetikleyicisi
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger pets_updated_at before update on pets
  for each row execute function set_updated_at();
create trigger discovery_preferences_updated_at before update on discovery_preferences
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Yeni kullanıcı → boş profil + varsayılan tercihler
-- ---------------------------------------------------------------------------

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
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Yeni kullanıcı')
  )
  on conflict (id) do nothing;

  insert into discovery_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
