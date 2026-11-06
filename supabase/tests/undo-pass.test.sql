-- Kaydırmayı geri al (20261106120000).

begin;

\echo '  undo_pass: yalnız kendi, taze, geç kararı'

select tests.seed_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tests.seed_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tests.seed_user('cccccccc-cccc-cccc-cccc-cccccccccccc');
select tests.seed_pet('a0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tests.seed_pet('b0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tests.seed_pet('c0000000-0000-0000-0000-00000000000c', 'cccccccc-cccc-cccc-cccc-cccccccccccc');

-- A: B'yi geçti (taze), C'yi beğendi. Eski bir geç de var (B'nin A'yı geçmesi, 5 dk önce).
insert into swipes (from_pet_id, to_pet_id, actor_id, direction) values
  ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'pass'),
  ('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000c', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'like');
insert into swipes (from_pet_id, to_pet_id, actor_id, direction, created_at) values
  ('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'pass', now() - interval '5 minutes');

set local role authenticated;

-- Başkası A'nın kararını geri alamaz.
select tests.act_as('cccccccc-cccc-cccc-cccc-cccccccccccc');
select tests.assert_raises(
  $$select undo_pass('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b')$$,
  'başkasının geç kararı geri alınamaz'
);

select tests.act_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tests.assert_raises(
  $$select undo_pass('a0000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-00000000000c')$$,
  'beğeni geri alınamaz'
);
select undo_pass('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');
select tests.assert_raises(
  $$select undo_pass('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b')$$,
  'aynı karar iki kez geri alınamaz'
);
select track_product_event('swipe_undone', '{}'::jsonb);

select tests.act_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tests.assert_raises(
  $$select undo_pass('b0000000-0000-0000-0000-00000000000b', 'a0000000-0000-0000-0000-00000000000a')$$,
  'süresi geçmiş geç kararı geri alınamaz'
);

reset role;

select tests.assert(
  not exists (
    select 1 from swipes
    where from_pet_id = 'a0000000-0000-0000-0000-00000000000a'
      and to_pet_id = 'b0000000-0000-0000-0000-00000000000b'
  )
  and exists (
    select 1 from swipes
    where from_pet_id = 'a0000000-0000-0000-0000-00000000000a'
      and to_pet_id = 'c0000000-0000-0000-0000-00000000000c'
  )
  and exists (
    select 1 from swipes
    where from_pet_id = 'b0000000-0000-0000-0000-00000000000b'
      and to_pet_id = 'a0000000-0000-0000-0000-00000000000a'
  ),
  'yalnız taze geç silindi; beğeni ve eski geç duruyor'
);

rollback;
