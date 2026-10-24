-- "Şimdi parktayım" (20261024160000): check-in yalnız kendi pilot bölgendeki
-- doğrulanmış yerde; bölge dışı ve engelli kullanıcı görmez; sahip adı yalnız
-- public sahipte; alıcı seçimi tercih, engel ve 2 saatlik tekrar sınırına uyar.

begin;

\echo '  park-now: anlık park buluşması'

select tests.seed_user('b1111111-1111-1111-1111-111111111111');                       -- A public
select tests.seed_user('b2222222-2222-2222-2222-222222222222', null, 'after_match'); -- B
select tests.seed_user('b3333333-3333-3333-3333-333333333333');                       -- C başka bölge
select tests.seed_user('b4444444-4444-4444-4444-444444444444');                       -- D engelli
select tests.seed_user('b5555555-5555-5555-5555-555555555555');                       -- E bildirim kapalı
select tests.seed_pet('baaa1111-0000-0000-0000-000000000001', 'b1111111-1111-1111-1111-111111111111', 'Ada');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', 'b2222222-2222-2222-2222-222222222222', 'Fındık');
select tests.seed_pet('bccc3333-0000-0000-0000-000000000003', 'b3333333-3333-3333-3333-333333333333', 'Toprak');
select tests.seed_pet('bddd4444-0000-0000-0000-000000000004', 'b4444444-4444-4444-4444-444444444444', 'Pamuk');
select tests.seed_pet('beee5555-0000-0000-0000-000000000005', 'b5555555-5555-5555-5555-555555555555', 'Zeytin');

select tests.assign_region('b1111111-1111-1111-1111-111111111111', 'kadikoy');
select tests.assign_region('b2222222-2222-2222-2222-222222222222', 'kadikoy');
select tests.assign_region('b3333333-3333-3333-3333-333333333333', 'nisantasi');
select tests.assign_region('b4444444-4444-4444-4444-444444444444', 'kadikoy');
select tests.assign_region('b5555555-5555-5555-5555-555555555555', 'kadikoy');
update discovery_preferences set notify_on_park = false
where user_id = 'b5555555-5555-5555-5555-555555555555';

select id as kadikoy_place from meetup_places
where region_slug = 'kadikoy' and is_verified and is_active order by sort_order limit 1 \gset
select id as unverified_place from meetup_places
where region_slug = 'kadikoy' and not is_verified limit 1 \gset
select id as nisantasi_place from meetup_places
where region_slug = 'nisantasi' and is_verified limit 1 \gset

select tests.assert(
  (select relrowsecurity from pg_class where oid = 'public.park_checkins'::regclass)
  and not exists (select 1 from pg_policies where tablename = 'park_checkins'),
  'park_checkins: RLS açık, politika yok — tek yol RPC'
);
select tests.assert(
  not has_function_privilege('authenticated', 'public.park_checkin_recipients(uuid)', 'EXECUTE'),
  'alıcı seçimi istemciye kapalı'
);

-- D, A'yı engeller.
set local role authenticated;
select tests.act_as('b4444444-4444-4444-4444-444444444444');
select block_user('b1111111-1111-1111-1111-111111111111');
reset role;

set local role authenticated;
select tests.act_as('b1111111-1111-1111-1111-111111111111');

select tests.assert_raises(
  format('select start_park_checkin(%L, 60)', :'unverified_place'),
  'doğrulanmamış yerde check-in açılamaz'
);
select tests.assert_raises(
  format('select start_park_checkin(%L, 60)', :'nisantasi_place'),
  'başka bölgenin yerinde check-in açılamaz'
);
select tests.assert_raises(
  format('select start_park_checkin(%L, 240)', :'kadikoy_place'),
  '180 dakikadan uzun pencere reddedilir'
);

select start_park_checkin(:'kadikoy_place', 60) as first_checkin \gset
select start_park_checkin(:'kadikoy_place', 90) as checkin \gset

select tests.assert(
  (select count(*) from list_park_now() where is_mine) = 1,
  'yeni check-in eskisini kapatır — kullanıcı başına tek açık'
);
select tests.assert(
  (select count(*) from park_checkins) = 0,
  'tablo doğrudan okunamaz (RLS)'
);
select tests.assert_raises(
  format($$insert into park_checkins (user_id, pet_id, place_id, region_slug, ends_at)
    values ('b1111111-1111-1111-1111-111111111111', 'baaa1111-0000-0000-0000-000000000001', %L, 'kadikoy', now() + interval '1 hour')$$,
    :'kadikoy_place'),
  'tabloya doğrudan yazılamaz (RLS)'
);
reset role;

select tests.assert(
  (select array_agg(user_id order by user_id) from park_checkin_recipients(:'checkin'))
  = array['b2222222-2222-2222-2222-222222222222']::uuid[],
  'alıcı: yalnız aynı bölge, bildirimi açık, engelsiz kullanıcı'
);

-- B listeyi görür; A public → sahip adı görünür.
set local role authenticated;
select tests.act_as('b2222222-2222-2222-2222-222222222222');
select tests.assert(
  (select count(*) from list_park_now()
    where pet_name = 'Ada' and owner_name is not null and not is_mine) = 1,
  'aynı bölgedeki kullanıcı parktaki peti ve public sahibin adını görür'
);
select start_park_checkin(:'kadikoy_place', 60) as b_checkin \gset
reset role;

select tests.assert(
  not exists (select 1 from park_checkin_recipients(:'b_checkin')
              where user_id = 'b1111111-1111-1111-1111-111111111111'),
  'zaten parktaki kullanıcıya park bildirimi gitmez'
);

set local role authenticated;
select tests.act_as('b1111111-1111-1111-1111-111111111111');
select tests.assert(
  (select owner_name is null from list_park_now() where pet_name = 'Fındık'),
  'after_match sahibin adı parkta görünmez'
);
reset role;

set local role authenticated;
select tests.act_as('b3333333-3333-3333-3333-333333333333');
select tests.assert(
  (select count(*) from list_park_now()) = 0,
  'başka bölgedeki kullanıcı listeyi görmez'
);
reset role;

set local role authenticated;
select tests.act_as('b4444444-4444-4444-4444-444444444444');
select tests.assert(
  not exists (select 1 from list_park_now() where pet_name = 'Ada'),
  'engel iki yönde süzer'
);
reset role;

-- 2 saatlik tekrar sınırı.
insert into notification_deliveries (event_type, event_id, recipient_id, status)
values ('park_checkin', :'checkin', 'b2222222-2222-2222-2222-222222222222', 'sent');
set local role authenticated;
select tests.act_as('b2222222-2222-2222-2222-222222222222');
select end_my_park_checkin();
reset role;
select tests.assert(
  not exists (select 1 from park_checkin_recipients(:'checkin')),
  'son 2 saatte park bildirimi alan kullanıcıya yenisi gitmez'
);

-- Bitirme ve hız sınırı.
set local role authenticated;
select tests.act_as('b1111111-1111-1111-1111-111111111111');
select end_my_park_checkin();
select tests.assert(
  not exists (select 1 from list_park_now() where is_mine),
  'check-in bitirilince listeden düşer'
);
select start_park_checkin(:'kadikoy_place', 30);
select start_park_checkin(:'kadikoy_place', 30);
select tests.assert_raises(
  format('select start_park_checkin(%L, 30)', :'kadikoy_place'),
  '24 saatte en fazla 4 check-in'
);

select set_park_notifications(false);
select tests.assert(not my_park_notifications_enabled(), 'park bildirimi kapatılabilir');
reset role;

rollback;
