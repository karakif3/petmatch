# Denetim — güvenlik — 2026-10-05 · G02 · A18 rıza öncesi public

Kapsam: kuyruk G02 (guvenlik-test, L1): sahip profilinin açık rızadan önce `public` olması; KVKK uyumlu görünürlük planı.
Başlangıç (tekrar keşfedilmedi): `oc/orchestrator/audit/2026-10-03-petmatch-kuyruk-onerisi.md` §1 (A18 doğrulaması) ve §4, `oc/orchestrator/audit/2026-10-03-kod-denetimi.md` §2 bulgu (9).
**Bağlayıcı ürün yönü (sahip, 2026-10-04):** "Pet profili eşleşmeden önce görünür; insan profili varsayılan resimli görünür, ama kullanıcı resimsize ya da yalnız eşleşince'ye çekebilir." Rapor bu yönü KVKK ile nasıl uygulanacağını anlatıyor, yönü yeniden tartışmıyor.
Yöntem: salt okuma (`rg`, migration/istemci okuma) + yerel `npm run test:db` kırmızı koşusu (README "guvenlik-test kırmızı test koşusu"; geçici `supabase/tests/zz_otonom_G02.test.sql` koşudan hemen sonra silindi). Bütçe 3 koşuydu, 1 koşu kullanıldı.
Hiçbir kod, migration ya da test dosyası değiştirilmedi; canlıya bağlanılmadı. Bu PR'ın diff'i yalnız bu rapor.

> Migration sırası notu: `test-db.mjs:163` dosyaları ada göre sıralıyor. Bu yüzden `2026…` önekli migration'lar `0068`'den **sonra** uygulanıyor. Fonksiyonların güncel tanımları şunlar: `update_my_owner_details` → `20260827144529_owner_photos_and_verification_decouple.sql:117-235`; `discover_playdate_pets` / `pending_likes` / `get_conversation_owner_profile` → `0068_owner_age_gender_one_way.sql`. Kuyruk maddesinde geçen `0042:120-139`, `0023:41-59` ve `0007:172-177` satırlarının yerini bu tanımlar aldı; raporda güncel satırlar kullanıldı.

## Sahip-acil (ajan yapamaz)

| # | Bulgu | Yer | Senaryo | Yapılacak |
|---|---|---|---|---|
| S1 | A18 açık; kırmızı test ile kanıtlandı | `20260827204345_owner_visibility_default_public.sql:9-10`, `core/api/onboarding.ts:67-71,91`, `0012_integrity_and_conversation_membership.sql:17-27` (`owner_visibility` istemciye UPDATE açık), "public ⇒ rıza" tetikleyicisi/kontrolü yok | Kayıt olan herkes, ayrı bir seçim yapmadan keşifte adı, yaş kovası, cinsiyeti, bio'su (ve sonradan eklediği fotoğrafı) ile görünür. Rızayı reddeden ya da geri çeken kullanıcı tek bir PostgREST `PATCH profiles` çağrısıyla yine `public` olabiliyor | Aşağıdaki migration taslağı + istemci değişimi + `_helpers.sql` seed düzeltmesi tek PR'da (sahip oturumu). Mevcut `public` satırlar için geçiş kararı (§5). Canlıya uygulamak sahipte |

## Bulgular (önem sırasıyla)

| # | Önem | Bulgu | Yer | Senaryo | Öneri (hat, seviye) | Kabul kriteri |
|---|---|---|---|---|---|---|
| B1 | Yüksek | Yeni kullanıcı `public` doğuyor | Varsayılan `20260827204345:9-10`; `handle_new_user` görünürlüğü yazmıyor, varsayılana bırakıyor (`0018_optional_owner_name_and_profile_update.sql:20-24`); onboarding ilk kayıtta açıkça `public` yazıyor (`core/api/onboarding.ts:90-91`) | Kayıt anında, kullanıcı hiçbir seçim yapmadan profil keşifte açılıyor (kırmızı: "yeni kayıt … after_match doğar") | Sahip (L0 migration + istemci) | Kırmızı testteki 1. bölüm yeşil; `onboarding.ts` kullanıcı seçmeden `owner_visibility` yazmıyor |
| B2 | Yüksek | Rıza önceden verilmiş sayılıyor ve zorunlu yasal kutuya bağlanmış | `core/api/onboarding.ts:67-71` `publicProfileConsent: true` sabit; zorunlu kutunun metni görünürlük cümlesini içeriyor (`app/onboarding.tsx:837-849`, metin `:843-847`); kutu işaretlenmeden devam edilemiyor (`:409-414`). Kutu işaretsiz başlıyor (`:151`), ama tek kutu hem koşulları hem görünürlüğü kapsıyor | KVKK'da açık rıza belirli bir konuya ait ve özgür iradeyle verilmiş olmalı. Hizmet koşuluna bağlanmış "kabul" geçerli rıza sayılmaz. Yayındaki aydınlatma metniyle de çelişiyor: `app/(auth)/legal.tsx:107-110` "isteğe bağlıdır… ayrı ayrı sunulur… Rıza vermemek hesabı açmana engel olmaz" diyor | Sahip (istemci) | Onboarding'de yasal kutudan **ayrı**, önceden seçili olmayan üç seçenekli bir seçim var; `publicProfileConsent` bu seçimden türetiliyor; zorunlu kutu metninde görünürlük cümlesi yok |
| B3 | Yüksek | Sunucu "public ⇒ geçerli rıza" kuralını uygulamıyor | Doğrudan UPDATE grant'ı `0012:22`; `update_my_owner_details` rızaya bakmadan yazıyor (`20260827144529:196-207`); `update_my_profile` de aynı (`0021_owner_social_discovery.sql:172-251`); `legal_acceptances` görünürlükle bağlı değil (`0025_legal_acceptances.sql:4-19`) | Rıza vermeyen (`accepted=false`) kullanıcı üç yoldan da `public` oluyor; ardından adı ve yaş kovası başkasının keşif destesine çıkıyor (kırmızı: 5 assert) | Sahip (L0 migration): tetikleyici (aşağıda) | Kırmızı testteki 2. bölüm yeşil |
| B4 | Orta | Rızanın geri çekilmesi görünürlüğü düşürmüyor | `record_optional_legal_consent` yalnızca insert yapıyor (`0066_connection_signal_and_consent.sql:50-80`); `legal_acceptances` üzerinde tetikleyici yok | Kullanıcı rızayı geri çekiyor (`accepted=false` kaydı) ama profili `public` kalıyor. Kayıt ile gerçek durum çelişiyor (kırmızı: "[karar: geri çekme]") | Sahip (L0 migration) **[karar: geri çekilince `after_match` mı `hidden` mı]** | Kırmızı testteki 3. bölüm yeşil |
| B5 | Orta | Kullanıcı bir eylem yapmadan rıza kaydı yazılıyor | `core/api/profile.ts:618-621` (`updateEditableProfile`) her kayıtta `public_profile_consent = (visibility==='public')` yazıyor. Çağıran ekran görünürlüğü düzenlemiyor, yalnızca mevcut değeri geri gönderiyor (`app/(app)/profile.tsx:274-281`). `saveOwnerProfile` görünürlük değişmese de her kayıtta yazıyor (`core/api/profile.ts:394-398`) | Konum ya da ad güncelleyen bir `public` kullanıcı için sistem "rıza verdi" kaydı oluşturuyor. Rıza tarihleri gerçeği yansıtmıyor; tetikleyici geldikten sonra rızasız bir kullanıcıyı kendiliğinden "rızalı"ya çevirebilir | Sahip, aynı PR'da (istemci) | `updateEditableProfile` rıza yazmıyor; `saveOwnerProfile` yalnızca görünürlük değiştiğinde yazıyor (vitest ile kilitlenir; app-test) |
| B6 | Düşük | Rıza kaydı ile görünürlük yazımı tek işlemde değil | `core/api/profile.ts:394-411`: önce `record_optional_legal_consent`, sonra ayrı bir RPC | RPC hata verirse `accepted=true` kaydı kalıyor ama profil `public` olmuyor. Kayıt yine de gerçek bir kullanıcı eylemi olduğu için etkisi düşük | Sahip ya da 2. faz: atomik `set_my_owner_visibility` RPC'si (seçenek B) | Rıza ile görünürlük aynı fonksiyonda; hata olursa ikisi de geri alınıyor |
| B7 | Düşük (sahip kararı) | `public` olmayan sahibin aktiflik kovası keşifte dönüyor | `0068:272` (`activity_bucket(c.last_active_at)`), `0068:388` (`pending_likes`), görünürlük koşulu yok | "Son aktif" bilgisi `profiles.last_active_at` alanından, yani kişinin davranışından türüyor; `after_match`/`hidden` sahipte de görünüyor. Pet kartı bilgisi olarak sunulabilir ama kaynağı kişisel veri | Sahip kararı: kova kalsın mı (pet etkinliği diye adlandırılarak) yoksa `public` koşuluna mı bağlansın | Karara göre: ya aydınlatma metnine eklenir ya da `0068` çıktısı `case when … = 'public'` ile koşullanır |
| B8 | Bilgi (düzeltmenin yan etkisi) | Tetikleyici geldiğinde mevcut test yardımcıları düşer | `supabase/tests/_helpers.sql:54-83` `tests.seed_user` varsayılan olarak `public` yazıyor ve rıza kaydı eklemiyor; 23 test dosyası `seed_user` kullanıyor. Ayrıca `owner-connection-signal.test.sql:47-50` ve `owner-photos.test.sql:49-53` RPC ile `public` yazıyor | A18 PR'ı CI `database` adımında kırmızı kalır | Sahip, aynı PR'da: `seed_user` görünürlük `public` ise `legal_acceptances`'a `public_profile_consent` accepted kaydı da eklesin (aşağıda) | Düzeltme PR'ında `test:db` 25/25 yeşil |

