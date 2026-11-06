-- Mağaza puanı istemi olayı (20261108120000).

begin;

\echo '  store-review: store_review_requested kısıttan geçiyor'

select tests.seed_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
set local role authenticated;
select tests.act_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select track_product_event('store_review_requested', '{}'::jsonb);
reset role;

select tests.assert(
  exists (select 1 from product_events
          where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
            and event_name = 'store_review_requested'),
  'puan istemi olayı kaydediliyor'
);

rollback;
