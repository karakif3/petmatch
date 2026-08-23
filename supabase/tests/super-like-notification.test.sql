-- Süper beğeni push bildirimi altyapısı (0048).
--
-- Edge function'ın kendisi (send-notification) Deno üzerinde çalışıyor ve
-- burada test edilmiyor; bu dosya yalnızca istemcinin bildirim isteğini
-- kurabilmesi için gereken veritabanı sözleşmesini kilitliyor:
-- `swipe_pet` artık kendi satırının id'sini de döndürüyor (eşleşme yoksa
-- bildirim olayının kimliği bu olur) ve `notification_deliveries`
-- 'super_like' event_type'ını kabul ediyor.

begin;

\echo '  super-like: swipe_pet satır id + notification_deliveries kısıtı'

select tests.seed_user('11111111-1111-1111-1111-111111111111');
select tests.seed_user('22222222-2222-2222-2222-222222222222');
select tests.assign_region('11111111-1111-1111-1111-111111111111', 'kadikoy');
select tests.assign_region('22222222-2222-2222-2222-222222222222', 'kadikoy');
select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luna');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Karam');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select match_id is null as match_is_null, swipe_id is not null as swipe_is_set
from swipe_pet('aaaa1111-0000-0000-0000-000000000001', 'bbbb2222-0000-0000-0000-000000000002', 'like', true)
\gset super_swipe_

select tests.assert(
  :'super_swipe_swipe_is_set'::boolean,
  'tek taraflı süper beğenide swipe_id dönüyor — bildirim olayının kimliği bu'
);

select tests.assert(
  :'super_swipe_match_is_null'::boolean,
  'karşılıksız süper beğenide match_id null — henüz eşleşme yok'
);

reset role;

set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');

select tests.assert(
  (select match_id from swipe_pet('bbbb2222-0000-0000-0000-000000000002', 'aaaa1111-0000-0000-0000-000000000001', 'like')) is not null,
  'karşılık verilince match_id doluyor'
);

reset role;

-- notification_deliveries kısıtı 'super_like'ı kabul ediyor (0029'daki
-- product_events hatasının aynısı burada YOK, kısıt zaten günceldi).
select tests.assert_raises(
  $$insert into notification_deliveries (event_type, event_id, recipient_id)
    values ('unknown_event', gen_random_uuid(), '11111111-1111-1111-1111-111111111111')$$,
  'tanımsız event_type reddediliyor'
);

insert into notification_deliveries (event_type, event_id, recipient_id, status)
values ('super_like', gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'skipped');

select tests.assert(
  (select count(*) from notification_deliveries where event_type = 'super_like') = 1,
  'super_like event_type kabul ediliyor'
);

rollback;
