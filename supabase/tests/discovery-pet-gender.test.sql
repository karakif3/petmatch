-- Pet cinsiyeti filtresi (`0064`).
--
-- Asıl iddia sonuncusu: kural İKİ yüzeyde birden geçerli. Yalnız okuma
-- yoluna konsaydı destede görünmeyen bir pete swipe yazılabilirdi.

begin;

\echo '  discovery: pet cinsiyeti filtresi'

select tests.seed_user('11111111-1111-1111-1111-111111111111'); -- bakan
select tests.seed_user('22222222-2222-2222-2222-222222222222');
select tests.seed_user('33333333-3333-3333-3333-333333333333');

select tests.assign_region('11111111-1111-1111-1111-111111111111', 'kadikoy');
select tests.assign_region('22222222-2222-2222-2222-222222222222', 'kadikoy');
select tests.assign_region('33333333-3333-3333-3333-333333333333', 'kadikoy');

select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Benim');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Erkek Pet');
select tests.seed_pet('cccc3333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Dişi Pet');

-- `tests.seed_pet` hepsini 'male' yaratıyor; birini dişiye çeviriyoruz.
update pets set gender = 'female' where id = 'cccc3333-0000-0000-0000-000000000003';

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')) = 2,
  'varsayılanda iki cinsiyet de destede'
);

reset role;
update discovery_preferences
set pet_genders = '{female}'
where user_id = '11111111-1111-1111-1111-111111111111';
set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')) = 1,
  'yalnızca dişi seçilince deste teke düşüyor'
);

select tests.assert(
  (select id from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001'))
    = 'cccc3333-0000-0000-0000-000000000003',
  'gelen tek kart dişi olan'
);

-- İki yüzey aynı kuralı söylemeli.
select tests.assert_raises(
  $$select swipe_pet(
    'aaaa1111-0000-0000-0000-000000000001',
    'bbbb2222-0000-0000-0000-000000000002',
    'like'
  )$$,
  'filtre dışındaki pete swipe da yazılamıyor — kural iki yüzeyde birden'
);

select tests.assert(
  (select count(*) from swipe_pet(
     'aaaa1111-0000-0000-0000-000000000001',
     'cccc3333-0000-0000-0000-000000000003',
     'like'
   )) = 1,
  'filtreye uyan pete swipe yazılabiliyor'
);

-- Boş dizi reddedilmeli: "hiçbir cinsiyet" seçilebilir bir durum değil.
select tests.assert_raises(
  $$select update_my_discovery_filters(
      '{dog,cat}'::species[], '{}'::pet_gender[], 25, false, null, null,
      false, false, false, false, false
    )$$,
  'boş cinsiyet listesi reddediliyor'
);

reset role;

rollback;
