-- Sahip "tanışma amacı" gevşetmesi + bağlantı etiketi + rıza altyapısı
-- (`0066`). Asıl iddia: `hidden` hâlâ engelleniyor ama `after_match` artık
-- serbest — önceki kural yalnızca `public`'e izin veriyordu.

begin;

\echo '  owner-connection: açık + eşleşince görünür artık serbest'

select tests.seed_user('11111111-1111-1111-1111-111111111111');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert_raises(
  $$select update_my_owner_details(
      'Ayşe', null, '1995-01-01'::date, null, 'hidden', null, true, '{}', null
    )$$,
  'gizli + açık hâlâ reddediliyor'
);

select tests.assert_raises(
  $$select update_my_owner_details(
      null, null, '1995-01-01'::date, null, 'after_match', null, true, '{}', null
    )$$,
  'ad yoksa açık modu yine reddediliyor'
);

select update_my_owner_details(
  'Ayşe', null, '1995-01-01'::date, null, 'after_match',
  '11111111-1111-1111-1111-111111111111/avatar.jpg', true, '{}', 'new_friends'
);

select tests.assert(
  (select owner_visibility = 'after_match' and owner_social_open and connection_tag = 'new_friends'
   from profiles where id = '11111111-1111-1111-1111-111111111111'),
  'eşleşince görünür + açık artık kaydediliyor, etiket de kalıcı'
);

select tests.assert_raises(
  $$select update_my_owner_details(
      'Ayşe', null, '1995-01-01'::date, null, 'public',
      '11111111-1111-1111-1111-111111111111/avatar.jpg', true, '{}', 'gecersiz_etiket'
    )$$,
  'tanımsız bağlantı etiketi reddediliyor'
);

select update_my_owner_details(
  'Ayşe', null, '1995-01-01'::date, null, 'public',
  '11111111-1111-1111-1111-111111111111/avatar.jpg', false, '{}', 'new_friends'
);

select tests.assert(
  (select connection_tag is null from profiles where id = '11111111-1111-1111-1111-111111111111'),
  'sosyal mod kapanınca etiket de temizleniyor — kalıp yanlış sinyal vermesin'
);

reset role;

\echo '  legal: opsiyonel rıza tipleri gender_preference_consent dahil genişledi'

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select record_optional_legal_consent('gender_preference_consent', 'v1', true);

select tests.assert(
  (select count(*) from legal_acceptances
   where user_id = '11111111-1111-1111-1111-111111111111'
     and document_type = 'gender_preference_consent'
     and accepted) = 1,
  'yeni rıza tipi kaydedilebiliyor'
);

select tests.assert_raises(
  $$select record_optional_legal_consent('tanimsiz_tip', 'v1', true)$$,
  'tanımsız rıza tipi hâlâ reddediliyor'
);

reset role;

rollback;
