-- Push izni hunisi olayları (20261031120000).

begin;

\echo '  push gözlemi: izin sonucu ve bildirime dokunma olayları kabul'

select tests.seed_user('11111111-1111-1111-1111-111111111111');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select track_product_event(
  'push_permission_result',
  '{"status": "registered", "source": "first_session"}'::jsonb
);
select track_product_event('notification_opened', '{"type": "message"}'::jsonb);

select tests.assert_raises(
  $$select track_product_event('push_prompt_shown', '{}'::jsonb)$$,
  'listede olmayan olay adı reddedilir'
);

reset role;

select tests.assert(
  (select count(*) from product_events
   where user_id = '11111111-1111-1111-1111-111111111111'
     and event_name in ('push_permission_result', 'notification_opened')) = 2,
  'iki yeni olay adı kısıttan geçiyor'
);

rollback;
