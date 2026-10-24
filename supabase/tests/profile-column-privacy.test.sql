-- A17 (20261024140000): başkasının profil satırı RLS ile görünür olsa bile
-- hassas kolonlar tablodan okunamaz; kişi kendi tam satırını get_my_profile()
-- ile okur; keşif RPC'si yaş kovası ve cinsiyeti maskeleyerek vermeye devam eder.

begin;

\echo '  profile-column-privacy: profiles kolon grant''ı ve get_my_profile'

select tests.seed_user('91111111-1111-1111-1111-111111111111');
select tests.seed_user('92222222-2222-2222-2222-222222222222', 'female', 'public');
select tests.seed_user('93333333-3333-3333-3333-333333333333', 'male', 'after_match');
select tests.seed_pet('9aaa1111-0000-0000-0000-000000000001', '91111111-1111-1111-1111-111111111111', 'Ada');
select tests.seed_pet('9ccc3333-0000-0000-0000-000000000003', '93333333-3333-3333-3333-333333333333', 'Toprak');
select tests.seed_match('9aaa1111-0000-0000-0000-000000000001', '9ccc3333-0000-0000-0000-000000000003');

select tests.assert(
  not has_column_privilege('authenticated', 'public.profiles', 'birth_date', 'SELECT')
  and not has_column_privilege('authenticated', 'public.profiles', 'gender', 'SELECT')
  and not has_column_privilege('authenticated', 'public.profiles', 'last_active_at', 'SELECT')
  and not has_column_privilege('authenticated', 'public.profiles', 'region_slug', 'SELECT')
  and not has_column_privilege('authenticated', 'public.profiles', 'verification_status', 'SELECT')
  and not has_column_privilege('authenticated', 'public.profiles', 'connection_tag', 'SELECT'),
  'authenticated hassas profil kolonlarını SELECT edemez'
);

select tests.assert(
  (select array_agg(column_name::text order by column_name)
   from information_schema.column_privileges
   where table_schema = 'public' and table_name = 'profiles'
     and grantee = 'authenticated' and privilege_type = 'SELECT')
  = array['avatar_url','bio','city','display_name','id','interests','owner_social_open','owner_visibility'],
  'authenticated SELECT kolonları tam olarak güvenli liste'
);

select tests.assert(
  not has_any_column_privilege('anon', 'public.profiles', 'SELECT'),
  'anon profiles üzerinde hiçbir kolonu okuyamaz'
);

select tests.assert(
  has_function_privilege('authenticated', 'public.get_my_profile()', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_my_profile()', 'EXECUTE'),
  'get_my_profile() yalnız authenticated çağırabilir'
);

set local role authenticated;
select tests.act_as('91111111-1111-1111-1111-111111111111');

select tests.assert_raises(
  $$select birth_date from profiles where id = '92222222-2222-2222-2222-222222222222'$$,
  'A, public B''nin birth_date''ini okuyamaz'
);
select tests.assert_raises(
  $$select * from profiles where id = '92222222-2222-2222-2222-222222222222'$$,
  'A, select * ile B''nin satırını alamaz'
);
select tests.assert_raises(
  $$select birth_date from profiles where id = '93333333-3333-3333-3333-333333333333'$$,
  'A, eşleştiği after_match C''nin birth_date''ini okuyamaz'
);
select tests.assert(
  (select display_name is not null and avatar_url is not null
   from profiles where id = '92222222-2222-2222-2222-222222222222'),
  'A, public B''nin display_name/avatar_url''ini okur'
);
select tests.assert(
  (select count(*) from get_my_profile()) = 1
  and (select birth_date = '1995-01-01' and id = '91111111-1111-1111-1111-111111111111'
       from get_my_profile()),
  'A kendi tam satırını get_my_profile() ile okur'
);

with attempt as (
  update profiles set bio = 'yeni bio' where id = '91111111-1111-1111-1111-111111111111' returning 1
)
select count(*) as updated from attempt \gset
select tests.assert(:updated = 1, 'A kendi satırını doğrudan güncelleyebilir');

reset role;
rollback;
