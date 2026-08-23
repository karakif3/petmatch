-- Keşfet coğrafyası: seçilen bölge = arama havuzu.
--
-- Hipotez doğrulandı (0057 öncesi): `discover_pets` / `discover_playdate_pets`
-- `region_slug` bakmıyordu; mesafe yalnızca iki tarafın da koordinatı varken
-- uygulanıyordu. Sahip segmenti ayrı RPC değil (istemci destesini süzer).
-- `pending_likes` / `swipe_pet` aynı deliğe sahipti.

begin;

\echo '  discovery: bölge izolasyonu'

select tests.seed_user('11111111-1111-1111-1111-111111111111'); -- Kadıköy bakan
select tests.seed_user('22222222-2222-2222-2222-222222222222'); -- Kadıköy aday
select tests.seed_user('33333333-3333-3333-3333-333333333333'); -- Nişantaşı
select tests.seed_user('44444444-4444-4444-4444-444444444444'); -- Beşiktaş
select tests.seed_user('55555555-5555-5555-5555-555555555555'); -- bekleme listesi
select tests.seed_user('66666666-6666-6666-6666-666666666666'); -- bölge seçmemiş
select tests.seed_user('77777777-7777-7777-7777-777777777777'); -- Kadıköy, koordinatsız
select tests.seed_user('88888888-8888-8888-8888-888888888888'); -- Kadıköy, uzak koordinat

select tests.assign_region('11111111-1111-1111-1111-111111111111', 'kadikoy');
select tests.assign_region('22222222-2222-2222-2222-222222222222', 'kadikoy');
select tests.assign_region('33333333-3333-3333-3333-333333333333', 'nisantasi');
select tests.assign_region('44444444-4444-4444-4444-444444444444', 'besiktas');
select tests.assign_region('55555555-5555-5555-5555-555555555555', 'other');
select tests.assign_region('77777777-7777-7777-7777-777777777777', 'kadikoy');
select tests.assign_region('88888888-8888-8888-8888-888888888888', 'kadikoy');

select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Ada');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Karam');
select tests.seed_pet('cccc3333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Mira');
select tests.seed_pet('dddd4444-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'Zeytin');
select tests.seed_pet('eeee5555-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555', 'Pati');
select tests.seed_pet('ffff6666-0000-0000-0000-000000000006', '66666666-6666-6666-6666-666666666666', 'Bulut');
select tests.seed_pet('aaaa7777-0000-0000-0000-000000000007', '77777777-7777-7777-7777-777777777777', 'Toprak');
select tests.seed_pet('bbbb8888-0000-0000-0000-000000000008', '88888888-8888-8888-8888-888888888888', 'Ankara');

-- Aynı İstanbul koordinatı: mesafe filtresi bölgeyi kurtarmaz.
-- Koordinatsız Kadıköy peti destede kalmalı; uzak Kadıköy peti elenmeli.
update pets
set latitude = null, longitude = null
where id = 'aaaa7777-0000-0000-0000-000000000007';

update pets
set latitude = 39.93, longitude = 32.86
where id = 'bbbb8888-0000-0000-0000-000000000008';

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  exists (
    select 1 from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
    where id = 'bbbb2222-0000-0000-0000-000000000002'
  ),
  'aynı bölgedeki pet destede'
);

select tests.assert(
  not exists (
    select 1 from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
    where id = 'cccc3333-0000-0000-0000-000000000003'
  ),
  'Nişantaşı peti Kadıköy destesine girmiyor'
);

select tests.assert(
  not exists (
    select 1 from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
    where id = 'dddd4444-0000-0000-0000-000000000004'
  ),
  'Beşiktaş peti Kadıköy destesine girmiyor'
);

select tests.assert(
  not exists (
    select 1 from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
    where id = 'eeee5555-0000-0000-0000-000000000005'
  ),
  'bekleme listesi peti pilot destede yok'
);

select tests.assert(
  not exists (
    select 1 from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
    where id = 'ffff6666-0000-0000-0000-000000000006'
  ),
  'bölgesi boş kullanıcı destede yok'
);

