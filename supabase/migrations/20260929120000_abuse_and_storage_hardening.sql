-- Kötüye kullanım ve storage sertleştirmesi (2026-09-29 denetimi)
--
-- Dosya adı neden zaman damgalı: `2026…` önekli üç migration yerel sırada
-- `0068`'den SONRA çalışıyor. `0069_*` adı temiz kurulumda bu dosyayı
-- `20260827144529`'dan ÖNCE koşturur; oradaki fonksiyon yeniden tanımları
-- bizimkini ezebilirdi. Bundan sonra migration'lar zaman damgasıyla açılır.
--
-- Kapsam:
--   1. pet-photos: anon/authenticated LIST yetkisi kaldırılır
--   2. pet-photos + owner-avatars: boyut ve MIME sınırı
--   3. messages: istemci yalnızca id/conversation_id/sender_id/body yazar
--   4. moderation_items: şikâyet kanıtı hesap silmeyle yok olmaz
--   5. Rate limit: mesaj, swipe, süper beğeni, şikâyet, olay/hata kütüğü
--   6. Profil/pet yazma yollarında atlanabilen kurallar
--   7. Eksik FK index'leri

-- ---------------------------------------------------------------------------
-- 1. pet-photos listeleme
--
-- Bucket public; `/object/public/…` URL'leri RLS'e hiç uğramıyor. Bu SELECT
-- politikası yalnızca `list` API'sini açıyordu — anon, `<uid>/<pet_id>/`
-- yollarını tarayıp pasif veya gizli kullanıcıların fotoğraflarını
-- bulabiliyordu. İstemci her yerde `getPublicUrl` kullanıyor; kendi
-- dosyasını görmek için `pet_photos_select_own` yeterli (upsert dahil).
-- ---------------------------------------------------------------------------

drop policy if exists pet_photos_select_public on storage.objects;

-- ---------------------------------------------------------------------------
-- 2. Boyut + MIME
--
-- Sınır 12 MB: istemci fotoğrafı yeniden boyutlandırmıyor (yalnızca
-- `quality: 0.85`), yeni iPhone'ların tam çözünürlüklü JPEG'i 6 MB'ı
-- aşabiliyor. Asıl koruma MIME listesi — bucket'lar dosya barındırma
-- servisine dönüşmesin.
-- ---------------------------------------------------------------------------

update storage.buckets
set
  file_size_limit = 12 * 1024 * 1024,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp'
  ]
where id in ('pet-photos', 'owner-avatars');

-- ---------------------------------------------------------------------------
-- 3. messages kolon yetkisi
--
-- Satır politikası "hangi konuşma" sorusunu yanıtlıyordu, "hangi kolon"
-- sorusunu değil: istemci geçmiş tarihli `created_at` (sırayı ve "sıra
-- sende" sinyalini bozar) ya da dolu `read_at` (karşı tarafta okunmamış
-- rozeti hiç çıkmaz) yazabiliyordu. `id` bilerek açık: istemci UUID üretip
-- aynı mesajı güvenle yeniden deneyebilsin.
-- ---------------------------------------------------------------------------

revoke insert on table messages from anon, authenticated;
grant insert (id, conversation_id, sender_id, body) on table messages to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Şikâyet kanıtı
--
-- `subject_*` FK'leri cascade'di: şikâyet edilen kullanıcı hesabını silince
-- aleyhindeki kayıt da siliniyordu. Artık şikâyet satırı kalır, özne alanı
-- null'a düşer, eski kimlik `subject_*_ref` içinde saklanır.
--
-- Şikâyet DIŞI kayıtlar (doğrulama, fotoğraf) kullanıcıyla birlikte silinir:
-- onlar kullanıcının kendi verisi, saklamak için meşru amaç yok.
-- ---------------------------------------------------------------------------

alter table moderation_items
  add column if not exists subject_user_ref uuid,
  add column if not exists subject_pet_ref uuid,
  add column if not exists subject_removed_at timestamptz;

comment on column moderation_items.subject_user_ref is
  'Özne hesabı silindiğinde eski profil id''si (FK yok, yalnız denetim izi).';

do $$
declare
  v_name text;
begin
  -- 0010'daki isimsiz check'in adı sürüme göre değişebilir; tanımından bul.
  for v_name in
    select conname
    from pg_constraint
    where conrelid = 'moderation_items'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%subject_user_id IS NOT NULL%subject_pet_id IS NOT NULL%'
  loop
    execute format('alter table moderation_items drop constraint %I', v_name);
  end loop;

  for v_name in
    select conname
    from pg_constraint
    where conrelid = 'moderation_items'::regclass
      and contype = 'f'
      and conkey && array[
        (select attnum from pg_attribute
          where attrelid = 'moderation_items'::regclass and attname = 'subject_user_id'),
        (select attnum from pg_attribute
          where attrelid = 'moderation_items'::regclass and attname = 'subject_pet_id')
      ]::smallint[]
  loop
    execute format('alter table moderation_items drop constraint %I', v_name);
  end loop;
