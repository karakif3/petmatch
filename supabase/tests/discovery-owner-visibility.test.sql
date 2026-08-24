-- `owner_profile_shown` bir satırda sahip alanlarının GERÇEKTEN dolu olup
-- olmadığını söylemeli. Eskiden `owner_visible` yalnızca "gizli değil"
-- demekti (`after_match` için de true dönüyordu) ama sahip alanları bu iki
-- yüzeyde yalnızca `public` iken doluyor — `after_match` burada hiç
-- kullanılmıyor (0047).

begin;

\echo '  discovery: owner_profile_shown yalnızca public iken true'

select tests.seed_user('11111111-1111-1111-1111-111111111111'); -- bakan
select tests.seed_user('22222222-2222-2222-2222-222222222222', null, 'public'); -- public sahip
select tests.seed_user('33333333-3333-3333-3333-333333333333', null, 'after_match'); -- after_match sahip

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
  (select owner_profile_shown from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
   where id = 'bbbb2222-0000-0000-0000-000000000002'),
  'public sahipte owner_profile_shown true'
);

select tests.assert(
  (select owner_display_name from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
   where id = 'bbbb2222-0000-0000-0000-000000000002') is not null,
  'public sahipte isim gerçekten doluyor'
);

select tests.assert(
  not (select owner_profile_shown from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
       where id = 'cccc3333-0000-0000-0000-000000000003'),
  'after_match sahipte owner_profile_shown false — bu yüzeyde after_match hiç gösterilmiyor'
);

select tests.assert(
  (select owner_display_name from discover_playdate_pets('aaaa1111-0000-0000-0000-000000000001')
   where id = 'cccc3333-0000-0000-0000-000000000003') is null,
  'after_match sahipte isim de boş — owner_profile_shown ile alan doluluğu tutarlı'
);

reset role;

-- Aynı sözleşme pending_likes()'ta da geçerli: diğer iki sahip "bakan"ın
-- petini beğeniyor, o da beğenileri görüyor.
set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');
select swipe_pet('bbbb2222-0000-0000-0000-000000000002', 'aaaa1111-0000-0000-0000-000000000001', 'like');
reset role;

set local role authenticated;
select tests.act_as('33333333-3333-3333-3333-333333333333');
select swipe_pet('cccc3333-0000-0000-0000-000000000003', 'aaaa1111-0000-0000-0000-000000000001', 'like');
reset role;

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select owner_profile_shown from pending_likes()
   where id = 'bbbb2222-0000-0000-0000-000000000002'),
  'pending_likes: public sahipte owner_profile_shown true'
);

select tests.assert(
  not (select owner_profile_shown from pending_likes()
       where id = 'cccc3333-0000-0000-0000-000000000003'),
  'pending_likes: after_match sahipte owner_profile_shown false'
);

reset role;
rollback;
