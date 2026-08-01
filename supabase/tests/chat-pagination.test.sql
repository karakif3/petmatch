-- Sohbet sayfalama: keyset (cursor) doğruluğu.
--
-- İstemci `loadMessages` artık offset/limit değil keyset kullanıyor:
-- (created_at, id) ikilisinden daha eskisini ister. Buradaki testler o
-- yüklemin SQL karşılığını doğruluyor — sayfalar çakışmamalı ve hiçbir mesaj
-- atlanmamalı.
--
-- Kritik durum: aynı zaman damgasına düşen mesajlar. Yalnızca `created_at`
-- ile sayfalansaydı bunlardan biri kaybolurdu; `id` ikincil sıra anahtarı
-- tam olarak bunu kapatıyor.

begin;

\echo '  chat: keyset sayfalama'

select tests.seed_user('11111111-1111-1111-1111-111111111111');
select tests.seed_user('22222222-2222-2222-2222-222222222222');
select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222');

select tests.seed_match(
  'aaaa1111-0000-0000-0000-000000000001',
  'bbbb2222-0000-0000-0000-000000000002'
) as conversation_id \gset

-- 25 mesaj; 10 tanesi BİREBİR aynı zaman damgasında.
insert into messages (conversation_id, sender_id, body, created_at)
select
  :'conversation_id',
  '11111111-1111-1111-1111-111111111111',
  'mesaj ' || i,
  case
    when i <= 10 then timestamptz '2026-01-01 10:00:00+00'
    else timestamptz '2026-01-01 10:00:00+00' + (i || ' minutes')::interval
  end
from generate_series(1, 25) as i;

select tests.assert(
  (select count(*) from messages where conversation_id = :'conversation_id') = 25,
  'kurulum: 25 mesaj (10 tanesi aynı damgada)'
);

-- İlk sayfa: en yeni 10.
create temp table page1 as
select id, created_at from messages
where conversation_id = :'conversation_id'
order by created_at desc, id desc
limit 10;

select created_at as c1, id as i1 from page1 order by created_at asc, id asc limit 1 \gset

-- İkinci sayfa: imleçten daha eskisi (istemcideki .or(...) yükleminin eşi).
create temp table page2 as
select id, created_at from messages
where conversation_id = :'conversation_id'
  and (created_at < :'c1' or (created_at = :'c1' and id < :'i1'))
order by created_at desc, id desc
limit 10;

select created_at as c2, id as i2 from page2 order by created_at asc, id asc limit 1 \gset

create temp table page3 as
select id, created_at from messages
where conversation_id = :'conversation_id'
  and (created_at < :'c2' or (created_at = :'c2' and id < :'i2'))
order by created_at desc, id desc
limit 10;

select tests.assert(
  (select count(*) from page1) = 10
  and (select count(*) from page2) = 10
  and (select count(*) from page3) = 5,
  'sayfalar 10 + 10 + 5 olarak bölünüyor'
);

select tests.assert(
  not exists (select 1 from page1 join page2 using (id))
  and not exists (select 1 from page2 join page3 using (id))
  and not exists (select 1 from page1 join page3 using (id)),
  'sayfalar çakışmıyor'
);

select tests.assert(
  (select count(distinct id) from (
     select id from page1 union all select id from page2 union all select id from page3
   ) s) = 25,
  'üç sayfa tüm mesajları kapsıyor — aynı damgadaki hiçbiri atlanmadı'
);

rollback;
