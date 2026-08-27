-- Sahip galerisi (`owner_photos`) ve doğrulamanın profil kapağından
-- ayrılması. Rozet, galeri değişince düşmez.

begin;

\echo '  owner-photos: kapak senkronu, RLS, rozet kopukluğu'

select tests.seed_user('11111111-1111-1111-1111-111111111111', 'male', 'public');
select tests.seed_user('22222222-2222-2222-2222-222222222222', 'female', 'public');
select tests.seed_user('33333333-3333-3333-3333-333333333333', 'female', 'after_match');
select tests.seed_user('44444444-4444-4444-4444-444444444444', 'female', 'hidden');

select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Benim');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Public Pet');
select tests.seed_pet('cccc3333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'AfterMatch Pet');
select tests.seed_pet('dddd4444-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'Hidden Pet');

select tests.assert(
  (select count(*) from owner_photos
    where owner_id = '22222222-2222-2222-2222-222222222222') = 1,
  'seed_user kapak satırını owner_photos''a yazar'
);

update profiles
set verification_status = 'approved', verified_at = now()
where id = '22222222-2222-2222-2222-222222222222';

set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');

select replace_owner_photo_order(array[
  '22222222-2222-2222-2222-222222222222/cover.jpg',
  '22222222-2222-2222-2222-222222222222/two.jpg'
]::text[]);

select tests.assert(
  (select avatar_url from profiles
    where id = '22222222-2222-2222-2222-222222222222')
    = '22222222-2222-2222-2222-222222222222/cover.jpg',
  'replace_owner_photo_order kapağı avatar_url''e yazar'
);

select tests.assert(
  (select verification_status from profiles
    where id = '22222222-2222-2222-2222-222222222222') = 'approved',
  'galeri değişince onaylı rozet durur'
);

select update_my_owner_details(
  'Ayşe', null, '1995-01-01'::date, 'female', 'public',
  '22222222-2222-2222-2222-222222222222/new-cover.jpg',
  false, '{}', null
);

select tests.assert(
  (select verification_status from profiles
    where id = '22222222-2222-2222-2222-222222222222') = 'approved',
  'update_my_owner_details kapak değişince rozeti düşürmez'
);

select tests.assert(
  (select storage_path from owner_photos
    where owner_id = '22222222-2222-2222-2222-222222222222'
      and position = 0)
    = '22222222-2222-2222-2222-222222222222/new-cover.jpg',
  'update_my_owner_details kapağı position 0 olarak yazar'
);

select tests.assert(
  (select count(*) from owner_photos
    where owner_id = '22222222-2222-2222-2222-222222222222') = 2,
  'yeni kapak extras satırlarını (farklı path) silmez'
);

select replace_owner_photo_order(array[
  '22222222-2222-2222-2222-222222222222/a.jpg',
  '22222222-2222-2222-2222-222222222222/b.jpg',
  '22222222-2222-2222-2222-222222222222/c.jpg'
]::text[]);

select tests.assert_raises(
  $q$ select replace_owner_photo_order(array[
        '22222222-2222-2222-2222-222222222222/1.jpg',
        '22222222-2222-2222-2222-222222222222/2.jpg',
        '22222222-2222-2222-2222-222222222222/3.jpg',
        '22222222-2222-2222-2222-222222222222/4.jpg',
        '22222222-2222-2222-2222-222222222222/5.jpg'
      ]::text[]) $q$,
  '5. sahip fotoğrafı reddedilir'
);

select tests.assert_raises(
  $q$ select replace_owner_photo_order(array['someone-else/x.jpg']::text[]) $q$,
  'başkasının klasörüne yol yazılamaz'
);

reset role;

-- Public extras: gizli izleyici de okur (avatar storage ile aynı kural).
set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from owner_photos
    where owner_id = '22222222-2222-2222-2222-222222222222') = 3,
  'public sahibin extras fotoğrafları gizli olmayan izleyiciye açık'
);

reset role;

-- Hidden: yabancı okuyamaz.
insert into owner_photos (owner_id, storage_path, position)
values
  ('44444444-4444-4444-4444-444444444444', '44444444-4444-4444-4444-444444444444/extra.jpg', 1)
on conflict (owner_id, position) do nothing;

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from owner_photos
    where owner_id = '44444444-4444-4444-4444-444444444444') = 0,
  'hidden sahibin galerisi yabancıya kapalı'
);

reset role;

-- after_match: eşleşmeden önce kapalı, sonra açık.
insert into owner_photos (owner_id, storage_path, position)
values
  ('33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333/extra.jpg', 1)
on conflict (owner_id, position) do nothing;

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from owner_photos
    where owner_id = '33333333-3333-3333-3333-333333333333') = 0,
  'after_match galeri eşleşmeden önce kapalı'
);

reset role;

select tests.seed_match(
  'aaaa1111-0000-0000-0000-000000000001',
  'cccc3333-0000-0000-0000-000000000003'
);

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from owner_photos
    where owner_id = '33333333-3333-3333-3333-333333333333') >= 1,
  'after_match galeri eşleşince açılır'
);

reset role;

-- Engellenen public sahip okunamaz.
set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select block_user('22222222-2222-2222-2222-222222222222');

select tests.assert(
  (select count(*) from owner_photos
    where owner_id = '22222222-2222-2222-2222-222222222222') = 0,
  'engellenen public sahibin galerisi görünmez'
);

reset role;

select tests.assert(
  not has_function_privilege('anon', 'replace_owner_photo_order(text[])', 'execute'),
  'anon replace_owner_photo_order çalıştıramaz'
);

rollback;
