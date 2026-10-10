-- Yazma tabanlı keep-alive (20261010120000).
--
-- Gerçek token yalnız GitHub secret'ında; test kendi token'ının özetini
-- transaction içinde ops_settings'e koyar.

begin;

\echo '  keep-alive: token kapısı, yazma, sabit boyut, erişim'

update ops_settings
set value = encode(sha256(convert_to('test-token', 'UTF8')), 'hex')
where key = 'keepalive_token_sha256';

select tests.assert(
  has_function_privilege('anon', 'keep_alive(text, text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'keep_alive(text, text)', 'EXECUTE'),
  'keep_alive yalnız anon (zamanlayıcı) tarafından çağrılabilir'
);

select tests.assert(
  not has_table_privilege('anon', 'ops_keepalive', 'SELECT')
  and not has_table_privilege('anon', 'ops_keepalive', 'INSERT')
  and not has_table_privilege('anon', 'ops_settings', 'SELECT'),
  'anon tablolara doğrudan erişemez (token özeti okunamaz)'
);

set local role anon;

select tests.assert_raises(
  $$select * from keep_alive('yanlis-token')$$,
  'yanlış token reddedilir'
);

select tests.assert_raises(
  $$select * from keep_alive(null)$$,
  'token yoksa reddedilir'
);

select tests.assert(
  (select beats from keep_alive('test-token')) = 1,
  'doğru token bir kalpatışı yazar'
);

reset role;

select tests.assert(
  (select count(*) from ops_keepalive where source = 'github-actions') = 1,
  'kalpatışı varsayılan kaynakla kaydedildi'
);

set local role anon;

select count(*) from (
  select keep_alive('test-token', 'test') from generate_series(1, 60)
) as calls;

reset role;

select tests.assert(
  (select count(*) from ops_keepalive) = 50,
  'tablo en son 50 kalpatışını tutar'
);

select tests.assert(
  (select min(id) from ops_keepalive) > 1,
  'en eski kalpatışları silinir'
);

rollback;
