# Denetim — güvenlik — 2026-10-06 · G03 · Engelleme sonrası erişim

Kapsam: kuyruk G03 (guvenlik-test, L1). Konular: `blocks` UPDATE/DELETE, engel ya da eşleşme kaldırma sonrasında private Realtime kanalı, engellenen tarafın konuşma RPC'leri üzerinden okuyabildikleri.
Başlangıç noktası (yeniden keşfedilmedi): `oc/orchestrator/audit/2026-10-03-petmatch-kuyruk-onerisi.md` §1 ("Engelleme" satırı) ve `oc/orchestrator/audit/2026-10-03-kod-denetimi.md` §2, bulgu (5) ve (6). Bu raporda iki bulgu yeni: B1 (`get_conversation_owner_profile`) ve B5 (gelen kutusu). İkisi de aynı kırmızı koşuda kanıtlandı.
Yöntem: Salt okuma yapıldı (`rg`, migration ve istemci kodu okundu). Ardından yerel `npm run test:db` ile kırmızı koşu yapıldı (README'deki "guvenlik-test kırmızı test koşusu"). Geçici `supabase/tests/zz_otonom_G03.test.sql` dosyası koşudan hemen sonra silindi. Bütçe 3 koşuydu, **1 koşu** kullanıldı.
Hiçbir kod, migration ya da test dosyası değiştirilmedi. Canlıya bağlanılmadı. Bu PR'ın diff'i yalnız bu rapordan oluşuyor.

> Güncel tanımlar: `handle_block` için en son tanım `0015_conversation_inbox_and_lifecycle.sql:85-117`'de. Bu tanım konuşmaları ve eşleşmeleri kapatıyor. `0005:94-115`'teki eski gövdenin yerini aldı; tetikleyici bildirimi hâlâ `0005:117-119`'da duruyor (`after insert` only). `get_conversation_owner_profile` için en son tanım `0068_owner_age_gender_one_way.sql:433-488`'de. `list_my_conversations` için en son tanım `0063_pet_identity_change.sql:226-383`'te. `blocks_own` politikası ilk kez `0003_rls.sql:153-154`'te yazıldı ve `0006_rls_performance.sql:225-232`'de aynı `for all` biçimiyle yeniden yaratıldı. Sonraki migration'larda bu politikaya dokunulmuyor (`rg 'blocks_own|on blocks' supabase/migrations`).

## Sahip-acil (ajan yapamaz)

| # | Bulgu | Yer | Senaryo | Yapılacak |
|---|---|---|---|---|
| S1 | Engelleme sonrasında erişim kesilmiyor. Bu durum kırmızı testle kanıtlandı: engellenen kişi, kendisini engelleyenin profilini ve aktiflik kovasını RPC ile okumaya devam edebiliyor; iki taraf da kapanmış konuşmanın Realtime kanalına girebiliyor; engelleyen, engel kaydını doğrudan değiştirebiliyor ya da silebiliyor | B1–B4 (aşağıda) | Taciz eden kişi engellendikten sonra kendi oturum token'ıyla `rpc/get_conversation_owner_profile` çağırıyor. Böylece karşı tarafın adını, fotoğrafını, bio'sunu ve "son aktif" kovasını süresiz takip edebiliyor | Aşağıdaki migration taslağı ve test dosyası tek PR'da birleştirilecek (sahip oturumu). Ayrıca "Sahip kararı" bölümündeki 3 karar verilecek. Canlıya uygulamak sahipte |

## Bulgular (önem sırasıyla)

| # | Önem | Bulgu | Yer | Senaryo | Öneri (hat, seviye) | Kabul kriteri |
|---|---|---|---|---|---|---|
| B1 | Yüksek | `get_conversation_owner_profile` engel kontrolü yapmıyor. Yalnız katılımcılığa bakıyor; `public` sahipte `c.is_active` koşulu da yok | `0068_owner_age_gender_one_way.sql:451-458` (yalnız katılımcı kontrolü), `:478-481` (`public` için koşulsuz), `:470` (`activity_bucket`) | B engellendi. Konuşma kapandı ama B'nin `conversation_participants` satırı duruyor. B, konuşma kimliğini kendi gelen kutusunda görüyor (`list_my_conversations`). Doğrudan RPC çağrısıyla A'nın güncel adını, avatar yolunu, bio'sunu, cinsiyetini, yaş kovasını ve aktiflik kovasını okuyabiliyor. Bu, `0035_block_hides_public_profile.sql:7-11`'in "sana erişemesin" vaadini atlatıyor. Uygulama ekranı bunu yalnız aktif konuşmada çağırıyor (`app/chat/[conversationId].tsx:132`), yani açık sunucu tarafında. Kırmızı sonuç: "(1 satır)" | Sahip (L0 migration), taslak §4.3 | Kırmızı testte §3'ün ilk assert'i yeşil. İstemci boş sonucu zaten `null` olarak işliyor (`core/api/conversations.ts:204-205`) |
| B2 | Orta | Realtime kanal yetkisi yalnız katılımcılığa bakıyor. Konuşmanın `is_active` durumuna da, engele de bakmıyor | `0031_premium_chat_and_verification.sql:28-33`. Bu fonksiyonu okuma ve yazma politikaları kullanıyor: `:41-53` (`realtime.messages` select ve insert) | Engel ya da unmatch sonrasında iki taraf da `conversation:<id>:ephemeral` kanalına katılabiliyor, presence izleyebiliyor ve broadcast gönderebiliyor (kırmızı: 4 assert). Bugün bunu sınırlayan tek şey istemci kapısı (`app/chat/[conversationId].tsx:204`, `isActive` değilse abone olmuyor). Değiştirilmiş bir istemci ya da doğrudan websocket bu kapıyı atlar. `docs/backlog.md:678` kabul testinde "engelleme sonrası kanal kapanması" yazıyor, ama sunucu bunu garanti etmiyor | Sahip (L0 migration), taslak §4.2 | Kırmızı testte §2'deki 4 FAIL yeşil, 3 kontrol yeşil kalıyor |
| B3 | Orta | `blocks_own` `for all` olduğu için engelleyen kişi kaydı UPDATE edebiliyor. UPDATE, engel tetikleyicisini atlıyor | Politika `0006_rls_performance.sql:230-232`. Tetikleyici yalnız `after insert` (`0005_rls_hardening.sql:117-119`). Tablonun kendi kısıtları `0001_init_schema.sql:162-168` | `update blocks set blocked_id = C` çalışıyor: B'nin engeli sessizce kalkıyor (B, A'nın profilini yeniden görüyor) ve C "engelli" görünüyor. Ama A–C konuşması açık kalıyor, C mesaj yazmaya devam edebiliyor (`0009:285-290` yalnız `conversations.is_active`'e bakıyor). Engel kaydı ile konuşma durumu birbirinden ayrışıyor (kırmızı: 3 assert). Saldırgan üçüncü kişi değil, bunu yapabilmek için engelleyenin kendi oturumu gerekiyor. Yine de "engel kaydı = kesilmiş ilişki" değişmezi bozuluyor | Sahip (L0 migration), taslak §4.1 | Kırmızı testte §1a'daki 3 FAIL yeşil |
| B4 | Düşük **[sahip kararı]** | DELETE ile engel sessizce kaldırılabiliyor. İstemcinin bunun için bir yolu yok | `0006:230-232` (`for all`). `core/api/safety.ts:37-42` yalnız `block_user` RPC'sini çağırıyor. `unblock` RPC'si de yok (`rg -n unblock supabase/migrations core app` boş) | A, `delete from blocks` ile engeli kaldırınca B, A'nın public profilini yeniden görüyor ve keşifte yeniden eşleşebiliyor. Konuşma kapalı kalıyor (yeniden açılmıyor). Bunun için yine A'nın oturumu gerekiyor. Uygulamada "engeli kaldır" özelliği olmadığından bu yol yalnız API üzerinden açık | Sahip kararı (§3), ardından L0 migration | Karar (a): kırmızı testteki "[karar: DELETE]" assert'leri yeşil. Karar (b): `unblock_user` RPC'si ve testi |
| B5 | Düşük **[sahip kararı]** | Engellenen tarafın gelen kutusunda engelleyenin adı kalıyor | `0063_pet_identity_change.sql:259-262` (yalnız `hidden` gizleniyor), `:374` (katılımcı olunan her konuşma listeleniyor) | B'nin gelen kutusunda kapalı A–B konuşması A'nın güncel adıyla duruyor. Ad değişirse B yeni adı da görüyor (kırmızı: 1 assert). Konuşma geçmişinin saklanması bir ürün kararı; bu bulgu yalnız adın güncel kalmasıyla ilgili | Sahip kararı (§3) | Karar evetse kırmızı testteki "[karar: inbox]" assert'i yeşil |
| B6 | Bilgi (düzeltmenin tuzağı) | Test yardımcısı, eksik tablo yetkilerini test ortamında geri veriyor | `supabase/tests/_helpers.sql:150-167` | Düzeltme yalnız `revoke update, delete on blocks` ile yapılırsa, `test:db` ortamında bu yetkiler geri verilir ve kırmızı test kırmızı kalır. Tersinden de doğru: düzeltmeyi test eden politikadır, revoke canlıda ek savunmadır ama test ortamında görünmez | Sahip, aynı PR'da: taslaktaki politika bölmesi zorunlu, revoke ek önlem | Düzeltme PR'ında `test:db` 25/25 yeşil |

## Kabul (1): SQL test taslağı (`supabase/tests/block-after-access.test.sql`)

Kullanılan kalıp: `tests.seed_user` / `seed_pet` / `seed_match`, `tests.act_as` ve `set local role authenticated` (`_helpers.sql:44-135`). Yapı `safety.test.sql:30-93` ile aynı. G01/G02'deki gibi yumuşak assert kullanılıyor (`tests.otonom_*`). Böylece bütün kırmızılar tek koşuda görünüyor ve dosyanın sonunda topluca `raise exception` atılıyor. Savepoint kullanılmadı, çünkü `set_config` ile biriken FAIL listesi savepoint geri alınınca kayboluyor. Saldırıların yan etkisi bunun yerine postgres rolüyle elle geri alınıyor. Sahip düzeltme PR'ında bu yardımcıları `tests.assert` olarak değiştirebilir.

Testin tanımladığı davranışlar:
- (a) Engel kaydı UPDATE ya da DELETE ile değiştirilemiyor.
- (b) Engel ya da unmatch sonrasında iki taraf da kanala erişemiyor.
- (c) Engellenen taraf konuşma RPC'lerinden engelleyenin sahip profilini okuyamıyor.
- (d) Bozulmaması gereken kontroller: aktif konuşmada iki taraf kanala erişiyor; katılımcı olmayan erişemiyor; engellenen kişi engeli silemiyor; engelleyen kendi kaydını görüyor.

```sql
-- block-after-access (G03) — KIRMIZI TEST TASLAĞI (otonom guvenlik-test L1)
--
-- "Olması gereken"i tanımlar:
--   * Engel kaydı istemciden değiştirilemez/silinemez (blocks_own `for all`,
--     0006:230-232). Engel yalnız block_user (0020:11) ile eklenir.
--   * Engellenen ve engelleyen, kapalı konuşmanın private Realtime kanalına
--     (yazıyor/çevrimiçi) erişemez; eşleşme kaldırılınca da erişemez
--     (can_access_conversation_realtime yalnız katılımcılığa bakıyor,
--     0031:28-33).
--   * Engellenen taraf, engelleyenin sahip profilini konuşma RPC'leri
--     üzerinden de okuyamaz (0035'in "sana erişemesin" vaadi).
--
-- Biçim: G01/G02 gibi yumuşak assert (tests.otonom_*, transaction içinde
-- yaratılır, rollback ile silinir). Savepoint KULLANILMAZ: set_config ile
-- biriken FAIL listesi savepoint geri alınınca kaybolur; saldırıların yan
-- etkisi postgres rolüyle elle geri alınır.

begin;

\echo '  blocks: engel sonrası erişim (G03)'

create function tests.otonom_fail(p_label text)
returns void
language plpgsql
as $$
begin
  perform set_config(
    'otonom.fails',
    coalesce(nullif(current_setting('otonom.fails', true), ''), '') || ' | ' || p_label,
    false
  );
end;
$$;

/** p_sql tek bir boolean döndürür; true değilse (ya da hata verirse) FAIL. */
create function tests.otonom_check(p_sql text, p_label text)
returns void
language plpgsql
as $$
declare
  v_result boolean;
begin
  begin
    execute p_sql into v_result;
  exception
    when others then
      raise notice '    FAIL % [hata: %]', p_label, sqlerrm;
      perform tests.otonom_fail(p_label);
      return;
  end;
  if v_result is true then
    raise notice '    ok   %', p_label;
  else
    raise notice '    FAIL %', p_label;
    perform tests.otonom_fail(p_label);
  end if;
end;
$$;

/** p_sql satır döndürmemeli ya da hata vermeli (iki düzeltme biçimi de kabul). */
create function tests.otonom_no_rows(p_sql text, p_label text)
returns void
language plpgsql
as $$
declare
  v_count bigint;
begin
  begin
    execute format('select count(*) from (%s) s', p_sql) into v_count;
  exception
    when others then
      raise notice '    ok   % [%]', p_label, sqlerrm;
      return;
  end;
  if v_count = 0 then
    raise notice '    ok   %', p_label;
  else
    raise notice '    FAIL % (% satır)', p_label, v_count;
    perform tests.otonom_fail(p_label);
  end if;
end;
$$;

grant execute on function tests.otonom_fail(text), tests.otonom_check(text, text),
  tests.otonom_no_rows(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Veri: A (engelleyen), B (engellenen), C (üçüncü kişi). A–B ve A–C eşleşmiş.
-- ---------------------------------------------------------------------------

select tests.seed_user('a0000000-0000-0000-0000-00000000000a');
select tests.seed_user('b0000000-0000-0000-0000-00000000000b');
select tests.seed_user('c0000000-0000-0000-0000-00000000000c');
select tests.seed_pet('a1000000-0000-0000-0000-0000000000a1', 'a0000000-0000-0000-0000-00000000000a', 'Tarcin');
select tests.seed_pet('b1000000-0000-0000-0000-0000000000b1', 'b0000000-0000-0000-0000-00000000000b', 'Boncuk');
select tests.seed_pet('c1000000-0000-0000-0000-0000000000c1', 'c0000000-0000-0000-0000-00000000000c', 'Pamuk');

select tests.seed_match(
  'a1000000-0000-0000-0000-0000000000a1',
  'b1000000-0000-0000-0000-0000000000b1'
) as conv_ab \gset
select tests.seed_match(
  'a1000000-0000-0000-0000-0000000000a1',
  'c1000000-0000-0000-0000-0000000000c1'
) as conv_ac \gset

select tests.assert(
  (select count(*) from conversations where id in (:'conv_ab', :'conv_ac') and is_active) = 2,
  'kurulum: A–B ve A–C konuşmaları aktif'
);

-- Kontrol: engelden önce iki taraf da kanala erişiyor (bozulmamalı).
set local role authenticated;
select tests.act_as('a0000000-0000-0000-0000-00000000000a');
select tests.otonom_check(
  format('select can_access_conversation_realtime(%L)', 'conversation:' || :'conv_ab' || ':ephemeral'),
  'engelden önce A, A–B kanalına erişir'
);
select tests.act_as('b0000000-0000-0000-0000-00000000000b');
select tests.otonom_check(
  format('select can_access_conversation_realtime(%L)', 'conversation:' || :'conv_ab' || ':ephemeral'),
  'engelden önce B, A–B kanalına erişir'
);

-- A, B'yi uygulamanın tek yolu olan RPC ile engeller (core/api/safety.ts:37-42).
select tests.act_as('a0000000-0000-0000-0000-00000000000a');
select block_user('b0000000-0000-0000-0000-00000000000b');
reset role;

-- ---------------------------------------------------------------------------
-- 1. blocks policy: UPDATE / DELETE (0006:230-232)
-- ---------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('b0000000-0000-0000-0000-00000000000b');
select tests.otonom_check(
  'with x as (delete from blocks returning 1) select count(*) = 0 from x',
  'kontrol: engellenen B, A''nın engelini silemez'
);

select tests.act_as('a0000000-0000-0000-0000-00000000000a');
select tests.otonom_check(
  'select count(*) = 1 from blocks',
  'kontrol: A kendi engel kaydını görür'
);

-- 1a. UPDATE: engeli başka bir kullanıcıya "taşı"
select tests.otonom_check(
  $q$with x as (
       update blocks set blocked_id = 'c0000000-0000-0000-0000-00000000000c'
       where blocked_id = 'b0000000-0000-0000-0000-00000000000b'
       returning 1)
     select count(*) = 0 from x$q$,
  'engelleyen A, update blocks set blocked_id=… yapamaz'
);
select tests.otonom_check(
  format(
    'select not exists (select 1 from blocks where blocked_id = %L) or not (select is_active from conversations where id = %L)',
    'c0000000-0000-0000-0000-00000000000c', :'conv_ac'
  ),
  'engel kaydı olan çiftin konuşması açık kalamaz (UPDATE tetikleyiciyi atlar, 0005:117-119)'
);
select tests.act_as('b0000000-0000-0000-0000-00000000000b');
select tests.otonom_check(
  $q$select not exists (select 1 from profiles where id = 'a0000000-0000-0000-0000-00000000000a')$q$,
  'UPDATE sonrası B hâlâ A''nın profilini göremez'
);
reset role;

-- Yan etkiyi geri al (saldırı başarılı olduysa)
delete from blocks where blocker_id = 'a0000000-0000-0000-0000-00000000000a';
insert into blocks (blocker_id, blocked_id)
values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b');

-- 1b. DELETE: sessiz engel kaldırma
set local role authenticated;
select tests.act_as('a0000000-0000-0000-0000-00000000000a');
select tests.otonom_check(
  'with x as (delete from blocks returning 1) select count(*) = 0 from x',
  '[karar: DELETE] engelleyen A, engeli doğrudan DELETE ile kaldıramaz'
);
select tests.act_as('b0000000-0000-0000-0000-00000000000b');
select tests.otonom_check(
  $q$select not exists (select 1 from profiles where id = 'a0000000-0000-0000-0000-00000000000a')$q$,
  '[karar: DELETE] DELETE sonrası B hâlâ A''nın profilini göremez'
);
reset role;

insert into blocks (blocker_id, blocked_id)
values ('a0000000-0000-0000-0000-00000000000a', 'b0000000-0000-0000-0000-00000000000b')
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 2. Realtime kanal yetkisi (0031:7-35)
-- ---------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('b0000000-0000-0000-0000-00000000000b');
select tests.otonom_check(
  format('select not can_access_conversation_realtime(%L)', 'conversation:' || :'conv_ab' || ':ephemeral'),
  'engellenen B, A–B ephemeral kanalına erişemez'
);
select tests.otonom_check(
  format('select not can_access_conversation_realtime(%L)', 'conversation:' || :'conv_ac' || ':ephemeral'),
  'kontrol: katılımcı olmayan B, A–C kanalına erişemez'
);
select tests.act_as('a0000000-0000-0000-0000-00000000000a');
select tests.otonom_check(
  format('select not can_access_conversation_realtime(%L)', 'conversation:' || :'conv_ab' || ':ephemeral'),
  'engelleyen A, kapanmış A–B kanalına erişemez'
);
select tests.otonom_check(
  format('select can_access_conversation_realtime(%L)', 'conversation:' || :'conv_ac' || ':ephemeral'),
  'kontrol: A, aktif A–C kanalına erişir'
);
select tests.act_as('c0000000-0000-0000-0000-00000000000c');
select tests.otonom_check(
  format('select can_access_conversation_realtime(%L)', 'conversation:' || :'conv_ac' || ':ephemeral'),
  'kontrol: C, aktif A–C kanalına erişir'
);

-- Eşleşmeyi kaldırma (engelsiz) da kanalı kapatmalı.
select unmatch_conversation(:'conv_ac');
select tests.otonom_check(
  format('select not can_access_conversation_realtime(%L)', 'conversation:' || :'conv_ac' || ':ephemeral'),
  'unmatch sonrası C, A–C kanalına erişemez'
);
select tests.act_as('a0000000-0000-0000-0000-00000000000a');
select tests.otonom_check(
  format('select not can_access_conversation_realtime(%L)', 'conversation:' || :'conv_ac' || ':ephemeral'),
  'unmatch sonrası A, A–C kanalına erişemez'
);

-- ---------------------------------------------------------------------------
-- 3. Konuşma RPC'leri engelleyenin sahip profilini sızdırmamalı
-- ---------------------------------------------------------------------------

select tests.act_as('b0000000-0000-0000-0000-00000000000b');
select tests.otonom_no_rows(
  format('select * from get_conversation_owner_profile(%L)', :'conv_ab'),
  'engellenen B, get_conversation_owner_profile ile A''nın profilini okuyamaz (0068:433-484)'
);
select tests.otonom_no_rows(
  format(
    'select 1 from list_my_conversations() where conversation_id = %L and counterpart_display_name is not null',
    :'conv_ab'
  ),
  '[karar: inbox] engellenen B''nin gelen kutusunda A''nın adı görünmez (0063:259-262)'
);
reset role;

-- ---------------------------------------------------------------------------

do $$
begin
  if coalesce(current_setting('otonom.fails', true), '') <> '' then
    raise exception 'FAIL: G03 kırmızı assert''ler:%', current_setting('otonom.fails', true);
  end if;
end;
$$;

rollback;
```

## Kabul (2): `test:db` kırmızı çıktısı

Komut (`is` worktree'sinde, README'deki tek izinli yol):
`cp /tmp/petmatch-otonom/G03.test.sql <is>/supabase/tests/zz_otonom_G03.test.sql && npm run test:db; rm -f <is>/supabase/tests/zz_otonom_G03.test.sql`. Koşudan sonra `git status` boştu.

Özet: **Mevcut 24 dosyanın hepsi ✓. Yalnız `zz_otonom_G03.test.sql` ✗ (`1/25 test dosyası düştü`).** Yeni dosyada **11 assert FAIL** oldu. Kurulum assert'i ve 7 kontrol `ok` çıktı; bunlar bugün çalışan ve düzeltmenin bozmaması gereken davranışlar. İmaj `supabase/postgres:17.6.1.111`; 72 migration sıfırdan uygulandı. `safety.test.sql` da ✓ (8/8). Bu dosya yalnız engelin "ekleme anını" test ediyor, sonrasını test etmiyor. Bu rapor tam olarak o boşluğu dolduruyor.

```text
ok   kurulum: A–B ve A–C konuşmaları aktif
ok   engelden önce A, A–B kanalına erişir
ok   engelden önce B, A–B kanalına erişir
ok   kontrol: engellenen B, A'nın engelini silemez
ok   kontrol: A kendi engel kaydını görür
FAIL engelleyen A, update blocks set blocked_id=… yapamaz
FAIL engel kaydı olan çiftin konuşması açık kalamaz (UPDATE tetikleyiciyi atlar, 0005:117-119)
FAIL UPDATE sonrası B hâlâ A'nın profilini göremez
FAIL [karar: DELETE] engelleyen A, engeli doğrudan DELETE ile kaldıramaz
FAIL [karar: DELETE] DELETE sonrası B hâlâ A'nın profilini göremez
FAIL engellenen B, A–B ephemeral kanalına erişemez
ok   kontrol: katılımcı olmayan B, A–C kanalına erişemez
FAIL engelleyen A, kapanmış A–B kanalına erişemez
ok   kontrol: A, aktif A–C kanalına erişir
ok   kontrol: C, aktif A–C kanalına erişir
FAIL unmatch sonrası C, A–C kanalına erişemez
FAIL unmatch sonrası A, A–C kanalına erişemez
FAIL engellenen B, get_conversation_owner_profile ile A'nın profilini okuyamaz (0068:433-484) (1 satır)
FAIL [karar: inbox] engellenen B'nin gelen kutusunda A'nın adı görünmez (0063:259-262) (1 satır)
✗ zz_otonom_G03.test.sql
    ERROR:  FAIL: G03 kırmızı assert'ler: | … (11 etiket) …
1/25 test dosyası düştü
```

Her FAIL'in bugünkü nedeni:
- UPDATE ve DELETE geçiyor, çünkü politika `for all` (`0006:230-232`). UPDATE `handle_block`'u ateşlemiyor, çünkü tetikleyici `after insert` (`0005:117-119`). Engel kalkınca `profiles_select_public` (`0035:28-33`) B için yeniden açılıyor.
- Kanal yetkisi doğru dönüyor, çünkü `0031:28-33` yalnız `conversation_participants` tablosuna bakıyor. Engel ve unmatch katılımcı satırını silmiyor (`0015:85-117`, `0020:41-73`).
- `get_conversation_owner_profile` A'nın satırını döndürüyor, çünkü `public` sahip için ne `is_active` ne engel koşulu var (`0068:478-481`).

## Kabul (3): DELETE (sessiz engel kaldırma): karar notu

Bulgu: İstemcinin engel kaldırma yolu yok (`core/api/safety.ts:37-42` yalnız `block_user`). Sunucuda `unblock` RPC'si yok. DELETE'e yalnız `for all` politikasının yan etkisi olarak izin veriliyor (`0003:153-154` yorumu "yaz-ve-unut"; yani niyet zaten "silinmez").

| Seçenek | Ne olur | Artı | Eksi |
|---|---|---|---|
| **(a) Kalıcı engel. Önerilen (bugünkü ürün davranışıyla aynı)** | Politika yalnız select ve insert. DELETE yolu kapanır. Hesap silinince FK cascade ile kayıt yine düşer (`0001:163-164`) | Uygulamanın söylediği ile sunucunun yaptığı aynı olur. Engel bir moderasyon sinyali olarak kalıcı olur | Kullanıcı yanlışlıkla engellediğini geri alamaz. Bu bugün de böyle |
| (b) Açık geri alma | `unblock_user(p_blocked_id)` SECURITY DEFINER RPC'si eklenir. Konuşma kapalı kalır (yeniden açılmaz); keşif ve eşleşme yeniden mümkün olur. İsteğe bağlı olarak bekleme süresi ve olay kaydı eklenir | Kullanıcı hatasını geri alabilir | Yeni yüzey açılır: istemci ekranı, test, taciz döngüsü riski (engelle, kaldır, yeniden eşleş). Kararı ürün sahibinin vermesi gerekir |

İki seçenekte de DELETE ve UPDATE politikası kalkar. (b) seçilirse kırmızı testteki "[karar: DELETE]" assert'leri yerinde kalır (doğrudan DELETE yine yasak), RPC için ayrı bir assert eklenir.

## Kabul (4): Düzeltme taslağı (`YYYYMMDDHHMMSS_block_after_access.sql`; yalnız rapor)

Notlar:
- (1) "Aktif eşleşme" koşulu için `matches.is_active` yerine `conversations.is_active` kullanılıyor. Nedeni şu: sahiplendirme konuşmalarında `matches` satırı yok. Engel (`0015:92-102`), unmatch (`0020:60-71`) ve devir (`0012:319-331`) zaten `conversations.is_active`'i kapatıyor. Mesaj yazma da aynı alana bakıyor (`0009:285-290`).
- (2) `blocked_user_ids()` authenticated rolüne zaten açık (`0035:24`).
- (3) `create or replace` mevcut grant'ları korur. Yine de imzalar aynen bırakıldı.
- (4) `surface.test.sql` kuralları gözetildi: `auth.uid()` `(select …)` içine sarıldı, `search_path` sabitlendi.

```sql
-- Engel sonrası erişim (G03)
--
-- 1) blocks: engel istemciden değiştirilemez/silinemez. `for all` UPDATE ile
--    engeli tetikleyicisiz başka kullanıcıya taşımaya ve DELETE ile sessizce
--    kaldırmaya izin veriyordu (0006:230-232; tetikleyici yalnız INSERT,
--    0005:117-119).
-- 2) Realtime ephemeral kanal: aktif konuşma + karşı tarafla engel yok.
-- 3) get_conversation_owner_profile: engellenen/engelleyen karşı tarafın
--    sahip profilini okuyamaz (0035 vaadi RPC yolunda da geçerli).

-- 1 -------------------------------------------------------------------------
drop policy if exists blocks_own on blocks;

create policy blocks_select_own on blocks
  for select to authenticated
  using (blocker_id = (select auth.uid()));

-- İstemci yalnız block_user (SECURITY DEFINER) kullanıyor (core/api/safety.ts).
-- Doğrudan insert de handle_block tetikleyicisini ateşler. [Sahip kararı:
-- bu politikayı hiç yaratmamak → tek yazma yolu RPC.]
create policy blocks_insert_own on blocks
  for insert to authenticated
  with check (blocker_id = (select auth.uid()));

-- Ek savunma (canlıda). NOT: supabase/tests/_helpers.sql eksik tablo
-- yetkilerini test ortamında geri verir; test:db'de bu satır görünmez,
-- kırmızı testi yukarıdaki politika bölmesi yeşile çevirir.
revoke update, delete on blocks from authenticated, anon;

-- 2 -------------------------------------------------------------------------
create or replace function can_access_conversation_realtime(p_topic text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_conversation_id uuid;
begin
  if auth.uid() is null
     or p_topic !~ '^conversation:[0-9a-fA-F-]{36}:ephemeral$' then
    return false;
  end if;

  begin
    v_conversation_id := split_part(p_topic, ':', 2)::uuid;
  exception when invalid_text_representation then
    return false;
  end;

  return exists (
    select 1
    from conversation_participants cp
    join conversations c on c.id = cp.conversation_id
    where cp.conversation_id = v_conversation_id
      and cp.user_id = auth.uid()
      and c.is_active
      and not exists (
        select 1
        from conversation_participants other
        where other.conversation_id = cp.conversation_id
          and other.user_id <> auth.uid()
          and other.user_id = any (blocked_user_ids())
      )
  );
end;
$$;

-- 3 -------------------------------------------------------------------------
-- 0068:433-484 ile aynı; yalnız son `and` satırı eklendi. Boş sonuç istemcide
-- zaten null (core/api/conversations.ts:204-205), imza değişmiyor.
create or replace function get_conversation_owner_profile(p_conversation_id uuid)
returns table (
  user_id         uuid,
  display_name    text,
  avatar_path     text,
  bio             text,
  gender          text,
  age_bucket      text,
  social_open     boolean,
  verified        boolean,
  activity_bucket text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1
    from conversation_participants cp
    where cp.conversation_id = p_conversation_id
      and cp.user_id = auth.uid()
  ) then
    raise exception 'not a participant of conversation' using errcode = '42501';
  end if;

  return query
  select
    other_profile.id,
    other_profile.display_name,
    other_profile.avatar_url,
    other_profile.bio,
    other_profile.gender,
    owner_age_bucket(other_profile.birth_date),
    other_profile.owner_social_open,
    other_profile.verification_status = 'approved',
    activity_bucket(other_profile.last_active_at)
  from conversations c
  join conversation_participants mine
    on mine.conversation_id = c.id and mine.user_id = auth.uid()
  join conversation_participants other
    on other.conversation_id = c.id and other.user_id <> auth.uid()
  join profiles other_profile on other_profile.id = other.user_id
  where c.id = p_conversation_id
    and (
      other_profile.owner_visibility = 'public'
      or (other_profile.owner_visibility = 'after_match' and c.is_active)
    )
    and other_profile.id <> all (blocked_user_ids())
  limit 1;
end;
$$;
```

B5 için eklenti (yalnız sahip "evet" derse): `0063:259-262`'deki `case` ifadesine `when other_profile.id = any (blocked_user_ids()) then null` dalı eklenir. `list_my_conversations` `language sql` ile yazıldığı için tüm gövde `create or replace` ile yeniden yazılır. Taslak burada tekrar edilmedi; değişen tek satır bu.

Tetikleyici notu: Politika UPDATE'i kapattığında `on_block_created`'ın `after insert or update` olmasına gerek kalmıyor. SECURITY DEFINER bir fonksiyon ileride `blocks`'u güncellerse aynı ayrışma geri gelir. Bunun için `blocks` yorumuna "yalnız insert/delete" notu düşülmesi yeterli.

## Sahip kararı (bağlayıcı karar gerekenler)

1. **DELETE ve engel kaldırma:** (a) kalıcı engel (önerilen) ya da (b) `unblock_user` RPC'si. Bkz. Kabul (3).
2. **Gelen kutusu (B5):** Engellenen tarafın kapalı konuşmasında engelleyenin adı gizlensin mi? Daha geniş soru: kapalı konuşma ve mesaj geçmişi engellenene görünmeye devam etsin mi? (Bugün `messages_select_participant` engelden sonra da okumaya izin veriyor, `0009:281-283`; bu ürün kararı, açık olarak raporlanmadı.)
3. **`blocks` INSERT politikası:** Kalsın mı (taslak), yoksa tek yazma yolu `block_user` mı olsun (yalnız select politikası)?

## Doğrulanamayanlar

- **Realtime'ın zaten katılmış bir kanalı yeniden yetkilendirip yetkilendirmediği.** Supabase Realtime private kanal yetkisini katılım anında değerlendiriyor. Engel ya da unmatch anında kanalda olan bir istemcinin, bağlantı kopana ya da token yenilenene kadar sinyal almaya devam edip etmediği yerel test ortamında doğrulanamadı (`_bootstrap.sql:35-55` yalnız tabloyu taklit ediyor, servisi değil). Doğrulama yolu: iki cihazla (sahip, QA hesabı) sohbet açıkken engelle, sonra karşı cihazda presence/typing akışını gözle. Düzeltme yeni katılımları kesin olarak kapatıyor; açık oturum için istemcinin `isActive` değişince aboneliği kapatması (`app/chat/[conversationId].tsx:202-206` efekt bağımlılığı) ek güvence sağlıyor.
- **`app/pet/[petId].tsx:97-101` yolu.** `loadConversationOwnerProfile` burada `isActive` kapısı olmadan çağrılıyor. Engellenen kullanıcının bu ekrana ulaşıp ulaşamadığı (pet satırı RLS ile gizli, `loadConversationIdForMatch` davranışı) simülatör gerektiriyor. Sunucu düzeltmesi (§4.3) bu yolu da kapatıyor.
- **Canlıda UPDATE ile taşınmış ya da silinmiş engel kaydı olup olmadığı.** Canlı sorgu çalıştırılmadı. Sahibin isteğe bağlı olarak kullanabileceği salt okuma taslağı (yalnız sayım): `select count(*) from blocks b where exists (select 1 from conversation_participants m join conversation_participants o on o.conversation_id = m.conversation_id join conversations c on c.id = m.conversation_id where m.user_id = b.blocker_id and o.user_id = b.blocked_id and c.is_active);`. Sonuç 0'dan büyükse, engel kaydı olduğu hâlde açık kalmış konuşma var demektir (B3 izi). Silinmiş engeller iz bırakmadığı için sayılamaz.

## İyi olanlar

- Engelin ekleme anı sağlam: `handle_block` iki kullanıcının bütün konuşmalarını ve eşleşmelerini kapatıyor (`0015:85-117`). Mesaj yazma `conversations.is_active`'e bağlı (`0009:285-290`). `safety.test.sql:62-93` bunu kilitliyor.
- Keşif, beğeniler, profil ve galeri yüzeylerinin hepsi `blocked_user_ids()` ya da `is_blocked_between` ile süzülüyor (`0035:28-33`, `0068:103,159,418`, `owner-photos.test.sql` "engellenen public sahibin galerisi görünmez"). Açık yalnız konuşmaya bağlı RPC'lerde ve Realtime'da.
- İstemci savunmalı yazılmış: kapalı konuşmada kanala abone olmuyor ve sahip profilini istemiyor (`app/chat/[conversationId].tsx:132,204`).

## Öneriler (kuyruk için, tek satır)

- `[sahip / L0]` G03 düzeltmesi: §4 migration'ı ve `supabase/tests/block-after-access.test.sql` (Kabul 1) tek PR'da. Kabul: `test:db` 25/25 yeşil. Bağımlılık: Sahip kararı 1 ve 3.
- `[sahip kararı]` B5 / mesaj geçmişi: engellenen tarafın kapalı konuşma görünürlüğü (Sahip kararı 2).
- `[app-test, L2]` `core/api/safety.ts` sözleşme testi: `blockUser` yalnız `block_user` RPC'sini çağırıyor, `from("blocks")` kullanılmıyor. `vi.mock` kalıbıyla yazılacak (README "Test kalıbı"). Kabul: `npm test` yeşil, yeni dosya `core/api/safety.test.ts`.
