-- Operasyon merkezi: "Son hatalar" listesi sayaçla ("İstemci hatası · 24s")
-- AYNI pencereyi konuşmalı (`0065`). Aksi halde sayaç "0" derken panel
-- günler önce oluşup çoktan düzeltilmiş hataları göstermeye devam eder.

begin;

\echo '  operations: son hatalar 24 saatlik pencereye uyuyor'

select tests.seed_user('11111111-1111-1111-1111-111111111111'); -- moderatör
select tests.seed_user('22222222-2222-2222-2222-222222222222'); -- hatayı üreten

insert into app_user_roles (user_id, role)
values ('11111111-1111-1111-1111-111111111111', 'moderator');

insert into client_errors (user_id, error_name, message, created_at)
values (
  '22222222-2222-2222-2222-222222222222',
  'ReferenceError',
  '3 gün önce düzeltilmiş eski hata',
  now() - interval '3 days'
);

insert into client_errors (user_id, error_name, message, created_at)
values (
  '22222222-2222-2222-2222-222222222222',
  'TypeError',
  'Son 24 saat içindeki güncel hata',
  now() - interval '1 hour'
);

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert(
  (select (get_operations_metrics()->>'client_errors_24h')::int) = 1,
  'sayaç yalnızca son 24 saati sayıyor'
);

select tests.assert(
  jsonb_array_length(get_operations_metrics()->'client_error_samples') = 1,
  'liste de yalnızca son 24 saati gösteriyor — sayaçla tutarlı'
);

select tests.assert(
  (get_operations_metrics()->'client_error_samples'->0->>'message')
    = 'Son 24 saat içindeki güncel hata',
  'listede kalan tek örnek güncel olan'
);

reset role;

rollback;