select tests.assert(
  exists (
    select 1 from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
    where id = 'aaaa7777-0000-0000-0000-000000000007'
  ),
  'aynı bölgede koordinatsız aday mesafeden bağımsız görünür'
);

select tests.assert(
  (
    select distance_bucket
    from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
    where id = 'aaaa7777-0000-0000-0000-000000000007'
  ) is null,
  'koordinatsız adayda mesafe kovası yok'
);

select tests.assert(
  not exists (
    select 1 from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
    where id = 'bbbb8888-0000-0000-0000-000000000008'
  ),
  'aynı bölgede uzak koordinatlı aday mesafe filtresine takılır'
);

select tests.assert_raises(
  $$select swipe_pet(
    'aaaa1111-0000-0000-0000-000000000001',
    'cccc3333-0000-0000-0000-000000000003',
    'like'
  )$$,
  'farklı bölgedeki pete swipe yazılamaz'
);

select tests.assert(
  (select match_id from swipe_pet(
    'aaaa1111-0000-0000-0000-000000000001',
    'bbbb2222-0000-0000-0000-000000000002',
    'like'
  )) is null,
  'aynı bölgede swipe kabul edilir'
);

reset role;

-- Karşılıklılık: Nişantaşı da Kadıköy petini görmez.
set local role authenticated;
select tests.act_as('33333333-3333-3333-3333-333333333333');

select tests.assert(
  not exists (
    select 1 from discover_playdate_pets('cccc3333-0000-0000-0000-000000000003')
    where id = 'aaaa1111-0000-0000-0000-000000000001'
  ),
  'Nişantaşı kullanıcısı Kadıköy petini görmez'
);

reset role;

-- Bekleme listesi ve boş bölge destesi boş.
set local role authenticated;
select tests.act_as('55555555-5555-5555-5555-555555555555');

select tests.assert(
  (select count(*) from discover_playdate_pets('eeee5555-0000-0000-0000-000000000005')) = 0,
  'bekleme listesi kullanıcısının destesi boş'
);

reset role;

set local role authenticated;
select tests.act_as('66666666-6666-6666-6666-666666666666');

select tests.assert(
  (select count(*) from discover_playdate_pets('ffff6666-0000-0000-0000-000000000006')) = 0,
  'bölgesi boş kullanıcının destesi boş'
);

reset role;

-- Konum vermeyen bakan: kendi bölgesini görür, kova yok, diğer bölge yok.
update pets
set latitude = null, longitude = null
where id = 'aaaa1111-0000-0000-0000-000000000001';

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (
    select distance_bucket
    from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
    where id = 'aaaa7777-0000-0000-0000-000000000007'
  ) is null,
  'konum vermeyen bakan mesafe etiketi almaz'
);

select tests.assert(
  not exists (
    select 1 from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
    where id in (
      'cccc3333-0000-0000-0000-000000000003',
      'dddd4444-0000-0000-0000-000000000004',
      'eeee5555-0000-0000-0000-000000000005'
    )
  ),
  'konum vermeyen bakan hâlâ yalnızca kendi bölgesini görür'
);

reset role;

-- pending_likes aynı kuralı uygular (doğrudan insert, swipe_pet bypass).
insert into swipes (from_pet_id, to_pet_id, actor_id, direction) values
  ('cccc3333-0000-0000-0000-000000000003', 'aaaa1111-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'like'),
  ('aaaa7777-0000-0000-0000-000000000007', 'aaaa1111-0000-0000-0000-000000000001', '77777777-7777-7777-7777-777777777777', 'like');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  pending_likes_count() = 1,
  'bekleyen beğeni sayısı diğer bölgeyi saymaz'
);

select tests.assert(
  (select id from pending_likes()) = 'aaaa7777-0000-0000-0000-000000000007',
  'bekleyen beğeniler yalnızca aynı bölgeyi listeler'
);

reset role;
rollback;
