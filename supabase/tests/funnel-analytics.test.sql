-- Huni analitiği (20261104120000): yeni olay adları ve kohort hunisi.

begin;

\echo '  funnel: yeni olaylar kabul, kohort hunisi tablolardan, yalnız moderatör'

select tests.seed_user('11111111-1111-1111-1111-111111111111'); -- moderatör
insert into app_user_roles (user_id, role)
values ('11111111-1111-1111-1111-111111111111', 'moderator');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
create temp table funnel_before as
select (s->>'key') as key, (s->>'count')::int as total
from jsonb_array_elements(get_signup_funnel(30)->'steps') s;
reset role;

-- A: onaylı, eşleşti, yazdı, yanıt aldı. B: onaylı, eşleşti, yanıt verdi.
-- C: onaysız, onboarding'i bitirmedi.
select tests.seed_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tests.seed_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tests.seed_user('cccccccc-cccc-cccc-cccc-cccccccccccc');
-- Test imajının auth şemasında created_at'in varsayılanı yok; canlıda GoTrue yazıyor.
update auth.users set created_at = now()
where id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'cccccccc-cccc-cccc-cccc-cccccccccccc');
update auth.users set confirmed_at = now()
where id in ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
update profiles set onboarded_at = null where id = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

select tests.seed_pet('a0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tests.seed_pet('b0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

create temp table funnel_conv as
select tests.seed_match(
  'a0000000-0000-0000-0000-00000000000a',
  'b0000000-0000-0000-0000-00000000000b'
) as id;
grant select on funnel_conv to authenticated;

insert into messages (conversation_id, sender_id, body)
select id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Merhaba!' from funnel_conv;
insert into messages (conversation_id, sender_id, body)
select id, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Selam!' from funnel_conv;

set local role authenticated;

-- Yeni olay adları kısıttan geçiyor.
select tests.act_as('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select track_product_event('onboarding_step_completed', '{"step": 1}'::jsonb);
select track_product_event('waitlist_joined', '{"notify": true}'::jsonb);
select track_product_event('app_opened', '{}'::jsonb);
select track_product_event('message_sent', '{"is_first": true, "is_reply": false}'::jsonb);
select track_product_event('user_blocked', '{"source": "chat"}'::jsonb);
select track_product_event('match_unmatched', '{}'::jsonb);
select track_product_event('filter_applied', '{"active_count": 2}'::jsonb);
select track_product_event('empty_deck_seen', '{}'::jsonb);

-- Moderatör olmayan huniyi göremez.
select tests.assert_raises(
  $$select get_signup_funnel(30)$$,
  'moderatör olmayan get_signup_funnel çağıramaz'
);

select tests.act_as('11111111-1111-1111-1111-111111111111');
select tests.assert_raises(
  $$select get_signup_funnel(0)$$,
  'geçersiz gün aralığı reddedilir'
);

create temp table funnel_after as
select (s->>'key') as key, (s->>'count')::int as total
from jsonb_array_elements(get_signup_funnel(30)->'steps') s;
reset role;

select tests.assert(
  (select string_agg(key, ',') from funnel_after) =
    'signed_up,email_confirmed,onboarded,swiped,matched,messaged,two_way,meetup_proposed,meetup_accepted',
  'huni adımları sabit sırada'
);

select tests.assert(
  (select string_agg(a.key || '=' || (a.total - b.total), ',' order by a.key)
   from funnel_after a join funnel_before b using (key))
  = 'email_confirmed=2,matched=2,meetup_accepted=0,meetup_proposed=0,messaged=2,onboarded=2,signed_up=3,swiped=2,two_way=2',
  'kohort hunisi tablolardan doğru sayıyor: ' || coalesce((select string_agg(a.key || '=' || (a.total - b.total), ',' order by a.key)
   from funnel_after a join funnel_before b using (key)), 'null')
);

select tests.assert(
  (select count(*) from product_events
   where user_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa') = 8,
  'sekiz yeni olay adı kaydedildi'
);

rollback;