end;
$$;

alter table moderation_items
  add constraint moderation_items_subject_user_id_fkey
    foreign key (subject_user_id) references profiles (id) on delete set null,
  add constraint moderation_items_subject_pet_id_fkey
    foreign key (subject_pet_id) references pets (id) on delete set null,
  add constraint moderation_items_subject_present check (
    subject_user_id is not null
    or subject_pet_id is not null
    or subject_removed_at is not null
  );

-- FK'nin SET NULL'u sıradan bir UPDATE olarak çalışır; BEFORE trigger'ı
-- check'ten önce koşar ve izi yazar.
create or replace function moderation_items_keep_subject_trail()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.subject_user_id is not null and new.subject_user_id is null then
    new.subject_user_ref := coalesce(new.subject_user_ref, old.subject_user_id);
    new.subject_removed_at := coalesce(new.subject_removed_at, now());
  end if;
  if old.subject_pet_id is not null and new.subject_pet_id is null then
    new.subject_pet_ref := coalesce(new.subject_pet_ref, old.subject_pet_id);
    new.subject_removed_at := coalesce(new.subject_removed_at, now());
  end if;
  return new;
end;
$$;

drop trigger if exists moderation_items_keep_subject_trail on moderation_items;
create trigger moderation_items_keep_subject_trail
  before update of subject_user_id, subject_pet_id on moderation_items
  for each row
  execute function moderation_items_keep_subject_trail();

create or replace function profiles_purge_own_moderation_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from moderation_items
  where kind <> 'report'
    and (
      subject_user_id = old.id
      or subject_pet_id in (select p.id from pets p where p.owner_id = old.id)
    );
  return old;
end;
$$;

drop trigger if exists profiles_purge_own_moderation_items on profiles;
create trigger profiles_purge_own_moderation_items
  before delete on profiles
  for each row
  execute function profiles_purge_own_moderation_items();

revoke all on function moderation_items_keep_subject_trail() from public, anon, authenticated;
revoke all on function profiles_purge_own_moderation_items() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Rate limit
--
-- Sınırlar kötüye kullanım içindir, ürün kotası değil: normal kullanıcı
-- hiçbirine yaklaşmaz. Süper beğeni günlük sınırı bir monetizasyon kararı
-- DEĞİL (o hâlâ açık, backlog "Kararı bekleyenler") — her süper beğeni push
-- tetiklediği için spam tavanı.
--
-- Yalnızca istek bağlamında (auth.uid() dolu, satır o kullanıcıya ait)
-- uygulanır; migration, seed ve service_role yazmaları serbest.
--
-- Hata metni `rate_limited:<alan>` — istemci bunu Türkçe cümleye çevirir.
-- ---------------------------------------------------------------------------

create index if not exists messages_sender_created_idx
  on messages (sender_id, created_at desc);
create index if not exists swipes_actor_created_idx
  on swipes (actor_id, created_at desc);
create index if not exists moderation_items_created_by_created_idx
  on moderation_items (created_by, created_at desc);
create index if not exists product_events_user_created_idx
  on product_events (user_id, created_at desc);
create index if not exists client_errors_user_created_idx
  on client_errors (user_id, created_at desc);

create or replace function messages_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or new.sender_id is distinct from v_uid then
    return new;
  end if;

  if (select count(*) from messages
      where sender_id = v_uid and created_at > now() - interval '1 minute') >= 30
  or (select count(*) from messages
      where sender_id = v_uid and created_at > now() - interval '1 day') >= 1000
  then
    raise exception 'rate_limited:messages' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists messages_rate_limit on messages;
create trigger messages_rate_limit
  before insert on messages
  for each row
  execute function messages_rate_limit();

create or replace function swipes_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or new.actor_id is distinct from v_uid then
    return new;
  end if;

  if (select count(*) from swipes
      where actor_id = v_uid and created_at > now() - interval '1 minute') >= 120
  or (select count(*) from swipes
      where actor_id = v_uid and created_at > now() - interval '1 day') >= 3000
  then
    raise exception 'rate_limited:swipes' using errcode = 'P0001';
  end if;

  if new.is_super and (
    select count(*) from swipes
    where actor_id = v_uid and is_super and created_at > now() - interval '1 day'
  ) >= 20 then
    raise exception 'rate_limited:super_likes' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists swipes_rate_limit on swipes;
create trigger swipes_rate_limit
  before insert on swipes
  for each row
  execute function swipes_rate_limit();

create or replace function moderation_reports_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or new.kind <> 'report' or new.created_by is distinct from v_uid then
    return new;
  end if;

  if (select count(*) from moderation_items
      where created_by = v_uid and kind = 'report'
        and created_at > now() - interval '1 hour') >= 10
  or (select count(*) from moderation_items
      where created_by = v_uid and kind = 'report'
        and created_at > now() - interval '1 day') >= 30
  then
    raise exception 'rate_limited:reports' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists moderation_reports_rate_limit on moderation_items;
