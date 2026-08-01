-- Test koşumu için Supabase servislerinin yarattığı tabloların taklidi.
--
-- Gerçek projede bu nesneleri storage-api ve realtime servisleri yaratır;
-- yalın `supabase/postgres` imajında yoklar. `supabase_admin` olarak çalışır
-- çünkü storage ve realtime şemaları o role ait.
--
-- Buradaki hiçbir şey migration DEĞİLDİR ve üretime gitmez.

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets (id),
  name      text not null,
  owner     uuid,
  metadata  jsonb
);

alter table storage.objects enable row level security;

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
as $$
  select string_to_array(name, '/');
$$;

create schema if not exists realtime;

create table if not exists realtime.messages (
  id          uuid primary key default gen_random_uuid(),
  topic       text not null,
  extension   text,
  payload     jsonb,
  event       text,
  private     boolean default false,
  inserted_at timestamptz not null default now()
);

alter table realtime.messages enable row level security;

create or replace function realtime.topic()
returns text
language sql
stable
as $$
  select current_setting('realtime.topic', true);
$$;

grant all on storage.buckets, storage.objects to postgres;
grant all on realtime.messages to postgres;
grant usage on schema realtime to postgres;
