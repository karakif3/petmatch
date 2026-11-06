-- Davet olayı (20261107120000).

begin;

\echo '  invite: invite_shared ve swipe_undone kısıttan geçiyor'

select tests.seed_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
set local role authenticated;
select tests.act_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select track_product_event(
  'invite_shared',
  '{"surface": "discovery_empty", "channel": null, "has_url": false}'::jsonb
);
select track_product_event('swipe_undone', '{}'::jsonb);
reset role;

select tests.assert(
  (select count(*) from product_events
   where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
     and event_name in ('invite_shared', 'swipe_undone')) = 2,
  'davet ve geri alma olayları kaydediliyor'
);

rollback;
