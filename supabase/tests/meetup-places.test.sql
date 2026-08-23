-- Buluşma yerleri: doğrulama kapısı ve bölge eşleşmesi.
--
-- Buradaki en kritik iddia şu: DOĞRULANMAMIŞ YER KULLANICIYA GÖRÜNMEZ.
-- Kullanıcıyı hayvan girişine kapalı bir parka yollamak, güvenlik diye
-- konumlandırdığımız şeyin tam tersi olur.

begin;

\echo '  meetup: doğrulama kapısı ve bölge eşleşmesi'

select tests.seed_user('11111111-1111-1111-1111-111111111111');
select tests.seed_user('22222222-2222-2222-2222-222222222222');

select tests.assert(
  (select count(*) from meetup_places) = 6,
  'aday liste yüklü (Kadıköy 4 + Nişantaşı 2)'
);

select tests.assert(
  (select count(*) from meetup_places where is_verified) = 4,
  'resmi kaynağı bulunan dört aday doğrulanmış'
);

-- --------------------------------------------------------------------------
-- Yalnız resmi kaynakla doğrulananlar görünüyor
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select set_my_region('kadikoy');

select tests.assert(
  (select count(*) from list_meetup_places()) = 3,
  'Kadıköyde resmi kaynaklı üç yer görünüyor'
);

select tests.assert(
  not exists (select 1 from meetup_places where name = 'Fenerbahçe Parkı'),
  'RLS doğrulanmamış Kadıköy adayını gizliyor'
);

select tests.assert(
  (select count(*) from meetup_places) = 4,
  'RLS doğrulanmış yerleri bölgeden bağımsız gösterir — bölge süzmesi RPC''de'
);

select tests.assert(
  (select count(*) from list_meetup_places()
   where source_url is not null and verification_method = 'official_source') = 3,
  'kullanıcıya doğrulama yöntemi ve resmi kaynak dönüyor'
);

reset role;

-- --------------------------------------------------------------------------
-- Doğrulama moderatör işi
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert_raises(
  'select list_meetup_place_candidates()',
  'moderatör olmayan aday listesini göremiyor'
);

reset role;

insert into app_user_roles (user_id, role)
values ('22222222-2222-2222-2222-222222222222', 'moderator');

set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');

select tests.assert(
  (select count(*) from list_meetup_place_candidates()) = 6,
  'moderatör doğrulanmamışlar dahil hepsini görüyor'
);

select id as fenerbahce from list_meetup_place_candidates()
where name = 'Fenerbahçe Parkı' \gset

select set_meetup_place_verification(:'fenerbahce', true, 'Sahada hayvan girişi teyit edildi');
reset role;

-- --------------------------------------------------------------------------
-- Doğrulandıktan sonra — ve yalnızca kendi bölgende
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from list_meetup_places()) = 4,
  'sahada doğrulanan yer resmi kaynaklı yerlere ekleniyor'
);

select tests.assert(
  (select verification_method from list_meetup_places()
   where name = 'Fenerbahçe Parkı') = 'field',
  'moderatör kontrolü saha doğrulaması olarak işaretleniyor'
);

-- Kullanıcı Nişantaşı'na geçince Kadıköy yeri kaybolmalı.
select set_my_region('nisantasi');
select tests.assert(
  (select count(*) from list_meetup_places()) = 1,
  'Nişantaşı kullanıcısı yalnız kendi bölgesindeki Maçka Parkını görüyor'
);

-- "Diğer" için küratörlü liste yok; uydurma öneri vermiyoruz.
select set_my_region('other');
select tests.assert(
  (select count(*) from list_meetup_places()) = 0,
  '"Diğer" bölgesinde öneri yok'
);

reset role;

-- --------------------------------------------------------------------------
-- Doğrulama geri alınabilir
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');
select set_meetup_place_verification(:'fenerbahce', false);
reset role;

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select set_my_region('kadikoy');

select tests.assert(
  (select count(*) from list_meetup_places()) = 3,
  'saha doğrulaması geri alınınca aday tekrar gizleniyor'
);

reset role;
rollback;
