-- Gösterim tek yönlü (`0068`): gizli izleyici public sahibin yaş kovasını
-- ve cinsiyetini görür. Filtre hâlâ public + dolu alan ister.

begin;

\echo '  discovery: public sahip yaş/cinsiyet gizli izleyiciye de çıkar'

select tests.seed_user('11111111-1111-1111-1111-111111111111', 'male', 'hidden');
select tests.seed_user('22222222-2222-2222-2222-222222222222', 'female', 'public');
select tests.seed_user('33333333-3333-3333-3333-333333333333', 'female', 'after_match');

select tests.assign_region('11111111-1111-1111-1111-111111111111', 'kadikoy');
select tests.assign_region('22222222-2222-2222-2222-222222222222', 'kadikoy');
select tests.assign_region('33333333-3333-3333-3333-333333333333', 'kadikoy');

select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Benim');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Public Pet');
select tests.seed_pet('cccc3333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'AfterMatch Pet');

insert into pet_photos (pet_id, storage_path, position)
values
  ('bbbb2222-0000-0000-0000-000000000002', 'bbbb2222-0000-0000-0000-000000000002/1.jpg', 0),
  ('cccc3333-0000-0000-0000-000000000003', 'cccc3333-0000-0000-0000-000000000003/1.jpg', 0);

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select owner_gender from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
   where id = 'bbbb2222-0000-0000-0000-000000000002') = 'female',
  'gizli izleyici public sahibin cinsiyetini görür'
);

select tests.assert(
  (select owner_age_bucket from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
   where id = 'bbbb2222-0000-0000-0000-000000000002') is not null,
  'gizli izleyici public sahibin yaş kovasını görür'
);

select tests.assert(
  (select owner_gender from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
   where id = 'cccc3333-0000-0000-0000-000000000003') is null,
  'after_match sahip keşfette cinsiyet göstermez'
);

select tests.assert_raises(
  $q$ select * from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001', null, 18, 40) $q$,
  'gizli izleyici yaş filtresi kullanamaz'
);

reset role;

set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');
select swipe_pet('bbbb2222-0000-0000-0000-000000000002', 'aaaa1111-0000-0000-0000-000000000001', 'like');
reset role;

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select owner_gender from pending_likes()
   where id = 'bbbb2222-0000-0000-0000-000000000002') = 'female',
  'pending_likes: gizli izleyici public sahibin cinsiyetini görür'
);

select tests.assert(
  (select owner_age_bucket from pending_likes()
   where id = 'bbbb2222-0000-0000-0000-000000000002') is not null,
  'pending_likes: gizli izleyici public sahibin yaş kovasını görür'
);

reset role;
rollback;
