-- Gelen kutusu sinyalleri: "sıra sende" ve buluşma sorusunun zamanlaması.

begin;

\echo '  inbox: sıra göstergesi ve buluşma geri beslemesi'

select tests.seed_user('11111111-1111-1111-1111-111111111111');
select tests.seed_user('22222222-2222-2222-2222-222222222222');
select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222');

select tests.seed_match(
  'aaaa1111-0000-0000-0000-000000000001',
  'bbbb2222-0000-0000-0000-000000000002'
) as conversation_id \gset

-- --------------------------------------------------------------------------
-- Sıra sende
-- --------------------------------------------------------------------------

-- Zaman damgaları AÇIKÇA veriliyor: transaction içinde `now()` sabit olduğu
-- için varsayılan bırakılırsa tüm mesajlar aynı ana düşer ve "son mesaj"
-- seçimi anlamını yitirir.
insert into messages (conversation_id, sender_id, body, created_at)
values (:'conversation_id', '22222222-2222-2222-2222-222222222222', 'Selam!',
        now() - interval '10 minutes');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select awaiting_my_reply from list_my_conversations()),
  'son sözü karşı taraf söylediyse sıra bende görünüyor'
);

insert into messages (conversation_id, sender_id, body, created_at)
values (:'conversation_id', '11111111-1111-1111-1111-111111111111', 'Merhaba!',
        now() - interval '9 minutes');

select tests.assert(
  not (select awaiting_my_reply from list_my_conversations()),
  'yanıt verince sıra benden çıkıyor'
);

reset role;

set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');

select tests.assert(
  (select awaiting_my_reply from list_my_conversations()),
  'aynı anda sıra karşı tarafta görünüyor'
);

reset role;

-- --------------------------------------------------------------------------
-- Buluşma sorusu — zamanlama
-- --------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  not (select ask_meetup_feedback from list_my_conversations()),
  'iki mesajlık taze konuşmada buluşma sorusu sorulmuyor'
);

reset role;

-- Konuşmayı olgunlaştır: dört mesaj, iki taraf, üç günden eski.
insert into messages (conversation_id, sender_id, body, created_at)
values
  (:'conversation_id', '22222222-2222-2222-2222-222222222222', 'Parkta buluşalım mı?',
   now() - interval '5 days'),
  (:'conversation_id', '11111111-1111-1111-1111-111111111111', 'Olur!',
   now() - interval '5 days' + interval '1 minute');
update messages set created_at = now() - interval '5 days' - interval '1 hour'
where conversation_id = :'conversation_id'
  and created_at > now() - interval '1 day';

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select ask_meetup_feedback from list_my_conversations()),
  'olgunlaşmış iki yönlü konuşmada buluşma sorusu soruluyor'
);

select record_meetup_feedback(:'conversation_id', 'met');

select tests.assert(
  not (select ask_meetup_feedback from list_my_conversations()),
  'cevap verdikten sonra soru tekrar sorulmuyor'
);

select tests.assert(
  (select count(*) from meetup_feedback) = 1,
  'kendi cevabımı görüyorum'
);

reset role;

-- Karşı tarafın cevabı bana görünmemeli: "o buluştuk dedi mi" bilgisi
-- dürüst cevabı bozar.
set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');

select tests.assert(
  (select count(*) from meetup_feedback) = 0,
  'karşı tarafın buluşma cevabı bana görünmüyor'
);

select tests.assert(
  (select ask_meetup_feedback from list_my_conversations()),
  'karşı tarafa soru hâlâ açık — cevaplar bağımsız'
);

reset role;

-- --------------------------------------------------------------------------
-- Tek yönlü konuşma olgunlaşmış sayılmaz
-- --------------------------------------------------------------------------

select tests.seed_user('33333333-3333-3333-3333-333333333333');
select tests.seed_pet('cccc3333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333');
select tests.seed_match(
  'aaaa1111-0000-0000-0000-000000000001',
  'cccc3333-0000-0000-0000-000000000003'
) as lonely_conversation \gset

insert into messages (conversation_id, sender_id, body, created_at)
select :'lonely_conversation', '11111111-1111-1111-1111-111111111111',
       'mesaj ' || i, now() - interval '5 days'
from generate_series(1, 5) as i;

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  not (select ask_meetup_feedback from list_my_conversations()
       where conversation_id = :'lonely_conversation'),
  'karşı taraf hiç yazmadıysa buluşma sorusu sorulmuyor'
);

reset role;
rollback;
