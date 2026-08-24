-- Sahip filtreleri (`0059`) iki şeyi birden kanıtlamalı:
--
--   1. Filtre bir ÇIKARIM ARACI olmamalı. `after_match` / `hidden` bir
--      sahibin cinsiyeti ya da yaşı, filtre daraltılıp sonuç kümesindeki
--      değişim okunarak öğrenilememeli.
--   2. Filtre KESMEDEN ÖNCE uygulanmalı. Uygun aday mesafe sırasında
--      100'üncüden sonra kalıyorsa bile deste boş dönmemeli.

begin;

\echo '  discovery: sahip filtresi çıkarım aracı değil'

select tests.seed_user('11111111-1111-1111-1111-111111111111', 'male', 'public'); -- bakan
select tests.seed_user('22222222-2222-2222-2222-222222222222', 'female', 'public');
select tests.seed_user('33333333-3333-3333-3333-333333333333', 'female', 'after_match');
select tests.seed_user('44444444-4444-4444-4444-444444444444', 'female', 'hidden');

select tests.assign_region('11111111-1111-1111-1111-111111111111', 'kadikoy');
select tests.assign_region('22222222-2222-2222-2222-222222222222', 'kadikoy');
select tests.assign_region('33333333-3333-3333-3333-333333333333', 'kadikoy');
select tests.assign_region('44444444-4444-4444-4444-444444444444', 'kadikoy');

select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Benim');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Public Pet');
select tests.seed_pet('cccc3333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'AfterMatch Pet');
select tests.seed_pet('dddd4444-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'Hidden Pet');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

-- Önce zemin: filtre yokken üçü de destede. Aşağıdaki elemelerin sebebi
-- filtre olmalı, başka bir kural değil.
select tests.assert(
  (select count(*) from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')) = 3,
  'filtresiz destede üç aday da var'
);

-- Üç sahibin de cinsiyeti 'female'. Filtre yalnızca public olanı getirmeli;
-- diğer ikisinin cinsiyeti bu yüzeyde zaten gösterilmiyor, dolayısıyla
-- filtreyle de öğrenilememeli.
select tests.assert(
  (select count(*) from discover_playdate_pets(
     'aaaa1111-0000-0000-0000-000000000001', array['female']
   )) = 1,
  'cinsiyet filtresi yalnızca public sahibi değerlendiriyor'
);

select tests.assert(
  (select id from discover_playdate_pets(
     'aaaa1111-0000-0000-0000-000000000001', array['female']
   )) = 'bbbb2222-0000-0000-0000-000000000002',
  'cinsiyet filtresinden geçen tek aday public sahipli olan'
);

-- Üç sahibin de doğum tarihi aynı (`tests.seed_user` → 1995-01-01), yani
-- aralık üçünü de kapsıyor. Sonuç yine tek satır olmalı: aksi halde
-- aralığı daraltıp genişleterek gizli sahibin yaşı bulunabilirdi.
select tests.assert(
  (select count(*) from discover_playdate_pets(
     'aaaa1111-0000-0000-0000-000000000001', null, 18, 99
   )) = 1,
  'yaş filtresi yalnızca public sahibi değerlendiriyor'
);

select tests.assert(
  (select id from discover_playdate_pets(
     'aaaa1111-0000-0000-0000-000000000001', null, 18, 99
   )) = 'bbbb2222-0000-0000-0000-000000000002',
  'yaş filtresinden geçen tek aday public sahipli olan'
);

reset role;

-- ---------------------------------------------------------------------------
-- Kesme işleminden önce filtreleme
--
-- 100 yakın aday (hiçbiri doğrulanmamış) + 1 uzak doğrulanmış aday. Mesafeye
-- göre sıralamada doğrulanmış olan 101'inci sırada. Eski iki katmanlı yapıda
-- iç katman en yakın 100'ü verip kesiyordu, doğrulama filtresi ondan sonra
-- uygulanıyordu — sonuç sıfır satırdı.
-- ---------------------------------------------------------------------------

\echo '  discovery: filtre kesmeden önce uygulanıyor'

do $$
declare
  i      integer;
  v_user uuid;
begin
  for i in 1..100 loop
    v_user := ('40000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid;
    perform tests.seed_user(v_user, 'female', 'public');
    perform tests.assign_region(v_user, 'kadikoy');
    -- Bakanla aynı ızgara hücresi → mesafe 0, hepsi listenin başında.
    insert into pets (id, owner_id, name, species, gender, latitude, longitude, city, goals)
    values (
      ('50000000-0000-0000-0000-' || lpad(i::text, 12, '0'))::uuid,
      v_user, 'Yakın ' || i, 'dog', 'female', 41.01, 29.01, 'Istanbul', '{playdate}'
    );
  end loop;
end;
$$;

select tests.seed_user('77777777-7777-7777-7777-777777777777', 'female', 'public');
select tests.assign_region('77777777-7777-7777-7777-777777777777', 'kadikoy');
update profiles
set verification_status = 'approved'
where id = '77777777-7777-7777-7777-777777777777';

-- ~3.4 km doğuda: yarıçap içinde ama mesafe sırasında en sonda.
insert into pets (id, owner_id, name, species, gender, latitude, longitude, city, goals)
values (
  'eeee7777-0000-0000-0000-000000000007',
  '77777777-7777-7777-7777-777777777777',
  'Uzak Doğrulanmış', 'dog', 'female', 41.01, 29.05, 'Istanbul', '{playdate}'
);

update discovery_preferences
set require_verified_owner = true
where user_id = '11111111-1111-1111-1111-111111111111';

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')) = 1,
  'doğrulama filtresi 100 aday ötesindeki tek uygun adayı buluyor'
);

select tests.assert(
  (select id from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001'))
    = 'eeee7777-0000-0000-0000-000000000007',
  'gelen satır uzaktaki doğrulanmış aday — eski yapıda deste boş dönerdi'
);

reset role;

rollback;
