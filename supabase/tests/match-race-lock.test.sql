-- Karşılıklı beğeni yarışı (20261024120000): her beğeni, pet çifti için
-- transaction süresince tutulan bir advisory kilit alır. Tek oturumlu test
-- iki oturumun yarışını kuramaz; kilidin alındığını ve eşleşmenin yine de
-- doğduğunu doğrular.

begin;

\echo '  match-race-lock: beğeni çift başına transaction kilidi alıyor'

select tests.seed_user('71111111-1111-1111-1111-111111111111');
select tests.seed_user('72222222-2222-2222-2222-222222222222');
select tests.seed_pet('7aaa1111-0000-0000-0000-000000000001', '71111111-1111-1111-1111-111111111111', 'Pamuk');
select tests.seed_pet('7bbb2222-0000-0000-0000-000000000002', '72222222-2222-2222-2222-222222222222', 'Zeytin');

select tests.assert(
  not exists (select 1 from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()),
  'beğeniden önce advisory kilit yok'
);

insert into swipes (from_pet_id, to_pet_id, actor_id, direction)
values ('7aaa1111-0000-0000-0000-000000000001', '7bbb2222-0000-0000-0000-000000000002',
        '71111111-1111-1111-1111-111111111111', 'pass');

select tests.assert(
  not exists (select 1 from pg_locks where locktype = 'advisory' and pid = pg_backend_pid()),
  'geçme (pass) kilit almıyor'
);

insert into swipes (from_pet_id, to_pet_id, actor_id, direction)
values ('7bbb2222-0000-0000-0000-000000000002', '7aaa1111-0000-0000-0000-000000000001',
        '72222222-2222-2222-2222-222222222222', 'like');

select tests.assert(
  (select count(*) from pg_locks
    where locktype = 'advisory' and pid = pg_backend_pid() and objsubid = 2) = 1,
  'beğeni çift başına iki anahtarlı advisory kilit alıyor'
);

select tests.assert(
  (select count(*) from matches) = 0,
  'tek taraflı beğeni eşleşme doğurmuyor'
);

-- İkinci çift (sahip başına tek aktif pet): kilitli yolda karşılıklı beğeni
-- eşleşmeyi yine doğuruyor.
select tests.seed_user('73333333-3333-3333-3333-333333333333');
select tests.seed_user('74444444-4444-4444-4444-444444444444');
select tests.seed_pet('7ccc3333-0000-0000-0000-000000000003', '73333333-3333-3333-3333-333333333333', 'Fıstık');
select tests.seed_pet('7ddd4444-0000-0000-0000-000000000004', '74444444-4444-4444-4444-444444444444', 'Karamel');

select tests.seed_match(
  '7ccc3333-0000-0000-0000-000000000003',
  '7ddd4444-0000-0000-0000-000000000004'
) as conversation_id \gset

select tests.assert(
  (select count(*) from matches
    where pet_a_id = '7ccc3333-0000-0000-0000-000000000003'
      and pet_b_id = '7ddd4444-0000-0000-0000-000000000004'
      and is_active) = 1
  and :'conversation_id' is not null,
  'kilitle birlikte karşılıklı beğeni eşleşmeyi ve konuşmayı doğuruyor'
);

rollback;
