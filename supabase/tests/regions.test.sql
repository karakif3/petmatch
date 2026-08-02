-- Pilot bölge seçimi ve yoğunluk ölçümü.

begin;

\echo '  regions: pilot bölge seçimi'

select tests.seed_user('11111111-1111-1111-1111-111111111111');
select tests.seed_user('22222222-2222-2222-2222-222222222222');
select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from regions where is_pilot) = 2,
  'iki pilot bölge tanımlı'
);

-- --------------------------------------------------------------------------
-- Seçim
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select region_slug is null from profiles where id = '11111111-1111-1111-1111-111111111111'),
  'yeni kullanıcının bölgesi başlangıçta boş'
);

select set_my_region('kadikoy');

select tests.assert(
  (select region_slug = 'kadikoy' from profiles
   where id = '11111111-1111-1111-1111-111111111111'),
  'bölge seçimi kaydediliyor'
);

select tests.assert_raises(
  'select set_my_region(''besiktas'')',
  'tanımsız bölge reddediliyor'
);

select tests.assert(
  (select region_slug = 'kadikoy' from profiles
   where id = '11111111-1111-1111-1111-111111111111'),
  'reddedilen seçim mevcut bölgeyi bozmuyor'
);

-- Kullanıcı yalnızca RPC ile yazabilmeli; doğrudan UPDATE yolu yok.
select set_my_region('other');
select tests.assert(
  (select region_slug = 'other' from profiles
   where id = '11111111-1111-1111-1111-111111111111'),
  '"Diğer" de gerçek bir seçim — boş bırakmakla aynı şey değil'
);

select set_my_region('kadikoy');
reset role;

-- --------------------------------------------------------------------------
-- Yoğunluk yalnızca moderatöre
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');

select tests.assert_raises(
  'select * from region_density()',
  'moderatör olmayan yoğunluk raporunu göremiyor'
);

reset role;

insert into app_user_roles (user_id, role)
values ('22222222-2222-2222-2222-222222222222', 'moderator');

set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');

select tests.assert(
  (select onboarded from region_density() where slug = 'kadikoy') = 1,
  'Kadıköy''de bir onboarded kullanıcı sayılıyor'
);

select tests.assert(
  (select with_active_pet from region_density() where slug = 'kadikoy') = 1,
  'aktif peti olan kullanıcı ayrıca sayılıyor'
);

select tests.assert(
  (select onboarded from region_density() where slug = 'nisantasi') = 0,
  'boş bölge sıfırla görünüyor — satır kaybolmuyor'
);

select tests.assert(
  (select count(*) from region_density()) = 3,
  'rapor "Diğer" dahil tüm aktif bölgeleri veriyor'
);

reset role;
rollback;
