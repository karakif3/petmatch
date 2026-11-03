-- Kişisel mesaj push'u ve rozet sayısı (20261105120000).

begin;

\echo '  mesaj push: önizleme tercihi, eski imza uyumu, okunmamış sayısı'

select tests.seed_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tests.seed_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
select tests.seed_pet('a0000000-0000-0000-0000-00000000000a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
select tests.seed_pet('b0000000-0000-0000-0000-00000000000b', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

create temp table preview_conv as
select tests.seed_match(
  'a0000000-0000-0000-0000-00000000000a',
  'b0000000-0000-0000-0000-00000000000b'
) as id;

insert into messages (conversation_id, sender_id, body)
select id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Merhaba!' from preview_conv;
insert into messages (conversation_id, sender_id, body)
select id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Parkta mısınız?' from preview_conv;
insert into messages (conversation_id, sender_id, body, read_at)
select id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Okunmuş', now() from preview_conv;
insert into messages (conversation_id, sender_id, body)
select id, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Kendi mesajım' from preview_conv;

select tests.assert(
  (select notify_message_preview from discovery_preferences
   where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'önizleme varsayılanı açık'
);

-- Edge Function service_role ile çağırıyor; burada sahip (postgres) olarak.
select tests.assert(
  unread_message_count('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb') = 2,
  'rozet: karşı taraftan gelen okunmamışlar (kendi mesajı ve okunmuş hariç)'
);

select tests.assert(
  has_function_privilege('service_role', 'unread_message_count(uuid)', 'execute')
  and not has_function_privilege('authenticated', 'unread_message_count(uuid)', 'execute')
  and not has_function_privilege('anon', 'unread_message_count(uuid)', 'execute'),
  'okunmamış sayısı yalnız service_role''e açık'
);

set local role authenticated;
select tests.act_as('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');


-- Eski istemci: iki parametre — önizleme tercihine dokunmaz.
select update_notification_preferences(true, true);
select update_notification_preferences(
  p_notify_on_match => true,
  p_notify_on_message => true,
  p_message_preview => false
);
select update_notification_preferences(false, true);
reset role;

select tests.assert(
  (select not notify_message_preview and not notify_on_match from discovery_preferences
   where user_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
  'önizleme kapatılabiliyor; iki parametreli çağrı onu geri açmıyor'
);

rollback;
