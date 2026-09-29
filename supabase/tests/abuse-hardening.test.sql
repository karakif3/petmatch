-- Kötüye kullanım ve storage sertleştirmesi (20260929120000).
--
-- Rate limit tetikleyicileri yalnız istek bağlamında çalışır (auth.uid()
-- dolu ve satır o kullanıcıya ait). Bu yüzden bazı kurulumlar `postgres`
-- rolünde ama `act_as` ile yapılıyor: RLS'e takılmadan tetikleyiciyi
-- doğrudan sınıyoruz.

begin;

\echo '  abuse: storage, mesaj kolonları, şikâyet kanıtı, rate limit'

select tests.seed_user('11111111-1111-1111-1111-111111111111');
select tests.seed_user('22222222-2222-2222-2222-222222222222');
select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Tarcin');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Boncuk');

select tests.seed_match(
  'aaaa1111-0000-0000-0000-000000000001',
  'bbbb2222-0000-0000-0000-000000000002'
) as conversation_id \gset

-- --------------------------------------------------------------------------
-- 1–2. Storage
-- --------------------------------------------------------------------------

select tests.assert(
  not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and policyname = 'pet_photos_select_public'
  ),
  'pet-photos listeleme politikası kaldırıldı'
);

select tests.assert(
  (select count(*) from storage.buckets
   where id in ('pet-photos', 'owner-avatars')
     and file_size_limit = 12 * 1024 * 1024
     and 'image/jpeg' = any (allowed_mime_types)
     and not ('application/pdf' = any (allowed_mime_types))) = 2,
  'pet-photos ve owner-avatars boyut + MIME sınırlı'
);

-- --------------------------------------------------------------------------
-- 3. messages kolon yetkisi
-- --------------------------------------------------------------------------

select tests.assert(
  has_column_privilege('authenticated', 'messages', 'body', 'INSERT')
  and has_column_privilege('authenticated', 'messages', 'id', 'INSERT')
  and not has_column_privilege('authenticated', 'messages', 'created_at', 'INSERT')
  and not has_column_privilege('authenticated', 'messages', 'read_at', 'INSERT'),
  'messages: yalnız id/conversation_id/sender_id/body yazılabilir'
);

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

insert into messages (conversation_id, sender_id, body)
values (:'conversation_id', '11111111-1111-1111-1111-111111111111', 'selam');

select tests.assert_raises(
  format(
    'insert into messages (conversation_id, sender_id, body, created_at) values (%L, %L, %L, %L)',
    :'conversation_id', '11111111-1111-1111-1111-111111111111', 'geçmiş', '2020-01-01'
  ),
  'geçmiş tarihli mesaj yazılamaz'
);

select tests.assert_raises(
  format(
    'insert into messages (conversation_id, sender_id, body, read_at) values (%L, %L, %L, now())',
    :'conversation_id', '11111111-1111-1111-1111-111111111111', 'okundu sahtesi'
  ),
  'okundu işaretli mesaj yazılamaz'
);

-- --------------------------------------------------------------------------
-- 5a. Mesaj rate limit: dakikada 30
-- --------------------------------------------------------------------------

-- Yukarıda 1 mesaj var; 29 daha → tam sınır.
insert into messages (conversation_id, sender_id, body)
select :'conversation_id', '11111111-1111-1111-1111-111111111111', 'm' || i
from generate_series(1, 29) as i;

select tests.assert_raises(
  format(
    'insert into messages (conversation_id, sender_id, body) values (%L, %L, %L)',
    :'conversation_id', '11111111-1111-1111-1111-111111111111', 'bir fazla'
  ),
  'dakikada 31. mesaj reddedilir'
);

reset role;
select tests.act_as('22222222-2222-2222-2222-222222222222');

insert into messages (conversation_id, sender_id, body)
values (:'conversation_id', '22222222-2222-2222-2222-222222222222', 'karşı taraf etkilenmez');

select tests.assert(true, 'sınır gönderici başına — karşı taraf yazabiliyor');

-- --------------------------------------------------------------------------
-- 5b. Süper beğeni: günde 20
-- --------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '', true);

do $$
declare
  i int;
  v_user uuid;
  v_pet uuid;
