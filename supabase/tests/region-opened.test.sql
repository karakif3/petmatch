-- "Bölgem açıldığında haber ver" alıcı seçimi (20261103120000).

begin;

\echo '  region-opened: alıcı eşlemesi, tercih, tekilleştirme, yetki'

select tests.seed_user('11111111-1111-1111-1111-111111111111');
select tests.seed_user('22222222-2222-2222-2222-222222222222');
select tests.seed_user('33333333-3333-3333-3333-333333333333');
select tests.seed_user('44444444-4444-4444-4444-444444444444');
select tests.seed_user('55555555-5555-5555-5555-555555555555');
select tests.seed_user('99999999-9999-9999-9999-999999999999');

select tests.assert(
  normalize_location('  Beşiktaş/İstanbul ') = 'besiktas/istanbul'
  and normalize_location('ÜSKÜDAR') = 'uskudar',
  'normalize_location Türkçe harfleri katlıyor'
);

-- Bekleme listesi: üç farklı yazım, bir şehir, bir alakasız, bir "haber verme".
set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select set_my_region('other', 'Beşiktaş', true);
select tests.act_as('22222222-2222-2222-2222-222222222222');
select set_my_region('other', 'besiktas / istanbul', true);
select tests.act_as('33333333-3333-3333-3333-333333333333');
select set_my_region('other', 'İstanbul Avrupa yakası', true);
select tests.act_as('44444444-4444-4444-4444-444444444444');
select set_my_region('other', 'Ankara Çankaya', true);
select tests.act_as('55555555-5555-5555-5555-555555555555');
select set_my_region('other', 'Beşiktaş', false);

select tests.assert_raises(
  $$select * from region_opening_recipients('besiktas')$$,
  'moderatör olmayan alıcı listesini göremiyor'
);

reset role;
insert into app_user_roles (user_id, role)
values ('99999999-9999-9999-9999-999999999999', 'moderator');

set local role authenticated;
select tests.act_as('99999999-9999-9999-9999-999999999999');

select tests.assert(
  (select array_agg(user_id order by user_id) from region_opening_recipients('besiktas'))
  = array[
      '11111111-1111-1111-1111-111111111111',
      '22222222-2222-2222-2222-222222222222',
      '33333333-3333-3333-3333-333333333333'
    ]::uuid[],
  'ilçe adı ya da şehri geçen ve haber isteyenler alıcı; Ankara ve haber istemeyen dışarıda'
);

select tests.assert(
  (select bool_and(not already_notified) from region_opening_recipients('besiktas')),
  'henüz kimseye bildirilmedi'
);

select tests.assert_raises(
  $$select * from region_opening_recipients('other')$$,
  'pilot olmayan bölge için liste yok'
);

reset role;

-- Edge Function bir alıcıya gönderdi: aynı bölge için bir daha sayılmaz.
insert into notification_deliveries (event_type, event_id, recipient_id, status)
select 'region_opened', opened_event_id, '11111111-1111-1111-1111-111111111111', 'sent'
from regions where slug = 'besiktas';

set local role authenticated;
select tests.act_as('99999999-9999-9999-9999-999999999999');

select tests.assert(
  (select already_notified from region_opening_recipients('besiktas')
   where user_id = '11111111-1111-1111-1111-111111111111')
  and (select count(*) filter (where not already_notified) from region_opening_recipients('besiktas')) = 2,
  'bildirilen kullanıcı işaretli, kalan iki alıcı'
);

rollback;