create trigger moderation_reports_rate_limit
  before insert on moderation_items
  for each row
  execute function moderation_reports_rate_limit();

-- Olay ve hata kütükleri: hata FIRLATMAZ, fazlayı sessizce düşürür.
-- İstemci bu çağrıları zaten fire-and-forget yapıyor; analitik taşması
-- kullanıcı akışını bozmamalı.
create or replace function telemetry_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_recent bigint;
begin
  if v_uid is null or new.user_id is distinct from v_uid then
    return new;
  end if;

  if tg_table_name = 'product_events' then
    if pg_column_size(new.properties) > 4096 then
      return null;
    end if;
    select count(*) into v_recent from product_events
    where user_id = v_uid and created_at > now() - interval '1 minute';
    if v_recent >= 120 then
      return null;
    end if;
  else
    select count(*) into v_recent from client_errors
    where user_id = v_uid and created_at > now() - interval '1 minute';
    if v_recent >= 30 then
      return null;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists product_events_rate_limit on product_events;
create trigger product_events_rate_limit
  before insert on product_events
  for each row
  execute function telemetry_rate_limit();

drop trigger if exists client_errors_rate_limit on client_errors;
create trigger client_errors_rate_limit
  before insert on client_errors
  for each row
  execute function telemetry_rate_limit();

revoke all on function messages_rate_limit() from public, anon, authenticated;
revoke all on function swipes_rate_limit() from public, anon, authenticated;
revoke all on function moderation_reports_rate_limit() from public, anon, authenticated;
revoke all on function telemetry_rate_limit() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Atlanabilen kurallar
-- ---------------------------------------------------------------------------

-- 6a. 18+ yalnızca RPC'de ve onboarding'de kontrol ediliyordu; `birth_date`
-- kolon grant'ında açık olduğu için PostgREST ile doğrudan yazılabiliyordu.
create or replace function profiles_enforce_adult_birth_date()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.birth_date is not null
     and new.birth_date is distinct from old.birth_date
     and new.birth_date > (current_date - interval '18 years')::date then
    raise exception 'owner must be 18 or older' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_adult_birth_date on profiles;
create trigger profiles_enforce_adult_birth_date
  before update of birth_date on profiles
  for each row
  execute function profiles_enforce_adult_birth_date();

revoke all on function profiles_enforce_adult_birth_date() from public, anon, authenticated;

-- 6b. 0067'nin tür/cinsiyet kilidi INSERT'te atlanabiliyordu:
-- `species_gender_changed_at = '2000-01-01'` ile açılan pet hemen tür
-- değiştirebiliyordu. İstek bağlamında damga her zaman kayıt anıdır.
create or replace function pets_stamp_species_gender_on_insert()
returns trigger
language plpgsql
as $$
begin
  if auth.uid() is not null then
    new.species_gender_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists pets_stamp_species_gender_on_insert on pets;
create trigger pets_stamp_species_gender_on_insert
  before insert on pets
  for each row
  execute function pets_stamp_species_gender_on_insert();

revoke all on function pets_stamp_species_gender_on_insert() from public, anon, authenticated;

-- 6c. Metin alanlarında uzunluk sınırı yoktu. NOT VALID: mevcut satırlar
-- migration'ı düşürmesin, yeni yazmalar sınırlansın.
alter table pets
  add constraint pets_breed_length check (char_length(breed) <= 80) not valid,
  add constraint pets_city_length check (char_length(city) <= 80) not valid;
alter table profiles
  add constraint profiles_city_length check (char_length(city) <= 80) not valid;

-- 6d. Fotoğraf satırları başka kullanıcının Storage yolunu gösteremez.
-- Doğrudan yazma açık kaldığı için (RPC'ler definer, bunlardan etkilenmez)
-- RESTRICTIVE politika: mevcut izinlerle AND'lenir.
drop policy if exists owner_photos_path_own on owner_photos;
create policy owner_photos_path_own on owner_photos
  as restrictive
  for all to authenticated
  using (true)
  with check (storage_path like (select auth.uid())::text || '/%');

drop policy if exists pet_photos_path_own on pet_photos;
create policy pet_photos_path_own on pet_photos
  as restrictive
  for all to authenticated
  using (true)
  with check (storage_path like (select auth.uid())::text || '/%');

-- ---------------------------------------------------------------------------
-- 7. FK index'leri
--
-- `moderation_items.subject_*` artık SET NULL; index olmadan her profil
-- silmesi tabloyu baştan sona tarar.
-- ---------------------------------------------------------------------------

create index if not exists moderation_items_subject_user_idx
  on moderation_items (subject_user_id) where subject_user_id is not null;
create index if not exists moderation_items_subject_pet_idx
  on moderation_items (subject_pet_id) where subject_pet_id is not null;
create index if not exists meetups_proposed_by_idx on meetups (proposed_by);
create index if not exists meetups_place_idx on meetups (place_id);
create index if not exists adoption_interests_conversation_idx
  on adoption_interests (conversation_id) where conversation_id is not null;
