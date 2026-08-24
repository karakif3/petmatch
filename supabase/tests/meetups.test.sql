-- Yapılandırılmış buluşma: öneri → yanıt → iptal kuralları.
--
-- Burada kilitlenen asıl şey yetki ayrımı: öneriyi KARŞI taraf yanıtlar.
-- Öneren kendi önerisini onaylayabilseydi "kabul edildi" hiçbir şey ifade
-- etmezdi.

begin;

\echo '  meetups: buluşma kaydı'

select tests.seed_user('11111111-1111-1111-1111-111111111111'); -- ben
select tests.seed_user('22222222-2222-2222-2222-222222222222'); -- karşı taraf
select tests.seed_user('33333333-3333-3333-3333-333333333333'); -- yabancı

select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luna');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Karam');
select tests.seed_pet('cccc3333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Zorlu');

-- Konuşma id'si psql değişkenine alınıyor. Geçici tablo kullanılamıyor:
-- tablo superuser'a ait oluyor ve rol `authenticated`'a düşünce okunamıyor.
select tests.seed_match(
  'aaaa1111-0000-0000-0000-000000000001',
  'bbbb2222-0000-0000-0000-000000000002'
) as conv \gset

-- Biri doğrulanmış, biri değil: doğrulama şartını kanıtlamak için.
insert into meetup_places (id, region_slug, name, is_verified, is_active, sort_order)
values
  ('eeee0000-0000-0000-0000-000000000001', 'kadikoy', 'Test Parkı (doğrulanmış)', true,  true, 901),
  ('eeee0000-0000-0000-0000-000000000002', 'kadikoy', 'Test Parkı (doğrulanmamış)', false, true, 902)
on conflict do nothing;

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

-- Doğrulanmamış yere öneri REDDEDİLİR.
select tests.assert_raises(
  format(
    'select propose_meetup(%L, %L, now() + interval ''2 days'')',
    :'conv', 'eeee0000-0000-0000-0000-000000000002'
  ),
  'doğrulanmamış yere buluşma önerilemiyor'
);

-- Geçmişe öneri REDDEDİLİR.
select tests.assert_raises(
  format(
    'select propose_meetup(%L, %L, now() - interval ''1 day'')',
    :'conv', 'eeee0000-0000-0000-0000-000000000001'
  ),
  'geçmişe buluşma önerilemiyor'
);

-- Geçerli öneri.
select propose_meetup(
  :'conv',
  'eeee0000-0000-0000-0000-000000000001',
  now() + interval '2 days'
) as meetup \gset

-- Önce SECURITY DEFINER görünümüyle (RLS'i atlar), sonra doğrudan tabloyla
-- (RLS'i sınar). İkisi de geçmeli.
select tests.assert(
  (select status from conversation_meetup(:'conv')) = 'proposed',
  'öneri kaydedildi'
);
select tests.assert(
  (select count(*) from meetups where id = :'meetup') = 1,
  'katılımcı buluşmayı RLS altında okuyabiliyor'
);

-- Aynı sohbette ikinci canlı buluşma OLMAZ.
select tests.assert_raises(
  format(
    'select propose_meetup(%L, %L, now() + interval ''3 days'')',
    :'conv', 'eeee0000-0000-0000-0000-000000000001'
  ),
  'sohbette aynı anda tek canlı buluşma olabiliyor'
);

-- ÖNEREN kendi önerisini onaylayamaz.
select tests.assert_raises(
  format('select respond_to_meetup(%L, true)', :'meetup'),
  'öneren kendi buluşmasını onaylayamıyor'
);

-- Sohbette olmayan biri yanıtlayamaz.
select tests.act_as('33333333-3333-3333-3333-333333333333');
select tests.assert_raises(
  format('select respond_to_meetup(%L, true)', :'meetup'),
  'sohbette olmayan yanıtlayamıyor'
);
select tests.assert(
  (select count(*) from meetups) = 0,
  'yabancı buluşmayı okuyamıyor'
);

-- Karşı taraf onaylar.
select tests.act_as('22222222-2222-2222-2222-222222222222');
select respond_to_meetup(:'meetup', true);
select tests.assert(
  (select status from meetups where id = :'meetup') = 'accepted',
  'karşı taraf onaylayabiliyor'
);

-- Onaylanmışa tekrar yanıt verilemez.
select tests.assert_raises(
  format('select respond_to_meetup(%L, false)', :'meetup'),
  'kapanmış öneriye tekrar yanıt verilemiyor'
);

-- Canlı buluşma sorgusu doğru satırı veriyor.
select tests.assert(
  (select place_name from conversation_meetup(:'conv'))
    = 'Test Parkı (doğrulanmış)',
  'canlı buluşma yer adıyla dönüyor'
);

-- İptal iki taraftan da yapılabilir; iptalden sonra yeni öneri açılabilir.
select cancel_meetup(:'meetup');
select tests.assert(
  (select count(*) from conversation_meetup(:'conv')) = 0,
  'iptal edilen buluşma canlı sayılmıyor'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');
select tests.assert(
  propose_meetup(
    :'conv',
    'eeee0000-0000-0000-0000-000000000001',
    now() + interval '5 days'
  ) is not null,
  'iptalden sonra yeni buluşma önerilebiliyor'
);

rollback;