## Kabul (1): SQL test taslağı (`supabase/tests/public-profile-consent.test.sql`)

Kalıp: `auth.users` insert (gerçek `handle_new_user` yolu) + `tests.seed_user` (yalnızca izleyici için) + `tests.act_as` + `set local role authenticated` (`_helpers.sql:44-83`). G01'deki gibi yumuşak assert kullanılıyor (`tests.otonom_*`): tüm kırmızılar tek koşuda görünüyor, dosya sonunda topluca `raise exception`. `tests.otonom_raises` başarılı olursa yan etkisini bırakıyor; böylece hemen ardından gelen keşif assert'i sızıntıyı gösterebiliyor. Sahip düzeltme PR'ında bunları `tests.assert` / `tests.assert_raises`'e çevirebilir.

Kapsadığı kabul maddeleri: (a) `handle_new_user` → `after_match`; (b) rıza kaydı olmayan ya da `false` olan kullanıcı doğrudan UPDATE, `update_my_owner_details` ve `update_my_profile` ile `public` olamıyor; (c) rızasız kullanıcının sahip alanları keşifte ve tablo yolunda görünmüyor, peti görünüyor (Kabul 4); (d) geri çekilince `after_match` **[karar]**; (e) bozulmaması gerekenler: rızasız kullanıcı `hidden`/`after_match` yapabiliyor, rızası olan kullanıcı `public` olabiliyor.