begin
  for i in 1..21 loop
    v_user := ('33333333-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    v_pet := ('cccc3333-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    perform tests.seed_user(v_user);
    perform tests.seed_pet(v_pet, v_user, 'Aday ' || i);
  end loop;
end;
$$;

select tests.act_as('11111111-1111-1111-1111-111111111111');

insert into swipes (from_pet_id, to_pet_id, actor_id, direction, is_super)
select 'aaaa1111-0000-0000-0000-000000000001',
       ('cccc3333-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
       '11111111-1111-1111-1111-111111111111', 'like', true
from generate_series(1, 20) as i;

select tests.assert_raises(
  $$insert into swipes (from_pet_id, to_pet_id, actor_id, direction, is_super)
    values ('aaaa1111-0000-0000-0000-000000000001', 'cccc3333-0000-0000-0000-000000000021',
            '11111111-1111-1111-1111-111111111111', 'like', true)$$,
  'günde 21. süper beğeni reddedilir'
);

insert into swipes (from_pet_id, to_pet_id, actor_id, direction, is_super)
values ('aaaa1111-0000-0000-0000-000000000001', 'cccc3333-0000-0000-0000-000000000021',
        '11111111-1111-1111-1111-111111111111', 'like', false);

select tests.assert(true, 'süper sınırı normal beğeniyi engellemiyor');

-- --------------------------------------------------------------------------
-- 5c. Şikâyet: saatte 10
-- --------------------------------------------------------------------------

insert into moderation_items (kind, created_by, subject_user_id, reason)
select 'report', '11111111-1111-1111-1111-111111111111',
       ('33333333-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid, 'spam'
from generate_series(1, 10) as i;

select tests.assert_raises(
  $$insert into moderation_items (kind, created_by, subject_user_id, reason)
    values ('report', '11111111-1111-1111-1111-111111111111',
            '33333333-0000-0000-0000-000000000011', 'spam')$$,
  'saatte 11. şikâyet reddedilir'
);

-- --------------------------------------------------------------------------
-- 5d. Telemetri: fazlası sessizce düşer
-- --------------------------------------------------------------------------

-- Sıkıştırılamayan 5 KB'lık gövde (md5 zinciri): TOAST sıkıştırması
-- `pg_column_size`'ı sınırın altına çekmesin.
insert into product_events (user_id, event_name, properties)
select '11111111-1111-1111-1111-111111111111', 'discovery_viewed',
       jsonb_build_object('blob', string_agg(md5(i::text), ''))
from generate_series(1, 160) as i;

select tests.assert(
  (select count(*) from product_events
   where user_id = '11111111-1111-1111-1111-111111111111') = 0,
  '4 KB üstü olay gövdesi hata vermeden düşer'
);

insert into product_events (user_id, event_name, properties)
select '11111111-1111-1111-1111-111111111111', 'discovery_viewed', '{}'
from generate_series(1, 125);

select tests.assert(
  (select count(*) from product_events
   where user_id = '11111111-1111-1111-1111-111111111111') = 120,
  'ürün olayı dakikada 120 ile sınırlı, fazlası hata vermeden düşer'
);

-- --------------------------------------------------------------------------
-- 6. Atlanabilen kurallar
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert_raises(
  $$update profiles set birth_date = current_date - interval '10 years'
    where id = '11111111-1111-1111-1111-111111111111'$$,
  '18 yaş altı doğum tarihi doğrudan yazılamaz'
);

select tests.assert_raises(
  $$insert into owner_photos (owner_id, storage_path, position)
    values ('11111111-1111-1111-1111-111111111111',
            '22222222-2222-2222-2222-222222222222/avatar.jpg', 1)$$,
  'başka kullanıcının avatar yolu galeriye yazılamaz'
);

reset role;

select tests.seed_user('44444444-4444-4444-4444-444444444444');
select tests.act_as('44444444-4444-4444-4444-444444444444');

insert into pets (id, owner_id, name, species, gender, city, goals, species_gender_changed_at)
values ('dddd4444-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444',
        'Hileli', 'dog', 'male', 'Istanbul', '{playdate}', '2000-01-01');

select tests.assert(
  (select species_gender_changed_at from pets
   where id = 'dddd4444-0000-0000-0000-000000000004') > now() - interval '1 hour',
  'yeni pette tür/cinsiyet damgası geriye çekilemez'
);

select set_config('request.jwt.claim.sub', '', true);

-- --------------------------------------------------------------------------
-- 4. Şikâyet kanıtı hesap silmeyi atlatır
-- --------------------------------------------------------------------------

insert into moderation_items (kind, created_by, subject_user_id, subject_pet_id, reason)
values ('report', '11111111-1111-1111-1111-111111111111',
        '22222222-2222-2222-2222-222222222222', 'bbbb2222-0000-0000-0000-000000000002',
        'harassment');

insert into moderation_items (kind, created_by, subject_user_id, subject_pet_id)
values ('verification', '22222222-2222-2222-2222-222222222222',
        '22222222-2222-2222-2222-222222222222', 'bbbb2222-0000-0000-0000-000000000002');

delete from auth.users where id = '22222222-2222-2222-2222-222222222222';

select tests.assert(
  (select count(*) from moderation_items
   where kind = 'report'
     and reason = 'harassment'
     and subject_user_id is null
     and subject_user_ref = '22222222-2222-2222-2222-222222222222'
     and subject_pet_ref = 'bbbb2222-0000-0000-0000-000000000002'
     and subject_removed_at is not null) = 1,
  'şikâyet edilen hesabı silince şikâyet ve özne izi kalıyor'
);

select tests.assert(
  (select count(*) from moderation_items
   where kind = 'verification'
     and coalesce(subject_user_ref, created_by) = '22222222-2222-2222-2222-222222222222') = 0,
  'silinen kullanıcının kendi doğrulama kaydı siliniyor'
);

rollback;
