-- Sahiplendirme: hayvanı olmayan kullanıcının yolu ve devir bütünlüğü.
--
-- Sahiplendirme huninin girişi: hayvanı olmayan biri gelir, sahiplenir, ana
-- döngüye girer. Bu yüzden petsiz kullanıcının ilanları GÖREBİLMESİ ve
-- başvurabilmesi gerekiyor — pets üzerindeki RLS ona hiçbir satır vermediği
-- halde.

begin;

\echo '  adoption: petsiz kullanıcı yolu ve devir'

select tests.seed_user('11111111-1111-1111-1111-111111111111');  -- ilan sahibi
select tests.seed_user('33333333-3333-3333-3333-333333333333');  -- petsiz başvuran
select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Pamuk');

-- --------------------------------------------------------------------------
-- Doğrulama kapısı
-- --------------------------------------------------------------------------

select tests.assert_raises(
  'update pets set goals = ''{playdate,adoption}''::match_goal[]
   where id = ''aaaa1111-0000-0000-0000-000000000001''',
  'doğrulanmamış hesap sahiplendirme ilanı açamıyor'
);

update profiles
set verification_status = 'approved', verified_at = now()
where id = '11111111-1111-1111-1111-111111111111';

update pets set goals = '{playdate,adoption}'
where id = 'aaaa1111-0000-0000-0000-000000000001';

select tests.assert(
  (select adoption_confirmed_at is not null from pets
   where id = 'aaaa1111-0000-0000-0000-000000000001'),
  'ilan açılınca teyit damgası vuruluyor'
);

-- --------------------------------------------------------------------------
-- Petsiz kullanıcı
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('33333333-3333-3333-3333-333333333333');

select tests.assert(
  (select count(*) from pets) = 0,
  'petsiz kullanıcı RLS üzerinden hiçbir pet göremiyor'
);

select tests.assert(
  (select count(*) from list_adoptable_pets()) = 1,
  'ama sahiplendirme listesini RPC üzerinden görebiliyor'
);

select express_adoption_interest('aaaa1111-0000-0000-0000-000000000001', 'Bahçem var');

select tests.assert(
  (select count(*) from adoption_interests where status = 'pending') = 1,
  'petsiz kullanıcı başvuru bırakabiliyor'
);

reset role;

-- --------------------------------------------------------------------------
-- Kabul → konuşma
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select respond_to_adoption_interest((select id from adoption_interests), true);
reset role;

select tests.assert(
  (select conversation_id is not null from adoption_interests),
  'kabul konuşmayı açıyor'
);

set local role authenticated;
select tests.act_as('33333333-3333-3333-3333-333333333333');

insert into messages (conversation_id, sender_id, body)
select conversation_id, '33333333-3333-3333-3333-333333333333', 'Ne zaman görüşebiliriz?'
from adoption_interests;

select tests.assert(
  (select count(*) from messages) = 1,
  'başvuran kabul sonrası mesajlaşabiliyor'
);

reset role;

-- --------------------------------------------------------------------------
-- Devir: sahiplik geçer, geçmiş kapanır
--
-- Kritik: yeni sahip eski sahibin sohbetlerini okumamalı, ve pet temiz bir
-- desteyle başlamalı.
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select complete_adoption((select id from adoption_interests where status = 'accepted'));
reset role;

select tests.assert(
  (select owner_id = '33333333-3333-3333-3333-333333333333' from pets
   where id = 'aaaa1111-0000-0000-0000-000000000001'),
  'pet yeni sahibine geçti'
);

select tests.assert(
  (select goals = '{playdate}'::match_goal[] from pets
   where id = 'aaaa1111-0000-0000-0000-000000000001'),
  'devirden sonra ilan kapandı'
);

select tests.assert(
  (select count(*) from swipes
   where from_pet_id = 'aaaa1111-0000-0000-0000-000000000001'
      or to_pet_id = 'aaaa1111-0000-0000-0000-000000000001') = 0,
  'swipe geçmişi sıfırlandı'
);

select tests.assert(
  (select count(*) from conversations where is_active) = 0,
  'devir tüm konuşmaları kapattı'
);

-- --------------------------------------------------------------------------
-- Bayat ilan
-- --------------------------------------------------------------------------

update profiles set verification_status = 'approved'
where id = '33333333-3333-3333-3333-333333333333';
update pets set goals = '{playdate,adoption}'
where id = 'aaaa1111-0000-0000-0000-000000000001';
update pets set adoption_confirmed_at = now() - interval '30 days'
where id = 'aaaa1111-0000-0000-0000-000000000001';

select tests.assert(
  pause_stale_adoption_listings(14) = 1,
  'teyitsiz kalan ilan otomatik duraklıyor'
);

rollback;
