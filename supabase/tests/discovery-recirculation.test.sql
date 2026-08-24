-- Yeniden dolaşım (`0060`) dört şeyi birden garanti etmeli:
--
--   1. Taze aday varken geçilmiş pet GERİ GELMEZ (arz israf edilmiyor).
--   2. Deste tükenince bayatlamış "geç"ler geri gelir ve işaretlenir.
--   3. Beğeni kalıcıdır — beğenilen pet hiçbir koşulda desteye dönmez.
--   4. Yeniden dolaşımdan gelen bir "beğen" EŞLEŞME DOĞURUR. Bu en kritik
--      madde: eski satırın üzerine UPDATE yazılsaydı `on_swipe_created`
--      ateşlenmez ve eşleşme sessizce kaybolurdu.

begin;

\echo '  discovery: yeniden dolaşım yalnızca deste tükenince'

select tests.seed_user('11111111-1111-1111-1111-111111111111', 'male', 'public');   -- bakan
select tests.seed_user('22222222-2222-2222-2222-222222222222', 'female', 'public'); -- 10 gün önce geçildi
select tests.seed_user('33333333-3333-3333-3333-333333333333', 'female', 'public'); -- hiç görülmedi
select tests.seed_user('44444444-4444-4444-4444-444444444444', 'female', 'public'); -- 30 gün önce beğenildi
select tests.seed_user('55555555-5555-5555-5555-555555555555', 'female', 'public'); -- 2 gün önce geçildi

select tests.assign_region('11111111-1111-1111-1111-111111111111', 'kadikoy');
select tests.assign_region('22222222-2222-2222-2222-222222222222', 'kadikoy');
select tests.assign_region('33333333-3333-3333-3333-333333333333', 'kadikoy');
select tests.assign_region('44444444-4444-4444-4444-444444444444', 'kadikoy');
select tests.assign_region('55555555-5555-5555-5555-555555555555', 'kadikoy');

select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Benim');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Bayat Geç');
select tests.seed_pet('cccc3333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Taze Aday');
select tests.seed_pet('dddd4444-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'Beğenilmiş');
select tests.seed_pet('eeee5555-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555', 'Taze Geç');

insert into swipes (from_pet_id, to_pet_id, actor_id, direction, created_at)
values
  ('aaaa1111-0000-0000-0000-000000000001', 'bbbb2222-0000-0000-0000-000000000002',
   '11111111-1111-1111-1111-111111111111', 'pass', now() - interval '10 days'),
  ('aaaa1111-0000-0000-0000-000000000001', 'dddd4444-0000-0000-0000-000000000004',
   '11111111-1111-1111-1111-111111111111', 'like', now() - interval '30 days'),
  ('aaaa1111-0000-0000-0000-000000000001', 'eeee5555-0000-0000-0000-000000000005',
   '11111111-1111-1111-1111-111111111111', 'pass', now() - interval '2 days');

-- Karşı taraf bakanı çoktan beğenmiş: yeniden dolaşımdan gelen "beğen"
-- eşleşmeyi doğurmalı. Bu satır yazılırken bakanın kaydı 'pass' olduğu için
-- henüz eşleşme yok.
insert into swipes (from_pet_id, to_pet_id, actor_id, direction)
values ('bbbb2222-0000-0000-0000-000000000002', 'aaaa1111-0000-0000-0000-000000000001',
        '22222222-2222-2222-2222-222222222222', 'like');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')) = 1,
  'taze aday varken deste yalnızca onu içeriyor'
);

select tests.assert(
  (select id from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001'))
    = 'cccc3333-0000-0000-0000-000000000003',
  'gelen tek kart hiç görülmemiş olan — bayat geç geri gelmiyor'
);

reset role;

-- Taze aday da tüketiliyor: artık hiç taze kart yok.
insert into swipes (from_pet_id, to_pet_id, actor_id, direction)
values ('aaaa1111-0000-0000-0000-000000000001', 'cccc3333-0000-0000-0000-000000000003',
        '11111111-1111-1111-1111-111111111111', 'pass');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')) = 1,
  'deste tükenince tek bir kart geri geliyor'
);

select tests.assert(
  (select id from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001'))
    = 'bbbb2222-0000-0000-0000-000000000002',
  'geri gelen kart 7 günden eski "geç" — 2 günlük geç ve beğeni gelmiyor'
);

select tests.assert(
  (select previously_passed from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')),
  'geri gelen kart previously_passed ile işaretli'
);

-- 4. madde: yeniden dolaşımdan gelen beğeni eşleşme doğurmalı.
select tests.assert(
  (select match_id from swipe_pet(
     'aaaa1111-0000-0000-0000-000000000001',
     'bbbb2222-0000-0000-0000-000000000002',
     'like'
   )) is not null,
  'yeniden dolaşımdan gelen beğeni eşleşme doğuruyor — trigger INSERT''te ateşlendi'
);

select tests.assert(
  (select count(*) from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')) = 0,
  'beğenilen kart destede tekrar çıkmıyor'
);

reset role;

rollback;