```sql
-- public-profile-consent (A18) — KIRMIZI TEST TASLAĞI (G02, otonom guvenlik-test L1)
--
-- "Olması gereken"i tanımlar (sahip ürün yönü 2026-10-04 + KVKK):
--   * Yeni kullanıcı (`auth.users` insert → `handle_new_user`) public DOĞMAZ;
--     varsayılan `after_match`.
--   * Geçerli `public_profile_consent` kaydı (en son kayıt accepted = true)
--     olmayan kullanıcı `owner_visibility = 'public'` yapamaz — doğrudan
--     UPDATE (`0012:22` grant'ı) ve iki RPC (`update_my_owner_details`,
--     `update_my_profile`) dahil.
--   * Rızasız kullanıcının sahip alanları keşifte başkasına çıkmaz; peti çıkar.
--   * [karar: geri çekme] Rıza geri çekilince (accepted = false kaydı)
--     public profil `after_match`'e düşer.
--
-- Bugün kırmızıdır: varsayılan `public` (20260827204345:9-10), sunucuda
-- "public ⇒ rıza" kontrolü yok, geri çekme görünürlüğe dokunmuyor.
--
-- Biçim: G01 gibi yumuşak assert (`tests.otonom_*`, transaction içinde
-- yaratılır, rollback ile silinir); tüm kırmızılar tek koşuda görünür,
-- dosya sonunda topluca `raise exception`.
--
-- Gizli bağ: `tests.seed_user` (`_helpers.sql:54-83`) varsayılan olarak
-- postgres rolüyle `owner_visibility = 'public'` yazar ve rıza kaydı
-- eklemez. Düzeltme (tetikleyici) gelince helper, public için bir
-- `public_profile_consent` kaydı da eklemeli — aksi hâlde mevcut 23 dosya
-- düşer. Bu taslak seed_user'ı yalnız İZLEYİCİ (V) için kullanır.

begin;

\echo '  profiles: rıza öncesi public yok, public ⇒ geçerli rıza (A18)'

-- ---------------------------------------------------------------------------
-- Yumuşak assert yardımcıları (yalnız bu transaction'da yaşar)
-- ---------------------------------------------------------------------------

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

/** p_sql hata vermeli; hatasız biterse FAIL (yan etkisi KALIR — sızıntı gösterilsin). */
create function tests.otonom_raises(p_sql text, p_label text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice '    ok   % [%]', p_label, sqlerrm;
      return;
  end;
  raise notice '    FAIL % — hata oluşmadı', p_label;
  perform tests.otonom_fail(p_label);
end;
$$;

/** p_sql hatasız çalışmalı (düzeltmenin bozmaması gereken yol). */
create function tests.otonom_runs(p_sql text, p_label text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice '    FAIL % [hata: %]', p_label, sqlerrm;
      perform tests.otonom_fail(p_label);
      return;
  end;
  raise notice '    ok   %', p_label;
end;
$$;

grant execute on function tests.otonom_fail(text), tests.otonom_check(text, text),
  tests.otonom_raises(text, text), tests.otonom_runs(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Veri
--   N: yeni kayıt (yalnız auth.users insert; handle_new_user varsayılanı)
--   U: rızasız kullanıcı (kayıt + profil alanları; visibility'ye dokunulmaz)
--   C: rıza veren kullanıcı (sonra geri çeker)
--   V: izleyici (seed_user, public)
-- ---------------------------------------------------------------------------

insert into auth.users (id, email)
values
  ('a1800000-0000-0000-0000-00000000000e', 'a1800000-n@test.local'),
  ('a1800000-0000-0000-0000-00000000000a', 'a1800000-u@test.local'),
  ('a1800000-0000-0000-0000-00000000000c', 'a1800000-c@test.local');

-- Profil alanları (onboarding.ts:84-93'ün yazdıkları, visibility HARİÇ).
update profiles
set birth_date = '1995-01-01',
    city = 'Istanbul',
    display_name = 'Rizasiz ' || left(id::text, 4),
    onboarded_at = now()
where id in ('a1800000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-00000000000c');

select tests.seed_user('a1800000-0000-0000-0000-00000000000f', 'male', 'public');

select tests.assign_region('a1800000-0000-0000-0000-00000000000a', 'kadikoy');
select tests.assign_region('a1800000-0000-0000-0000-00000000000c', 'kadikoy');
select tests.assign_region('a1800000-0000-0000-0000-00000000000f', 'kadikoy');

select tests.seed_pet('a18a0000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-00000000000a', 'U Pet');
select tests.seed_pet('a18c0000-0000-0000-0000-00000000000c', 'a1800000-0000-0000-0000-00000000000c', 'C Pet');
select tests.seed_pet('a18f0000-0000-0000-0000-00000000000f', 'a1800000-0000-0000-0000-00000000000f', 'V Pet');

insert into pet_photos (pet_id, storage_path, position)
values
  ('a18a0000-0000-0000-0000-00000000000a', 'a1800000-0000-0000-0000-00000000000a/a18a0000-0000-0000-0000-00000000000a/0.jpg', 0),
  ('a18c0000-0000-0000-0000-00000000000c', 'a1800000-0000-0000-0000-00000000000c/a18c0000-0000-0000-0000-00000000000c/0.jpg', 0);

do $$
begin
  raise notice '    bilgi profiles.owner_visibility varsayılanı: %', (
    select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and column_name = 'owner_visibility'
  );
  raise notice '    bilgi authenticated owner_visibility UPDATE kolon yetkisi: %',
    has_column_privilege('authenticated', 'public.profiles', 'owner_visibility', 'UPDATE');
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Kayıt anı: handle_new_user profili public açmaz
-- ---------------------------------------------------------------------------

select tests.otonom_check(
  $q$ select owner_visibility = 'after_match'
      from profiles where id = 'a1800000-0000-0000-0000-00000000000e' $q$,
  'yeni kayıt (handle_new_user) profili after_match doğar, public değil'
);
select tests.otonom_check(
  $q$ select owner_visibility <> 'public'
      from profiles where id = 'a1800000-0000-0000-0000-00000000000a' $q$,
  'rızasız U kayıt sonrası public değil'
);

-- ---------------------------------------------------------------------------
-- 2. Rızasız U: doğrudan UPDATE ve RPC'lerle public olamaz
-- ---------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('a1800000-0000-0000-0000-00000000000a');

-- Onboarding'in bugünkü sırası: yasal kayıt (rıza false) → doğrudan UPDATE.
select record_legal_acceptances('v-test', true, true, false, false);

select tests.otonom_raises(
  $q$ update profiles set owner_visibility = 'public'
      where id = 'a1800000-0000-0000-0000-00000000000a' $q$,
  'rıza false olan U doğrudan UPDATE ile public olamaz (onboarding.ts:91 yolu)'
);

-- Sızıntı kanıtı: yukarıdaki UPDATE geçtiyse V, U'nun adını keşifte görür.
select tests.act_as('a1800000-0000-0000-0000-00000000000f');
select tests.otonom_check(
  $q$ select count(*) = 1 from discover_playdate_pets('a18f0000-0000-0000-0000-00000000000f')
      where id = 'a18a0000-0000-0000-0000-00000000000a' $q$,
  'V keşifte rızasız U''nun PETİNİ görür (pet eşleşmeden önce görünür — kural)'
);
select tests.otonom_check(
  $q$ select not owner_profile_shown and owner_display_name is null and owner_age_bucket is null
      from discover_playdate_pets('a18f0000-0000-0000-0000-00000000000f')
      where id = 'a18a0000-0000-0000-0000-00000000000a' $q$,
  'V keşifte rızasız U''nun sahip adını/yaş kovasını görmez'
);
select tests.otonom_check(
  $q$ select count(*) = 0 from profiles where id = 'a1800000-0000-0000-0000-00000000000a' $q$,
  'V rızasız U''nun profiles satırını doğrudan okuyamaz (profiles_select_public)'
);

reset role;
update profiles set owner_visibility = 'after_match'
where id = 'a1800000-0000-0000-0000-00000000000a';
set local role authenticated;
select tests.act_as('a1800000-0000-0000-0000-00000000000a');

select tests.otonom_raises(
  $q$ select update_my_owner_details(
        'U', null, '1995-01-01'::date, null, 'public', null, false, '{}', null
      ) $q$,
  'rızasız U update_my_owner_details ile public olamaz'
);

reset role;
update profiles set owner_visibility = 'after_match'
where id = 'a1800000-0000-0000-0000-00000000000a';
set local role authenticated;
select tests.act_as('a1800000-0000-0000-0000-00000000000a');

select tests.otonom_raises(
  $q$ select update_my_profile(
        'U', 'Istanbul', 'public', 'U Pet', false, null, null
      ) $q$,
  'rızasız U update_my_profile ile public olamaz'
);

reset role;
update profiles set owner_visibility = 'after_match'
where id = 'a1800000-0000-0000-0000-00000000000a';
set local role authenticated;
select tests.act_as('a1800000-0000-0000-0000-00000000000a');

-- Düzeltmenin bozmaması gerekenler: rızasız kullanıcı gizlenebilir.
select tests.otonom_runs(
  $q$ update profiles set owner_visibility = 'hidden'
      where id = 'a1800000-0000-0000-0000-00000000000a' $q$,
  'rızasız U doğrudan hidden yapabilir'
);
select tests.otonom_runs(
  $q$ select update_my_owner_details(
        'U', null, '1995-01-01'::date, null, 'after_match', null, false, '{}', null
      ) $q$,
  'rızasız U update_my_owner_details ile after_match yapabilir'
);

-- ---------------------------------------------------------------------------
-- 3. Rıza veren C: public olur; geri çekince düşer [karar]
-- ---------------------------------------------------------------------------

select tests.act_as('a1800000-0000-0000-0000-00000000000c');
select record_legal_acceptances('v-test', true, true, false, false);
select record_optional_legal_consent('public_profile_consent', 'v-test', true);

select tests.otonom_runs(
  $q$ select update_my_owner_details(
        'C', null, '1995-01-01'::date, null, 'public', null, false, '{}', null
      ) $q$,
  'geçerli rızası olan C update_my_owner_details ile public olur'
);
select tests.otonom_check(
  $q$ select owner_visibility = 'public'
      from profiles where id = 'a1800000-0000-0000-0000-00000000000c' $q$,
  'C public kaydedildi'
);

-- Geri çekme (accepted = false, en son kayıt).
select record_optional_legal_consent('public_profile_consent', 'v-test', false);

select tests.otonom_check(
  $q$ select owner_visibility = 'after_match'
      from profiles where id = 'a1800000-0000-0000-0000-00000000000c' $q$,
  '[karar: geri çekme] rıza geri çekilince C after_match''e düşer'
);
select tests.otonom_raises(
  $q$ update profiles set owner_visibility = 'public'
      where id = 'a1800000-0000-0000-0000-00000000000c' $q$,
  'rızasını geri çeken C (en son kayıt false) tekrar doğrudan public olamaz'
);

reset role;

do $$
begin
  if coalesce(current_setting('otonom.fails', true), '') <> '' then
    raise exception 'FAIL: A18 kırmızı assert''ler:%', current_setting('otonom.fails', true);
  end if;
end;
$$;

rollback;
```

