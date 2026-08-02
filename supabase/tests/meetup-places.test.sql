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
  (select count(*) from meetup_places where is_verified) = 0,
  'adayların hiçbiri doğrulanmış değil'
);

-- --------------------------------------------------------------------------
-- Doğrulanmamışken hiçbir şey görünmüyor
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select set_my_region('kadikoy');

select tests.assert(
  (select count(*) from list_meetup_places()) = 0,
  'doğrulanmamış yerler kullanıcıya GÖRÜNMÜYOR'
);

select tests.assert(
  (select count(*) from meetup_places) = 0,
  'tablo doğrudan sorgulansa da RLS doğrulanmamışı vermiyor'
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

select id as yogurtcu from list_meetup_place_candidates()
where name = 'Yoğurtçu Parkı' \gset

select set_meetup_place_verification(:'yogurtcu', true, 'Tasmasız alan var');
reset role;

-- --------------------------------------------------------------------------
-- Doğrulandıktan sonra — ve yalnızca kendi bölgende
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select count(*) from list_meetup_places()) = 1,
  'doğrulanan yer artık görünüyor'
);

select tests.assert(
  (select note from list_meetup_places()) = 'Tasmasız alan var',
  'moderatörün düştüğü not kullanıcıya gidiyor'
);

-- Kullanıcı Nişantaşı'na geçince Kadıköy yeri kaybolmalı.
select set_my_region('nisantasi');
select tests.assert(
  (select count(*) from list_meetup_places()) = 0,
  'başka bölgenin yeri gösterilmiyor'
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
select set_meetup_place_verification(:'yogurtcu', false);
reset role;

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select set_my_region('kadikoy');

select tests.assert(
  (select count(*) from list_meetup_places()) = 0,
  'doğrulama geri alınınca yer tekrar gizleniyor'
);

reset role;
rollback;
