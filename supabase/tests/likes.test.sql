-- Beğeniler sekmesi: monetization.md "kim beğendi" katman ayrımının
-- veritabanı tarafı. Ham `swipes` tablosuna erişim hiçbir katmanda
-- açılmıyor — ayrım `pending_likes_count()` / `pending_likes()` içinde.

begin;

\echo '  likes: bekleyen beğeniler'

select tests.seed_user('11111111-1111-1111-1111-111111111111'); -- ben
select tests.seed_user('22222222-2222-2222-2222-222222222222'); -- cevapsız beğeni
select tests.seed_user('33333333-3333-3333-3333-333333333333'); -- engellenecek
select tests.seed_user('44444444-4444-4444-4444-444444444444'); -- eşleşecek

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

rollback;