Not (seçenek B ile birlikte): sahip `owner_visibility` UPDATE grant'ını da kaldırırsa (aşağıda), "rızasız U doğrudan hidden yapabilir" assert'i `assert_raises`'e döner ve `critical-release-gates.test.sql:40` (authenticated olarak doğrudan `hidden` UPDATE) RPC'ye ya da `reset role` altına taşınmalıdır.

## Kabul (2): `test:db` kırmızı çıktısı

Komut (README'deki tek izinli yol, `is` mutlak yoluyla): `cp /tmp/petmatch-otonom/G02.test.sql …/is/supabase/tests/zz_otonom_G02.test.sql && (cd …/is && npm run test:db); rm -f …/zz_otonom_G02.test.sql`. Öncesinde `pgrep -fl 'test-db[.]mjs'` boştu. İmaj `supabase/postgres:17.6.1.111`; 72 migration sıfırdan uygulandı.

Özet: **mevcut 24 dosyanın hepsi ✓; yalnız `zz_otonom_G02.test.sql` ✗ (`1/25 test dosyası düştü`).** Yeni dosyada **9 assert FAIL**. 6 kontrol `ok`; bunlar düzeltmenin bozmaması gereken ve bugün çalışan davranışlar.

```text
✓ 72 migration sıfırdan uygulandı
… (24 mevcut dosya ✓: abuse-hardening … surface)
bilgi profiles.owner_visibility varsayılanı: 'public'::owner_visibility
bilgi authenticated owner_visibility UPDATE kolon yetkisi: t
FAIL yeni kayıt (handle_new_user) profili after_match doğar, public değil
FAIL rızasız U kayıt sonrası public değil
FAIL rıza false olan U doğrudan UPDATE ile public olamaz (onboarding.ts:91 yolu) — hata oluşmadı
ok   V keşifte rızasız U'nun PETİNİ görür (pet eşleşmeden önce görünür — kural)
FAIL V keşifte rızasız U'nun sahip adını/yaş kovasını görmez
FAIL V rızasız U'nun profiles satırını doğrudan okuyamaz (profiles_select_public)
FAIL rızasız U update_my_owner_details ile public olamaz — hata oluşmadı
FAIL rızasız U update_my_profile ile public olamaz — hata oluşmadı
ok   rızasız U doğrudan hidden yapabilir
ok   rızasız U update_my_owner_details ile after_match yapabilir
ok   geçerli rızası olan C update_my_owner_details ile public olur
ok   C public kaydedildi
FAIL [karar: geri çekme] rıza geri çekilince C after_match'e düşer
FAIL rızasını geri çeken C (en son kayıt false) tekrar doğrudan public olamaz — hata oluşmadı
✗ zz_otonom_G02.test.sql
    ERROR:  FAIL: A18 kırmızı assert'ler: | … (9 etiket) …
1/25 test dosyası düştü
```

## Kabul (3): KVKK uyumlu uygulama ve sunucu kuralı

### İlke (kabul kriteri)

1. İnsan fotoğrafı ya da kişisel verisi (ad, bio, yaş kovası, cinsiyet, ilgi alanları) **rızadan önce** keşifte görünmez.
2. **Önceden işaretli kutu ya da varsayılan seçim geçerli rıza değildir.** Kullanıcı dokunmadan `public` yazılmaz. Bugün iki yerde ihlal var: `core/api/onboarding.ts:67-71` (`publicProfileConsent: true` sabit) ve `:90-91` (ilk kayıtta `public`).
3. Rıza, zorunlu yasal kutudan **ayrı** olmalıdır. Yayındaki aydınlatma metni de bunu söylüyor (`app/(auth)/legal.tsx:107-110`). Kod metinle hizalanınca `core/domain/legal.ts:1` (`LEGAL_DOCUMENT_VERSION`) **değişmeden** kalabilir.

### Sahibin "varsayılan resimli" yönü KVKK ile nasıl bağdaşır

- Onboarding'de, yasal kutudan ayrı bir "Sahip profilin nasıl görünsün?" adımı. Üç seçenek: **Resimli** (ilk sırada, "Önerilen" rozetiyle; bu kalıp `app/profile/owner.tsx:64-70` içinde `recommended: true` olarak zaten var), **Resimsiz**, **Yalnız eşleşince**. Hiçbiri seçili gelmez.
- Seçim yapılana kadar profil `after_match` kalır (sunucu varsayılanı). "Varsayılan resimli" ifadesi KVKK'da şu anlama gelebilir: önerilen ve ilk sıradaki seçenek. İşaretli gelen ya da dokunmadan yazılan bir seçim olamaz.
- **[karar: onboarding seçimi]** Seçim zorunlu adım mı olsun (seçmeden "Devam" pasif), yoksa atlanabilir mi (atlarsa `after_match`, sonra Profil'den değiştirilir)? İkisi de KVKK açısından geçerli. Zorunlu adım "resimli"nin seçilme oranını artırır; atlanabilir adım daha az sürtünme yaratır.
- Onboarding'de sahip fotoğrafı adımı yok (yalnız pet fotoğrafı, `core/api/onboarding.ts:128-148`). "Resimli" seçimi, kullanıcı sahip fotoğrafı ekledikten sonra etkili olur. Seçimin metninde bu belirtilmeli.
- Hem "resimli" hem "resimsiz" seçenekte ad/bio/yaş kovası public olur. Bu yüzden **ikisi de** `public_profile_consent = true` gerektirir. Yalnızca "yalnız eşleşince" seçeneğinde rıza `false` yazılır.

### Sunucu kuralı: iki seçenek

| | **A. Tetikleyici** (önerilen, zorunlu) | **B. RPC + UPDATE grant'ının kaldırılması** (A'ya ek, isteğe bağlı) |
|---|---|---|
| Ne | `profiles` üzerinde `before insert or update of owner_visibility`: `new.owner_visibility = 'public'` ve geçerli rıza yoksa `raise 42501`. `legal_acceptances` `after insert`: `public_profile_consent` + `accepted=false` gelirse `public` → `after_match` | `revoke update (owner_visibility) … from authenticated` + `set_my_owner_visibility(p_visibility, p_document_version)` RPC'si; rızayı ve görünürlüğü tek işlemde yazar |
| Artı | Tüm yolları kapsar: doğrudan UPDATE, iki mevcut RPC, ileride eklenecek SECURITY DEFINER fonksiyonlar, service_role. İstemci imzası değişmez | Yazma yolu tek ve dar; rıza ile görünürlük atomik (B6 kapanır); istemci rızayı ayrı yazmayı unutamaz |
| Eksi | Rıza ile görünürlük hâlâ iki çağrı (sıra: önce rıza, sonra yazım; bugünkü sıra `profile.ts:394-411` zaten bu); test yardımcısı düzeltilmeli (B8) | Tek başına yetmez: `update_my_owner_details` / `update_my_profile` SECURITY DEFINER olduğu için grant'tan etkilenmez, içlerine de kontrol gerekir. `onboarding.ts:91` ve `critical-release-gates.test.sql:40` değişir. İki RPC'nin imzası değişirse istemci + tip üretimi gerekir |
| Öneri | **A'yı bu PR'da uygula.** B, 2. fazda (app-kucuk-is + sql-taslak) defense-in-depth olarak eklenebilir | **[karar: B şimdi mi sonra mı]** |

### Migration taslağı (`YYYYMMDDHHMMSS_public_profile_requires_consent.sql`; yalnız rapor)

```sql
-- A18: sahip profili ancak geçerli açık rızayla public olur.
-- Geçerli rıza = kullanıcının EN SON public_profile_consent kaydı accepted.
-- Sürüm (document_version) koşul değil: sürüm değişimi herkesten yeniden
-- onay demektir (core/domain/legal.ts — L0, ayrı karar).

-- 1. Yeni kayıt public doğmaz (0001:28'deki özgün varsayılana dönüş).
alter table profiles alter column owner_visibility set default 'after_match';

-- 2. Rıza yardımcısı (istemciye kapalı; yalnız tetikleyicilerden).
create or replace function has_public_profile_consent(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select la.accepted
    from legal_acceptances la
    where la.user_id = p_user_id
      and la.document_type = 'public_profile_consent'
    order by la.created_at desc, la.id desc
    limit 1
  ), false);
$$;
revoke all on function has_public_profile_consent(uuid) from public, anon, authenticated;

-- 3. Değişmez: public ⇒ geçerli rıza. Tüm yazma yolları (doğrudan UPDATE,
--    update_my_owner_details, update_my_profile, ileride eklenecekler).
create or replace function profiles_enforce_public_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_visibility = 'public'
     and not has_public_profile_consent(new.id) then
    raise exception 'public owner profile requires consent' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function profiles_enforce_public_consent() from public, anon, authenticated;

drop trigger if exists profiles_enforce_public_consent on profiles;
create trigger profiles_enforce_public_consent
  before insert or update of owner_visibility on profiles
  for each row execute function profiles_enforce_public_consent();

-- 4. [karar: geri çekme] Rıza geri çekilince public → after_match.
--    (Alternatif: 'hidden'. after_match, eşleşmiş kişilerle mevcut sohbeti
--    bozmaz; 0066'ya göre owner_social_open after_match ile geçerli kalır.
--    0054 tetikleyicisi require_owner_photo filtresini kendiliğinden kapatır.)
create or replace function legal_acceptances_withdraw_public_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.document_type = 'public_profile_consent' and not new.accepted then
    update profiles
    set owner_visibility = 'after_match'
    where id = new.user_id
      and owner_visibility = 'public';
  end if;
  return new;
end;
$$;
revoke all on function legal_acceptances_withdraw_public_profile() from public, anon, authenticated;

drop trigger if exists legal_acceptances_withdraw_public_profile on legal_acceptances;
create trigger legal_acceptances_withdraw_public_profile
  after insert on legal_acceptances
  for each row execute function legal_acceptances_withdraw_public_profile();

-- 5. Mevcut satırların geçişi: §5'teki karara göre (G-a önerisi aşağıda).
```

- `surface.test.sql` uyumu: anon fonksiyon çalıştıramıyor, SECURITY DEFINER fonksiyonlarda `search_path` sabit, tetikleyici yardımcıları istemciye kapalı (`0058_revoke_trigger_helpers.sql` deseni).
- `record_required_legal_acceptances` (`0056:19-23`) `public_profile_consent` yazmıyor. Bu yüzden yasal metnin yeniden kabulü geri çekme tetikleyicisini **çalıştırmıyor**. `record_legal_acceptances` (`0025:61-69`) her çağrıda bir rıza satırı yazıyor; onboarding yeniden çalışırsa kullanıcının o anki seçimi yazılır (istemci düzeltmesiyle tutarlı).
- **Test yardımcısı (B8), aynı PR:** `_helpers.sql` `tests.seed_user` içinde, `update profiles` satırından **önce** şu eklenir: `if p_visibility = 'public' then insert into legal_acceptances (user_id, document_type, document_version, accepted) values (p_id, 'public_profile_consent', 'test', true); end if;`. Bu ekleme yapılınca `critical-release-gates.test.sql:25-29`, `owner-connection-signal.test.sql:47-50` ve `owner-photos.test.sql:49-53` değişmeden yeşil kalır (bu kullanıcılar `seed_user` ile public açılıyor). Kontrol edildi: `owner-connection-signal.test.sql:64` yalnız `gender_preference_consent` yazıyor, geri çekme tetikleyicisine girmiyor.

## Kabul (3): üç seçeneğin mevcut enum'a eşlenmesi

`owner_visibility` = `hidden | after_match | public` (`0001_init_schema.sql:13`; istemci `core/domain/types.ts:29`).

| Seçenek (UI) | Eşleme | Not |
|---|---|---|
| **Resimli** | `public` | Bugünkü davranış: keşifte ad/kapak/bio/yaş kovası/cinsiyet/ilgi alanları (`0068:274-293`), beğenilerde aynısı (`0068:389-408`), galeri ve avatar storage açık (`20260827144529:34-51`, `0039_avatar_policy_blocked_helper.sql:41-58`) |
| **Yalnız eşleşince** | `after_match` | Keşifte sahip alanları boş (`0068:274-293`, hepsi `= 'public'` koşulunda). Eşleşme aktifken sohbette açılır (`0068:478-481`); galeri ve avatar eşleşmeyle açılır (`20260827144529:45-48`, `0039:53-55`) |
| **Resimsiz** | üç seçenek, aşağıda | **[karar: resimsiz modu]** |

**R1. `hidden` kullanmak** (migration gerekmez). Anlamı "resimsiz" değil, "sahip hiç yok":
- Ad keşifte de, eşleşmeden sonra da görünmez. Sohbetteki sahip profili boş döner (`0068:478-481`), gelen kutusunda ad `null` (`0046_meetup_feedback_from_record.sql:43-46`). UI metni bunu zaten söylüyor (`app/profile/owner.tsx:77-79`).
- "Sahibi görünen petleri göster" tercihini açan izleyicinin destesinden düşer (`0068:177`).
- Sosyal mod açılamaz (`20260827144529:161-168`, constraint `0066:28-35`).
- Kullanıcı kendi tarafında yaş/cinsiyet filtresini kullanamaz (`0068:87-97`).
- Sahibin "resimsiz" niyetiyle (adı/bio'su görünsün, yüzü görünmesin) örtüşmüyor.

**R2. Yeni enum değeri (ör. `public_no_photo`).**
- Her `= 'public'` karşılaştırması yeniden ele alınmalı. Güncel tanımlarda: `0068` (~25 yer: keşif çıktısı `:274-293`, filtreler `:87-97,183-218`, beğeniler `:389-408`, sohbet `:478-481`), `0035_block_hides_public_profile.sql:28-33` (RLS), `0039:51`, `20260827144529:44`, `0054_owner_photo_reciprocity.sql:15,35`, `0021`/`0066` constraint'leri, `update_my_profile` (`0021:172-251`).
- `alter type … add value` aynı transaction'da kullanılamadığı için migration ikiye bölünür.
- İstemcide `OWNER_VISIBILITY` tipi ve tüm `=== "public"` kontrolleri değişir.
- Risk yüksek.

**R3. `public` + ayrı fotoğraf bayrağı (önerilen)**: ör. `profiles.owner_photo_public boolean not null default true`.
- `public` anlamı her yerde aynı kalır; yalnızca **fotoğraf çıktıları** bayrağa bağlanır: keşif kapak yolu (`0068:276`), beğeniler kapak yolu (`0068:391`), fotoğraf filtresi (`0068:183-186`), galeri RLS (`20260827144529:34-51`), avatar storage (`0039:41-58`), fotoğraf karşılıklılığı (`0054:15,35`).
- Eşleşmeden sonra fotoğraf açılır mı? **[karar]**. Önerim evet (`after_match` gibi: `or shares_active_match_with`). Sohbette `0068:464` (`avatar_url`) zaten eşleşme sonrası yüzey.
- Sosyal mod bugün fotoğraf istiyor (`20260827144529:161-168`). Resimsiz + sosyal açık serbest mi? **[karar]**. Önerim: sosyal mod "resimli" ister; mevcut kural korunur.
- A17 bağı: G01 güvenli listesinde `avatar_url` var (8 kolon). Resimsiz kullanıcının **depolama yolu** tablo üzerinden okunabilir, ama nesnenin kendisi storage politikasıyla kapalı kalır (bayrak eklenince). Yol yalnızca kullanıcı uuid'i ve dosya adı; düşük risk. Daha temiz çözüm istenirse `avatar_url` G01 listesinden çıkarılır (kapak yolu RPC'lerden gelir) **[karar]**.
- Rıza: resimsiz de `public` olduğu için tetikleyici aynı kalır (ad/bio/yaş kovası kişisel veri).

Öneri: **R3**. R1 yalnızca geçici çözüm olarak kullanılabilir (UI'da "Resimsiz" yerine "Gizli" adıyla). Yeni mod gerektiği için seçim **sahip kararı**.

## Kabul (4): pet profilinin eşleşme öncesi görünürlüğü yönle uyumlu (doğrulandı)

- Keşif RPC'si adayları sahip görünürlüğünden bağımsız döndürüyor. Aday filtresinde (`0068:138-160`) `owner_visibility` koşulu yok; tek istisna, izleyicinin kendi seçtiği "sahibi görünen petler" tercihi (`0068:177-181`). Kırmızı koşuda `ok`: "V keşifte rızasız U'nun PETİNİ görür".
- Pet alanları ve fotoğraf yolları her aday için dönüyor (`0068:264-270`). Sahip alanları yalnız `public` olduğunda dolu (`0068:274-293`).
- Beğeniler sekmesi de aynı: pet her zaman, sahip yalnız `public` (`0068:375-408`).
- Doğrudan tablo yolu: `pets` başkasına yalnızca eşleşmeden sonra açık (`0006_rls_performance.sql:133-134`); `pet_photos` satırları `visible_pet_ids()` ile (`0006:153-154`). Eşleşme öncesi pet görünürlüğü yalnızca SECURITY DEFINER RPC'den geçiyor, sahip alanlarını o RPC maskeliyor.
- Aydınlatma metniyle uyumlu: "Pet fotoğrafları keşfette görünürdür" (`app/(auth)/legal.tsx:87-88`).
- Dikkat (doğrulanmalı): `pet-photos` bucket'ı **anon** dahil herkese SELECT açık (`20260729212719_pet_photos_storage_select.sql:28-31`); listeleme politikası kaldırılmış (`abuse-hardening.test.sql` "pet-photos listeleme politikası kaldırıldı"). Yol `<sahip-uuid>/<pet-uuid>/<n>.jpg` biçiminde, yani yolu bilen oturumsuz biri fotoğrafı çekebiliyor. Pet görünürlüğü yönüyle çelişmiyor. Pet fotoğrafında insan yüzü olabileceği aydınlatma metninde ayrıca yazılmıyor.

## Kabul (5): mevcut `public` + rızasız satırlar

### Sayım sorgusu taslağı (**çalıştırılmadı**; sahip, salt okuma)

```sql
-- A18 geçiş öncesi sayım. ÇALIŞTIRILMADI. Yalnız sayı döndürür, kişisel veri yok.
with last_consent as (
  select distinct on (la.user_id)
    la.user_id, la.accepted, la.created_at,
    -- Onboarding'in paketli kaydı: aynı işlemde (aynı now()) yazılan 'terms' satırı
    exists (
      select 1 from legal_acceptances t
      where t.user_id = la.user_id
        and t.document_type = 'terms'
        and t.created_at = la.created_at
    ) as bundled
  from legal_acceptances la
  where la.document_type = 'public_profile_consent'
  order by la.user_id, la.created_at desc, la.id desc
)
select
  count(*) filter (where p.owner_visibility = 'public')                                   as public_toplam,
  count(*) filter (where p.owner_visibility = 'public' and lc.user_id is null)            as public_kayitsiz,
  count(*) filter (where p.owner_visibility = 'public' and lc.accepted is false)          as public_rıza_false,
  count(*) filter (where p.owner_visibility = 'public' and lc.accepted and lc.bundled)    as public_paketli_onboarding,
  count(*) filter (where p.owner_visibility = 'public' and lc.accepted and not lc.bundled) as public_ayri_kayit,
  count(*) filter (where p.owner_visibility = 'public' and p.avatar_url is not null)      as public_fotografli
from profiles p
left join last_consent lc on lc.user_id = p.id;
```

Yorum: bugünkü kodla `public_ayri_kayit` satırları da **etkin bir seçim** olduğunu kanıtlamıyor. Bu kayıtları `saveOwnerProfile` (`profile.ts:394-398`; ekran açılışta mevcut `public` değerini seçili gösteriyor, `app/profile/owner.tsx:183`) ve `updateEditableProfile` (`profile.ts:618-621`, B5) kullanıcı görünürlüğe dokunmadan yazıyor. Pratikte mevcut hiçbir rıza kaydı geçerli kabul edilemez.

### Geçiş seçenekleri **[karar: geçiş]**

| | Ne | Artı | Eksi |
|---|---|---|---|
| **G-a (önerilen)** | Migration'da tüm `public` satırlar → `after_match`; sonraki açılışta Kabul (3)'teki üç seçenekli ekran bir kez gösterilir | KVKK açısından temiz; kural istisnasız; sayım sorgusu yalnız bilgi amaçlı | Kullanıcılar yeniden seçene kadar keşifte sahip alanları boş görünür. `0054` tetikleyicisi bu kullanıcıların `require_owner_photo` filtresini kapatır. "Seçim yapıldı mı" bilgisini tutacak bir alan gerekir (aşağıda) |
| G-b | Yalnız `kayitsiz` + `rıza_false` → `after_match`; paketli/ayrı kayıtlılar `public` kalır, yine de seçim sorulur | Keşifteki görünür sahip sayısı daha az düşer | Paketli rıza geçersiz olduğu için risk seçim yapılana kadar sürer; kabul kriteri (rızadan önce public yok) kısmen ihlal edilir |
| G-c | Satırlara dokunma, yalnız seçim sor | En az sürtünme | Kabul kriterini karşılamaz; önerilmez |

- "Seçim yapıldı mı" bilgisi: ya `profiles.owner_visibility_chosen_at timestamptz` (G01 güvenli listesine **girmez**, `get_my_profile()` ile okunur) ya da geçiş tarihinden sonraki ayrı bir `public_profile_consent` kaydından türetilir. Kolon daha açık ve test edilebilir **[karar]**.
- G-a için ek migration satırı: `update profiles set owner_visibility = 'after_match' where owner_visibility = 'public';` (tetikleyici yalnızca `public` yazımını denetlediği için sıra önemli değil).

## Kabul (6): istemci etki listesi

| Yer | Bugün | Değişim |
|---|---|---|
| `core/api/onboarding.ts:26-45` (`OnboardingInput`) | Görünürlük alanı yok | `ownerVisibility: OwnerVisibility \| null` (+ R3 seçilirse `ownerPhotoPublic`). `null` = seçim yapılmadı |
| `core/api/onboarding.ts:67-71` | `publicProfileConsent: true` sabit | `publicProfileConsent: input.ownerVisibility === "public"` (resimli ve resimsiz için true). Tetikleyici yüzünden **önce** rıza yazılır, sonra profil (bugünkü sıra zaten bu) |
| `core/api/onboarding.ts:90-91` | İlk kayıtta `owner_visibility: "public"` | Yalnızca kullanıcı seçtiyse seçilen değer yazılır; `null` ise alan hiç yazılmaz (sunucu varsayılanı `after_match`). Dosya başı yorum `:16-20` ("Görünürlük keşfette açık başlar") güncellenir |
| `app/onboarding.tsx:837-849` | Zorunlu kutu metni görünürlük cümlesini içeriyor (`:845-847`) | Bu cümle çıkarılır; kutu yalnızca koşullar + aydınlatma için kalır |
| `app/onboarding.tsx:~851-861` (yorum `:856-860`) | Yorum "rıza completeOnboarding'de" diyor | Yasal kutudan **ayrı** üç seçenekli radyo grubu (resimli → önerilen, ilk sırada; hiçbiri seçili değil). Seçenek listesi `app/profile/owner.tsx:58-81` ile paylaşılan bir sabite taşınabilir. `:409-414` doğrulamasına seçim kontrolü eklenir (zorunlu adım seçilirse) |
| `core/api/profile.ts:394-398` (`saveOwnerProfile`) | Her kayıtta rıza yazıyor | Yalnızca görünürlük değiştiğinde yazar (önceki değer parametre olarak gelir). Sıra korunur: rıza önce |
| `core/api/profile.ts:618-621` (`updateEditableProfile`) | Görünürlüğü düzenlemeyen ekran için rıza yazıyor (B5) | `public_profile_consent` çağrısı kaldırılır. `p_owner_visibility` mevcut değeri geri göndermeye devam eder; tetikleyici geçerli rızası olanı geçirir, olmayanı (geçişten sonra zaten olmaz) reddeder |
| `app/profile/owner.tsx:58-81,753-764` (görünürlük seçici) | Üç seçenek: Keşfette görünür / Yalnızca eşleşince / Gizli | R3: "Keşfette görünür" ikiye ayrılır (resimli / resimsiz) ya da altına bir "fotoğrafım görünsün" anahtarı eklenir; R1: "Gizli" etiketi korunur. `:160` başlangıç `useState("public")` → `"after_match"` (yükleme öncesi yanlış seçimi göstermesin; doğrulanmalı) |
| `stores/auth.ts:33` (`readAccountStatus`) | `onboarded_at, region_slug` | G-a seçilirse `owner_visibility_chosen_at` da okunur (A17 sonrası `get_my_profile()` ile) ve seçim ekranına yönlendirilir |
| `types/database.ts` | — | R3 kolonu / `owner_visibility_chosen_at` / B seçeneğinin RPC'si eklenirse `gen:types` (L0, sahip; migration canlıya uygulandıktan sonra) |
| `core/domain/legal.ts:1` | `2026-08-22-v3` | **Değişmez.** Aydınlatma metni (`app/(auth)/legal.tsx:107-110`) ayrı ve isteğe bağlı rızayı zaten anlatıyor; kod metne hizalanıyor. Metin değişirse (ör. resimsiz modun anlatımı) sürüm değişikliği herkesten yeniden onay ister: L0, ayrı karar |

## Doğrulanamayanlar

- **Canlıdaki sayılar:** sayım sorgusu çalıştırılmadı (canlı bağlantı yasak). G-a önerisi sayıdan bağımsız; G-b'yi seçmek için sahip sorguyu salt okuma olarak çalıştırmalı.
- **Düzeltmenin yeşil koşusu:** migration taslağı yerelde uygulanmadı (L1'de migration yazılmıyor). Sahip PR'ında beklenen sonuç: bu test (yumuşak assert'ler `tests.assert`'e çevrilmiş) + `seed_user` düzeltmesiyle 25/25.
- **Onboarding UI akışı** (seçim adımının yeri, "Devam" davranışı) simülatörde denenmedi (L0). Satır referansları kod okumasından.
- **`app/profile/owner.tsx:160`** başlangıç değerinin yükleme bitmeden kaydedilebildiği kod okumasından doğrulanamadı (kaydetme düğmesinin yükleme sırasında pasif olup olmadığı ayrıca okunmalı). Düşük risk.
- **Hukuki değerlendirme:** "paketli rıza geçersizdir, önceden seçili seçenek rıza değildir" ilkesi kuyruk kabul kriterinde ve aydınlatma metninde yazıyor. Bu rapor bir hukuk görüşü değil; yayın öncesi `docs/legal-release-checklist.md` incelemesi sahipte.
- **Guard notu:** salt okuma amaçlı bir `awk 'NR>=…'` komutu otonom hook tarafından "supabase/ dosyasına yazma" diye engellendi (`>=` ifadesi yönlendirme sanıldı). Komut yeniden yazılmadı; aynı satırlar Read aracıyla okundu. Hook'taki bu yanlış pozitif sahip için bilgi notu.

## İyi olanlar

- Okuma yüzeylerinin hepsi SECURITY DEFINER RPC'de ve sahip alanları tek bir `= 'public'` kapısıyla maskeleniyor (`0068`). Rıza kuralı yalnızca **yazma** tarafına eklenince okuma yüzeyleri değişmeden doğru davranır.
- Rıza altyapısı hazır: `legal_acceptances` denetim izi (`0025:4-32`), istemci doğrudan insert edemiyor, isteğe bağlı rıza RPC'si (`0066:50-80`), yeniden kabulde isteğe bağlı rızalara dokunulmuyor (`0056`).
- Aydınlatma metni (`legal.tsx:107-110`) doğru ilkeyi yazıyor. Düzeltme hukuk metnine değil, koda dokunuyor.

## İş önerileri (kuyruk `öneriler` için; dispatcher merkez'de ekler)

- **Sahip / L0:** A18 düzeltme PR'ı. İçerik: migration taslağı (A seçeneği) + `public-profile-consent.test.sql` (yumuşak assert'ler `tests.assert`'e çevrilmiş) + `_helpers.sql` `seed_user` rıza satırı + Kabul (6) istemci değişimleri + seçilen geçiş (G-a önerisi). Kabul: `test:db` 25/25, `npm test`/`typecheck` yeşil, onboarding → seçim yapmadan devam → keşifte sahip alanları boş; elle denenmiş.
- **app-test (L2), A18 sonrası:** `core/api/onboarding.ts` için vitest. `ownerVisibility: null` → `owner_visibility` yazılmıyor ve `publicProfileConsent: false` gidiyor; `"public"` → önce rıza, sonra update. `updateEditableProfile` rıza yazmıyor (B5). Kabul: `vi.mock("./supabase.client")`, `./legal` kalıbı; çağrı sırası kilitli.
- **app-kucuk-is (2. faz):** B6. Atomik `set_my_owner_visibility` RPC'si (B seçeneği) + `owner_visibility` UPDATE grant'ının kaldırılması. Kabul: rıza ve görünürlük tek işlemde; `critical-release-gates.test.sql:40` RPC'ye taşınmış.
- **guvenlik-test / sql-taslak (2. faz):** "resimsiz" mod (R3) kararından sonra fotoğraf bayrağının kırmızı testi. Kabul: resimsiz `public` sahibin kapak yolu keşifte/beğenilerde `null`, galeri/avatar storage eşleşme öncesi kapalı, ad/bio görünür.

## Sahip kararı

- **[karar: resimsiz modu]** R1 (`hidden`, migration yok, anlamı "sahip hiç yok"), R2 (yeni enum değeri, yüksek risk) ya da R3 (`public` + fotoğraf bayrağı, öneri).
- **[karar: geri çekme]** Rıza geri çekilince `after_match` (öneri) mi `hidden` mı?
- **[karar: geçiş]** G-a (tüm `public` → `after_match` + bir kez seçim, öneri), G-b ya da G-c; "seçim yapıldı" bilgisi kolonda mı tutulsun (öneri) yoksa rıza kaydından mı türetilsin?
- **[karar: onboarding seçimi]** Üç seçenekli adım zorunlu mu (seçmeden devam yok) yoksa atlanabilir mi (atlarsa `after_match`)?
- **[karar: B şimdi mi sonra mı]** UPDATE grant'ının kaldırılması ve atomik RPC bu PR'da mı, 2. fazda mı (öneri: 2. faz)?
- **[karar: R3 alt kararları]** Resimsiz kullanıcının fotoğrafı eşleşince açılsın mı (öneri: evet); sosyal mod resimsizle açılabilsin mi (öneri: hayır); `avatar_url` G01 güvenli listesinde kalsın mı?
- **[karar: aktiflik kovası]** `public` olmayan sahibin aktiflik kovası keşifte kalsın mı (B7)?
