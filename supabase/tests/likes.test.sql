-- Beğeniler sekmesi: monetization.md "kim beğendi" katman ayrımının
-- veritabanı tarafı. Ham `swipes` tablosuna erişim hiçbir katmanda
-- açılmıyor — ayrım `pending_likes_count()` / `pending_likes()` içinde.

begin;

\echo '  likes: bekleyen beğeniler'

select tests.seed_user('11111111-1111-1111-1111-111111111111'); -- ben
select tests.seed_user('22222222-2222-2222-2222-222222222222'); -- cevapsız beğeni
select tests.seed_user('33333333-3333-3333-3333-333333333333'); -- engellenecek
select tests.seed_user('44444444-4444-4444-4444-444444444444'); -- eşleşecek
select tests.assign_region('11111111-1111-1111-1111-111111111111', 'kadikoy');
select tests.assign_region('22222222-2222-2222-2222-222222222222', 'kadikoy');
select tests.assign_region('33333333-3333-3333-3333-333333333333', 'kadikoy');
select tests.assign_region('44444444-4444-4444-4444-444444444444', 'kadikoy');

select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luna');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Karam');
select tests.seed_pet('cccc3333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Zorlu');
select tests.seed_pet('dddd4444-0000-0000-0000-000000000004', '44444444-4444-4444-4444-444444444444', 'Mira');

-- Karam, Zorlu ve Mira benim petimi beğendi; ben hiçbirine cevap vermedim.
insert into swipes (from_pet_id, to_pet_id, actor_id, direction) values
  ('bbbb2222-0000-0000-0000-000000000002', 'aaaa1111-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'like'),
  ('cccc3333-0000-0000-0000-000000000003', 'aaaa1111-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', 'like'),
  ('dddd4444-0000-0000-0000-000000000004', 'aaaa1111-0000-0000-0000-000000000001', '44444444-4444-4444-4444-444444444444', 'like');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(pending_likes_count() = 3, 'üç bekleyen beğeni sayılıyor');
select tests.assert(
  (select count(*) from pending_likes()) = 3,
  'pending_likes() da üçünü döndürüyor'
);

select block_user('33333333-3333-3333-3333-333333333333');
select tests.assert(pending_likes_count() = 2, 'engellenen beğeni sayıya girmiyor');

reset role;

-- Mira ile eşleşiyorum (karşılıklı beğeni) — artık Sohbetler'e ait, Beğeniler'den düşmeli.
insert into swipes (from_pet_id, to_pet_id, actor_id, direction) values
  ('aaaa1111-0000-0000-0000-000000000001', 'dddd4444-0000-0000-0000-000000000004', '11111111-1111-1111-1111-111111111111', 'like');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select tests.assert(pending_likes_count() = 1, 'karşılık verilen beğeni listeden düşüyor');
reset role;

-- Karam'ı geçiyorum — cevap verdim ama eşleşme yok, o da düşmeli.
insert into swipes (from_pet_id, to_pet_id, actor_id, direction) values
  ('aaaa1111-0000-0000-0000-000000000001', 'bbbb2222-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'pass');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select tests.assert(pending_likes_count() = 0, 'geçilen beğeni de listeden düşüyor');
reset role;

\echo '  likes: süper beğeni'

select tests.seed_user('55555555-5555-5555-5555-555555555555'); -- ben (süper senaryosu)
select tests.seed_user('66666666-6666-6666-6666-666666666666'); -- normal beğeni, daha yeni
select tests.seed_user('77777777-7777-7777-7777-777777777777'); -- süper beğeni, daha eski
select tests.assign_region('55555555-5555-5555-5555-555555555555', 'kadikoy');
select tests.assign_region('66666666-6666-6666-6666-666666666666', 'kadikoy');
select tests.assign_region('77777777-7777-7777-7777-777777777777', 'kadikoy');

select tests.seed_pet('aaaa5555-0000-0000-0000-000000000005', '55555555-5555-5555-5555-555555555555', 'Zeytin');
select tests.seed_pet('bbbb6666-0000-0000-0000-000000000006', '66666666-6666-6666-6666-666666666666', 'Rüzgar');
select tests.seed_pet('cccc7777-0000-0000-0000-000000000007', '77777777-7777-7777-7777-777777777777', 'Fındık');

-- Fındık önce (daha eski) süper beğeniyor, Rüzgar sonra (daha yeni) normal beğeniyor.
insert into swipes (from_pet_id, to_pet_id, actor_id, direction, is_super, created_at) values
  ('cccc7777-0000-0000-0000-000000000007', 'aaaa5555-0000-0000-0000-000000000005', '77777777-7777-7777-7777-777777777777', 'like', true, now() - interval '1 hour'),
  ('bbbb6666-0000-0000-0000-000000000006', 'aaaa5555-0000-0000-0000-000000000005', '66666666-6666-6666-6666-666666666666', 'like', false, now());

set local role authenticated;
select tests.act_as('55555555-5555-5555-5555-555555555555');

select tests.assert(
  (select id from pending_likes() limit 1) = 'cccc7777-0000-0000-0000-000000000007',
  'daha eski ama süper olan beğeni sırada öne geçiyor'
);
select tests.assert(
  (select is_super from pending_likes() where id = 'cccc7777-0000-0000-0000-000000000007') is true,
  'süper beğeni is_super=true dönüyor'
);
select tests.assert(
  (select is_super from pending_likes() where id = 'bbbb6666-0000-0000-0000-000000000006') is false,
  'normal beğeni is_super=false dönüyor'
);
reset role;

-- pass yönünde süper olunamaz — swipe_pet katmanı değil, doğrudan tabloyu da kapatıyoruz.
select tests.assert_raises(
  $$insert into swipes (from_pet_id, to_pet_id, actor_id, direction, is_super)
    values ('aaaa5555-0000-0000-0000-000000000005', 'bbbb6666-0000-0000-0000-000000000006', '55555555-5555-5555-5555-555555555555', 'pass', true)$$,
  'pass yönünde süper beğeni reddediliyor'
);

rollback;
