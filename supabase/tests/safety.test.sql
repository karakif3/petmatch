-- Güvenlik davranışı: engelleme zinciri ve yazma yolu sertleştirmesi.
--
-- Bir tanışma uygulamasında en kritik yol bu. Engelleme "profili gizlemek"
-- değil, ilişkiyi tamamen kesmek demek: eşleşme, konuşma, mesaj yazma hakkı.

begin;

\echo '  safety: engelleme zinciri ve yazma yolları'

select tests.seed_user('11111111-1111-1111-1111-111111111111');
select tests.seed_user('22222222-2222-2222-2222-222222222222');
select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Tarcin');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Boncuk');

select tests.seed_match(
  'aaaa1111-0000-0000-0000-000000000001',
  'bbbb2222-0000-0000-0000-000000000002'
) as conversation_id \gset

select tests.assert(
  (select count(*) from matches where is_active) = 1
  and (select count(*) from conversations where is_active) = 1,
  'karşılıklı beğeni eşleşmeyi ve konuşmayı açıyor'
);

-- --------------------------------------------------------------------------
-- Yazma yolu sertleştirmesi (0005) — hâlâ geçerli mi
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

-- Veri değiştiren CTE alt sorguya gömülemez; sonucu önce değişkene alıyoruz.
with attack as (
  update matches set pet_b_id = 'aaaa1111-0000-0000-0000-000000000001' returning 1
)
select count(*) as hijacked from attack \gset

select tests.assert(:hijacked = 0, 'eşleşme satırı başka bir pete yönlendirilemiyor');

insert into messages (conversation_id, sender_id, body)
values (:'conversation_id', '11111111-1111-1111-1111-111111111111', 'selam');

reset role;
set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');

with attack as (update messages set body = 'ele geçirildi' returning 1)
select count(*) as edited from attack \gset

select tests.assert(:edited = 0, 'karşı tarafın mesaj metni düzenlenemiyor');

reset role;
set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

with attempt as (delete from pets returning 1)
select count(*) as deleted from attempt \gset

select tests.assert(:deleted = 0, 'pet silinemiyor (karşı tarafın sohbet geçmişini götürürdü)');

-- --------------------------------------------------------------------------
-- Engelleme zinciri
-- --------------------------------------------------------------------------

select block_user('22222222-2222-2222-2222-222222222222');
reset role;

select tests.assert(
  (select count(*) from matches where is_active) = 0,
  'engelleme eşleşmeyi kapatıyor'
);

select tests.assert(
  (select count(*) from conversations where is_active) = 0,
  'engelleme konuşmayı da kapatıyor'
);

set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');

select tests.assert_raises(
  format(
    'insert into messages (conversation_id, sender_id, body) values (%L, %L, %L)',
    :'conversation_id', '22222222-2222-2222-2222-222222222222', 'engellemeden sonra'
  ),
  'engellenen taraf artık mesaj yazamıyor'
);

select tests.assert(
  (select count(*) from profiles) <= 1,
  'engellenen taraf karşı profili göremiyor'
);

reset role;
rollback;
