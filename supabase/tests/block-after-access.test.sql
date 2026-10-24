-- Engel sonrası erişim (20261024130000, G03): engel kaydı istemciden
-- değiştirilemez/silinemez; engel ve unmatch sonrasında ephemeral Realtime
-- kanalı ve karşı tarafın sahip profili kapanır.

begin;

\echo '  block-after-access: engel sonrası kanal, profil ve engel kaydı'

select tests.seed_user('81111111-1111-1111-1111-111111111111');
select tests.seed_user('82222222-2222-2222-2222-222222222222');
select tests.seed_user('83333333-3333-3333-3333-333333333333');
select tests.seed_pet('8aaa1111-0000-0000-0000-000000000001', '81111111-1111-1111-1111-111111111111', 'Ada');
select tests.seed_pet('8bbb2222-0000-0000-0000-000000000002', '82222222-2222-2222-2222-222222222222', 'Fındık');
select tests.seed_pet('8ccc3333-0000-0000-0000-000000000003', '83333333-3333-3333-3333-333333333333', 'Toprak');

select tests.seed_match('8aaa1111-0000-0000-0000-000000000001', '8bbb2222-0000-0000-0000-000000000002') as ab \gset
select tests.seed_match('8aaa1111-0000-0000-0000-000000000001', '8ccc3333-0000-0000-0000-000000000003') as ac \gset

-- Engelden önce: iki taraf da A–B kanalına ve karşı profile erişir.
set local role authenticated;
select tests.act_as('82222222-2222-2222-2222-222222222222');
select tests.assert(
  can_access_conversation_realtime('conversation:' || :'ab' || ':ephemeral'),
  'engelden önce B, A–B kanalına erişir'
);
select tests.assert(
  (select count(*) from get_conversation_owner_profile(:'ab')) = 1,
  'engelden önce B, A''nın sahip profilini okur'
);
select tests.assert(
  not can_access_conversation_realtime('conversation:' || :'ac' || ':ephemeral'),
  'kontrol: katılımcı olmayan B, A–C kanalına erişemez'
);
reset role;

-- A, B'yi engeller.
set local role authenticated;
select tests.act_as('81111111-1111-1111-1111-111111111111');
select block_user('82222222-2222-2222-2222-222222222222');

select tests.assert(
  (select count(*) from blocks where blocked_id = '82222222-2222-2222-2222-222222222222') = 1,
  'kontrol: A kendi engel kaydını görür'
);

with attack as (
  update blocks set blocked_id = '83333333-3333-3333-3333-333333333333' returning 1
)
select count(*) as moved from attack \gset
select tests.assert(:moved = 0, 'engelleyen A, engel kaydını başka kullanıcıya taşıyamaz');

with attack as (delete from blocks returning 1)
select count(*) as removed from attack \gset
select tests.assert(:removed = 0, 'engelleyen A, engeli doğrudan DELETE ile kaldıramaz');

select tests.assert_raises(
  $$insert into blocks (blocker_id, blocked_id)
    values ('81111111-1111-1111-1111-111111111111', '83333333-3333-3333-3333-333333333333')$$,
  'engel doğrudan tabloya yazılamaz (tek yol block_user)'
);

select tests.assert(
  not can_access_conversation_realtime('conversation:' || :'ab' || ':ephemeral'),
  'engelleyen A, kapanmış A–B kanalına erişemez'
);
select tests.assert(
  can_access_conversation_realtime('conversation:' || :'ac' || ':ephemeral'),
  'kontrol: A, aktif A–C kanalına erişir'
);
reset role;

-- Engellenen B.
set local role authenticated;
select tests.act_as('82222222-2222-2222-2222-222222222222');
select tests.assert(
  not can_access_conversation_realtime('conversation:' || :'ab' || ':ephemeral'),
  'engellenen B, A–B ephemeral kanalına erişemez'
);
select tests.assert(
  (select count(*) from get_conversation_owner_profile(:'ab')) = 0,
  'engellenen B, get_conversation_owner_profile ile A''nın profilini okuyamaz'
);
with attack as (delete from blocks returning 1)
select count(*) as removed_by_blocked from attack \gset
select tests.assert(:removed_by_blocked = 0, 'kontrol: engellenen B, A''nın engelini silemez');
reset role;

-- Unmatch: engel yokken de kapanan konuşmanın kanalı kapanır.
set local role authenticated;
select tests.act_as('83333333-3333-3333-3333-333333333333');
select unmatch_conversation(:'ac');
select tests.assert(
  not can_access_conversation_realtime('conversation:' || :'ac' || ':ephemeral'),
  'unmatch sonrası C, A–C kanalına erişemez'
);
reset role;

set local role authenticated;
select tests.act_as('81111111-1111-1111-1111-111111111111');
select tests.assert(
  not can_access_conversation_realtime('conversation:' || :'ac' || ':ephemeral'),
  'unmatch sonrası A, A–C kanalına erişemez'
);
reset role;

rollback;
