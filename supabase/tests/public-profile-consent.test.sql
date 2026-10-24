-- A18 (20261024150000): yeni kullanıcı public doğmaz; public ⇒ geçerli rıza
-- (doğrudan UPDATE ve RPC'ler dahil); rıza geri çekilince after_match.

begin;

\echo '  public-profile-consent: rıza öncesi public yok'

insert into auth.users (id, email)
values ('a1111111-1111-1111-1111-111111111111', 'a1@test.local');

select tests.assert(
  (select owner_visibility = 'after_match' from profiles
   where id = 'a1111111-1111-1111-1111-111111111111'),
  'yeni kayıt (handle_new_user) after_match doğar'
);

update profiles
set birth_date = '1995-01-01', onboarded_at = now(), display_name = 'A'
where id = 'a1111111-1111-1111-1111-111111111111';

set local role authenticated;
select tests.act_as('a1111111-1111-1111-1111-111111111111');

select tests.assert_raises(
  $$update profiles set owner_visibility = 'public'
    where id = 'a1111111-1111-1111-1111-111111111111'$$,
  'rızasız kullanıcı doğrudan UPDATE ile public olamaz'
);
select tests.assert_raises(
  $$select update_my_owner_details('A', null, '1995-01-01', null, 'public', null, false, '{}', null)$$,
  'rızasız kullanıcı update_my_owner_details ile public olamaz'
);

update profiles set owner_visibility = 'hidden'
where id = 'a1111111-1111-1111-1111-111111111111';
select tests.assert(
  (select owner_visibility = 'hidden' from get_my_profile()),
  'rızasız kullanıcı hidden yapabilir'
);

select record_optional_legal_consent('public_profile_consent', '2026-test', true);
update profiles set owner_visibility = 'public'
where id = 'a1111111-1111-1111-1111-111111111111';
select tests.assert(
  (select owner_visibility = 'public' from get_my_profile()),
  'rızası olan kullanıcı public olabilir'
);

select record_optional_legal_consent('public_profile_consent', '2026-test', false);
select tests.assert(
  (select owner_visibility = 'after_match' from get_my_profile()),
  'rıza geri çekilince public profil after_match''e düşer'
);
select tests.assert_raises(
  $$update profiles set owner_visibility = 'public'
    where id = 'a1111111-1111-1111-1111-111111111111'$$,
  'geri çekme sonrası public yeniden reddedilir'
);

reset role;
rollback;
