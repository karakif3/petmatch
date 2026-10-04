# Denetim — güvenlik — 2026-10-04 · G01 · A17 profil kolon gizliliği

Kapsam: kuyruk G01 (guvenlik-test, L1) — `profiles` tablosunda başka kullanıcıların hassas kolonlarının (`birth_date`, `gender`, `last_active_at` …) doğrudan okunabilmesi.
Başlangıç (tekrar keşfedilmedi): `oc/orchestrator/audit/2026-10-03-petmatch-kuyruk-onerisi.md` §1 ve §4, `oc/orchestrator/audit/2026-10-03-kod-denetimi.md` §2 bulgu (1).
Yöntem: salt okuma (`rg`, migration/istemci okuma) + yerel `npm run test:db` kırmızı koşusu (README "guvenlik-test kırmızı test koşusu"; geçici `supabase/tests/zz_otonom_G01.test.sql` koşudan hemen sonra silindi). 1 koşu kullanıldı (bütçe 3).
Hiçbir kod/migration/test dosyası değiştirilmedi, canlıya bağlanılmadı. Bu PR'ın diff'i yalnız bu rapor.

## Sahip-acil (ajan yapamaz)

| # | Bulgu | Yer | Senaryo | Yapılacak |
|---|---|---|---|---|
| S1 | A17 açık (kırmızı test ile kanıtlandı) | `supabase/migrations/0035_block_hides_public_profile.sql:28-33`, `0006_rls_performance.sql:111-114`; `profiles` için SELECT kolon grant'ı hiç yok | Herhangi bir oturum açmış kullanıcı PostgREST ile `profiles?select=id,birth_date,gender,last_active_at&owner_visibility=eq.public` çağırıp tüm public profillerin tam doğum tarihini, cinsiyetini ve son aktiflik zamanını toplar; eşleştiği `after_match` kişilerin de aynı alanları açık | Aşağıdaki migration taslağı + 5 istemci okuma yeri + etkilenen 3 mevcut test, tek PR'da (sahip oturumu). Canlıya uygulama sahipte |

## Bulgular (önem sırasıyla)

| # | Önem | Bulgu | Yer | Senaryo | Öneri (hat, seviye) | Kabul kriteri |
|---|---|---|---|---|---|---|
| B1 | Yüksek | `profiles`'ta SELECT kolon daraltması yok; RLS satırı açınca 19 kolonun hepsi okunuyor | Politikalar `0006_rls_performance.sql:105-114`, `0035_block_hides_public_profile.sql:28-33`; yalnız UPDATE kolon grant'ı var (`0012_integrity_and_conversation_membership.sql:16-27`, `0021_owner_social_discovery.sql:38`); hassas kolonlar `0008_goal_model.sql:39-42` | Yukarıdaki S1. Yaş kovası ve cinsiyet tek yönlü gösterim kuralı (`0068`) yalnız RPC'de uygulanıyor; tablo yolu kuralı tamamen atlıyor | Sahip (L0 migration) — aşağıdaki taslak | Kırmızı test (aşağıda) yeşil; mevcut 24 dosya yeşil (3'ü güncellenmiş hâliyle) |
| B2 | Orta | `anon` rolü `profiles` üzerinde tablo SELECT yetkisine sahip (test ortamında `t / t`). Satır dönmüyor (tüm politikalar `to authenticated`), ama yetki gereksiz | Test çıktısı bilgi satırı; politikalar `0006_rls_performance.sql:105-114` | Bugün sızıntı yok; ileride `to public` bir politika eklenirse anon tam satırı okur | Sahip — migration taslağı `revoke select … from anon` içeriyor | `has_any_column_privilege('anon','public.profiles','SELECT')` false |
| B3 | Orta (düzeltmenin yan etkisi) | Düzeltme sonrası kendi satırından güvenli liste dışı kolon okuyan 3 mevcut test dosyası `permission denied` ile düşer | `supabase/tests/owner-connection-signal.test.sql:34-35,53` (`connection_tag`), `owner-photos.test.sql:44,56` (`verification_status`), `regions.test.sql:24,31,39,57` (`region_slug`) — hepsi `set local role authenticated` altında | A17 PR'ı CI `database` adımında kırmızı kalır | Sahip, aynı PR'da: bu okumaları `get_my_profile()` üzerinden yap (ör. `(select connection_tag from get_my_profile())`) | Düzeltme PR'ında `test:db` 25/25 yeşil |
| B4 | Düşük (doğrulanmalı) | `updateOwnerDiscoveryFilters` kendi profilini `.eq("id")` olmadan `.single()` ile okuyor; RLS kendi + tüm public + eşleşilen satırları döndürdüğü için birden fazla satır gelir ve `.single()` hata verir. Fonksiyonun uygulamada çağıranı yok (`rg` yalnız tanımı buluyor) | `core/api/profile.ts:462-471` | Bugün ölü kod; birisi bağlarsa fotoğraf filtresi açılamaz. Sunucu tarafı zaten aynı kuralı uyguluyor (`critical-release-gates.test.sql:20,33`) | `app-kucuk-is` (2. faz) ya da A17 PR'ında: istemci ön kontrolünü kaldır ya da `get_my_profile()` kullan | Fonksiyon ya silinir ya da `rpc("get_my_profile")` ile tek satır okur; vitest ile `.eq`/RPC çağrısı kilitlenir |

## Kabul (1) — SQL test taslağı (`supabase/tests/profile-column-privacy.test.sql`)

Kalıp: `tests.seed_user` + `tests.act_as` + `set local role authenticated` (`supabase/tests/_helpers.sql:44-83`, örnek `owner-age-gender-display.test.sql`). Bütün kırmızı assert'leri tek koşuda göstermek için yumuşak assert kullanır (`tests.otonom_*`, transaction içinde oluşturulup rollback ile silinir); dosya sonunda topluca `raise exception`. Sahip düzeltme PR'ında bunları `tests.assert` / `tests.assert_raises`'e çevirebilir. Fonksiyon çağrı yetkisi `has_function_privilege` ile denetlenir (`_helpers.sql:22-25` segfault notu).

Kapsadığı kabul maddeleri: A, public B'nin `birth_date`/`gender`/`last_active_at`'ini okuyamaz (`has_column_privilege` false + doğrudan select hata/boş, `select *` dahil); eşleştiği `after_match` C'nin `birth_date`'ini de okuyamaz; `display_name`/`bio`/`city`/`avatar_url` okunur; A kendi `birth_date`/`gender`'ını `get_my_profile()` ile okur; `discover_playdate_pets` yaş kovası + cinsiyet değişmez. Ek kontroller: `owner_photos` politikasının `profiles` alt sorgusu (`20260827144529_owner_photos_and_verification_decouple.sql:34-50`) ve kendi satırına doğrudan UPDATE (`core/api/onboarding.ts:84-93` deseni) bozulmaz.

```sql
-- profile-column-privacy (A17) — KIRMIZI TEST TASLAĞI (G01, otonom guvenlik-test L1)
--
-- "Olması gereken"i tanımlar: başka bir kullanıcının profil satırı RLS ile
-- görünür olsa bile (public ya da after_match + aktif eşleşme) hassas kolonlar
-- (`birth_date`, `gender`, `last_active_at` …) doğrudan tablodan okunamaz;
-- kişi kendi hassas alanlarını `get_my_profile()` RPC'siyle okur; keşif
-- RPC'leri (SECURITY DEFINER) değişmez.
--
-- Bugün (düzeltme öncesi) kırmızıdır: `profiles` üzerinde SELECT kolon grant'ı
-- yok, `profiles_select_public` (0035:28-33) ve `profiles_select_matched`
-- (0006:111-114) satırı tüm kolonlarıyla açıyor.
--
-- Biçim notu: `tests.assert` ilk FAIL'de dosyayı durdurduğu için bu taslak
-- tüm kırmızı assert'leri tek koşuda göstermek üzere yumuşak assert kullanır
-- (`tests.otonom_*`, transaction içinde yaratılır, rollback ile silinir). Sahip
-- düzeltme PR'ında bunları `tests.assert` / `tests.assert_raises`'e çevirebilir.
--
-- Gizli bağ: `_helpers.sql` (SELECT için kolon grant'ı varsa o türe dokunmaz)
-- → düzeltme sonrası test ortamı prod'daki kolon daraltmasını aynen yansıtır.

begin;

\echo '  profiles: hassas kolonlar başkasına kapalı, kendi verisi RPC ile (A17)'

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

/** p_sql hata vermeli ya da NULL döndürmeli; değer dönerse FAIL (değer yazılmaz). */
create function tests.otonom_denied(p_sql text, p_label text)
returns void
language plpgsql
as $$
declare
  v_result text;
begin
  begin
    execute p_sql into v_result;
  exception
    when others then
      raise notice '    ok   % [%]', p_label, sqlerrm;
      return;
  end;
  if v_result is null then
    raise notice '    ok   % [boş]', p_label;
  else
    raise notice '    FAIL % — değer döndü', p_label;
    perform tests.otonom_fail(p_label);
  end if;
end;
$$;

grant execute on function tests.otonom_fail(text), tests.otonom_check(text, text),
  tests.otonom_denied(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Veri: A (izleyici, public), B (public, kadın), C (after_match, A ile eşleşmiş)
-- ---------------------------------------------------------------------------

select tests.seed_user('a1700000-0000-0000-0000-00000000000a', 'male', 'public');
select tests.seed_user('a1700000-0000-0000-0000-00000000000b', 'female', 'public');
select tests.seed_user('a1700000-0000-0000-0000-00000000000c', 'male', 'after_match');

select tests.assign_region('a1700000-0000-0000-0000-00000000000a', 'kadikoy');
select tests.assign_region('a1700000-0000-0000-0000-00000000000b', 'kadikoy');
select tests.assign_region('a1700000-0000-0000-0000-00000000000c', 'kadikoy');

select tests.seed_pet('a17a0000-0000-0000-0000-00000000000a', 'a1700000-0000-0000-0000-00000000000a', 'A Pet');
select tests.seed_pet('a17b0000-0000-0000-0000-00000000000b', 'a1700000-0000-0000-0000-00000000000b', 'B Pet');
select tests.seed_pet('a17c0000-0000-0000-0000-00000000000c', 'a1700000-0000-0000-0000-00000000000c', 'C Pet');

insert into pet_photos (pet_id, storage_path, position)
values
  ('a17b0000-0000-0000-0000-00000000000b', 'a17b0000-0000-0000-0000-00000000000b/1.jpg', 0),
  ('a17c0000-0000-0000-0000-00000000000c', 'a17c0000-0000-0000-0000-00000000000c/1.jpg', 0);

select tests.seed_match('a17a0000-0000-0000-0000-00000000000a', 'a17c0000-0000-0000-0000-00000000000c');

-- Bilgi: tablonun kolonları (rapordaki güvenli liste bununla karşılaştırılır).
do $$
begin
  raise notice '    bilgi profiles kolonları: %', (
    select string_agg(column_name::text, ',' order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
  );
  raise notice '    bilgi authenticated SELECT kolonları: %', (
    select string_agg(column_name::text, ',' order by ordinal_position)
    from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles'
      and has_column_privilege('authenticated', 'public.profiles', column_name, 'SELECT')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 1. Yetki kataloğu (postgres olarak)
-- ---------------------------------------------------------------------------

select tests.otonom_check(
  $q$ select not has_column_privilege('authenticated', 'public.profiles', 'birth_date', 'SELECT') $q$,
  'authenticated profiles.birth_date SELECT yetkisi yok'
);
select tests.otonom_check(
  $q$ select not has_column_privilege('authenticated', 'public.profiles', 'gender', 'SELECT') $q$,
  'authenticated profiles.gender SELECT yetkisi yok'
);
select tests.otonom_check(
  $q$ select not has_column_privilege('authenticated', 'public.profiles', 'last_active_at', 'SELECT') $q$,
  'authenticated profiles.last_active_at SELECT yetkisi yok'
);
select tests.otonom_check(
  $q$ select has_column_privilege('authenticated', 'public.profiles', 'display_name', 'SELECT')
        and has_column_privilege('authenticated', 'public.profiles', 'bio', 'SELECT')
        and has_column_privilege('authenticated', 'public.profiles', 'city', 'SELECT')
        and has_column_privilege('authenticated', 'public.profiles', 'avatar_url', 'SELECT') $q$,
  'authenticated display_name/bio/city/avatar_url SELECT yetkisi var'
);
-- Güvenli liste tam eşitlik: yeni kolon eklendiğinde bilinçli grant ister.
-- (Liste rapordaki öneridir; sahip değiştirirse yalnız bu dizi değişir.)
select tests.otonom_check(
  $q$ select coalesce(array_agg(column_name::text order by column_name::text), '{}')
             = array['avatar_url','bio','city','display_name','id','interests',
                     'owner_social_open','owner_visibility']
      from information_schema.columns
      where table_schema = 'public' and table_name = 'profiles'
        and has_column_privilege('authenticated', 'public.profiles', column_name, 'SELECT') $q$,
  'authenticated SELECT kolonları tam olarak güvenli liste'
);
select tests.otonom_check(
  $q$ select has_function_privilege('authenticated', 'public.get_my_profile()', 'EXECUTE') $q$,
  'get_my_profile() authenticated çağırabilir'
);
select tests.otonom_check(
  $q$ select not has_function_privilege('anon', 'public.get_my_profile()', 'EXECUTE') $q$,
  'get_my_profile() anon çağıramaz'
);

-- ---------------------------------------------------------------------------
-- 2. A, public B'yi ve eşleştiği after_match C'yi doğrudan okur
-- ---------------------------------------------------------------------------

set local role authenticated;
select tests.act_as('a1700000-0000-0000-0000-00000000000a');

select tests.otonom_denied(
  $q$ select birth_date::text from profiles where id = 'a1700000-0000-0000-0000-00000000000b' $q$,
  'A, public B''nin birth_date''ini okuyamaz'
);
select tests.otonom_denied(
  $q$ select gender from profiles where id = 'a1700000-0000-0000-0000-00000000000b' $q$,
  'A, public B''nin gender''ını okuyamaz'
);
select tests.otonom_denied(
  $q$ select last_active_at::text from profiles where id = 'a1700000-0000-0000-0000-00000000000b' $q$,
  'A, public B''nin last_active_at''ini okuyamaz'
);
select tests.otonom_denied(
  $q$ select (to_jsonb(p) ->> 'birth_date') from profiles p where id = 'a1700000-0000-0000-0000-00000000000b' $q$,
  'A, select * ile B''nin birth_date''ini alamaz'
);
select tests.otonom_denied(
  $q$ select birth_date::text from profiles where id = 'a1700000-0000-0000-0000-00000000000c' $q$,
  'A, eşleştiği after_match C''nin birth_date''ini okuyamaz'
);
select tests.otonom_check(
  $q$ select display_name is not null and bio is null and city = 'Istanbul' and avatar_url is not null
      from profiles where id = 'a1700000-0000-0000-0000-00000000000b' $q$,
  'A, public B''nin display_name/bio/city/avatar_url''ini okur'
);

-- Gizli bağ: owner_photos politikası profiles.id + owner_visibility okur
-- (20260827144529:34-50, storage 0039:41-58). Güvenli listeden düşerse bozulur.
select tests.otonom_check(
  $q$ select count(*) = 1 from owner_photos where owner_id = 'a1700000-0000-0000-0000-00000000000b' $q$,
  'A, public B''nin owner_photos satırını görür (politika alt sorgusu çalışır)'
);

-- Kendi satırına doğrudan UPDATE (onboarding.ts:85 deseni) bozulmaz:
-- WHERE id = … için id üzerinde SELECT yetkisi gerekir.
select tests.otonom_check(
  $q$ with u as (
        update profiles set city = 'Istanbul'
        where id = 'a1700000-0000-0000-0000-00000000000a'
        returning 1
      ) select count(*) = 1 from u $q$,
  'A kendi satırını doğrudan güncelleyebilir'
);

-- ---------------------------------------------------------------------------
-- 3. A kendi hassas alanlarını RPC ile okur
-- ---------------------------------------------------------------------------

select tests.otonom_check(
  $q$ select birth_date = '1995-01-01'::date and gender = 'male'
      from get_my_profile() $q$,
  'A kendi birth_date/gender''ını get_my_profile() ile okur'
);
select tests.otonom_check(
  $q$ select count(*) = 1 and bool_and(id = 'a1700000-0000-0000-0000-00000000000a')
      from get_my_profile() $q$,
  'get_my_profile() yalnız çağıranın satırını döndürür'
);

-- ---------------------------------------------------------------------------
-- 4. Keşif RPC'si (SECURITY DEFINER) değişmez
-- ---------------------------------------------------------------------------

select tests.otonom_check(
  $q$ select owner_age_bucket is not null and owner_gender = 'female'
      from discover_playdate_pets('a17a0000-0000-0000-0000-00000000000a')
      where id = 'a17b0000-0000-0000-0000-00000000000b' $q$,
  'discover_playdate_pets B için yaş kovası + cinsiyeti hâlâ döndürür'
);

reset role;

-- service_role (send-notification) bilgi amaçlı: revoke yalnız authenticated/anon.
do $$
begin
  raise notice '    bilgi service_role profiles SELECT (tablo): %',
    has_table_privilege('service_role', 'public.profiles', 'SELECT');
  raise notice '    bilgi anon profiles SELECT (tablo / herhangi kolon): % / %',
    has_table_privilege('anon', 'public.profiles', 'SELECT'),
    has_any_column_privilege('anon', 'public.profiles', 'SELECT');
end;
$$;

do $$
begin
  if coalesce(current_setting('otonom.fails', true), '') <> '' then
    raise exception 'FAIL: A17 kırmızı assert''ler:%', current_setting('otonom.fails', true);
  end if;
end;
$$;

rollback;
```

## Kabul (2) — `test:db` kırmızı çıktısı

Komut (README tek izinli yol, `is` mutlak yoluyla): `cp /tmp/petmatch-otonom/G01.test.sql …/is/supabase/tests/zz_otonom_G01.test.sql && npm run test:db; rm -f …/zz_otonom_G01.test.sql`. İmaj `supabase/postgres:17.6.1.111` (Docker Hub'dan çekildi), 72 migration sıfırdan uygulandı.

Özet: **mevcut 24 dosyanın hepsi ✓; yalnız `zz_otonom_G01.test.sql` ✗ — `1/25 test dosyası düştü`.** Yeni dosyada **13 assert FAIL**, 5 kontrol `ok` (düzeltmenin bozmaması gereken davranışlar bugün çalışıyor).

```text
bilgi profiles kolonları: id,display_name,avatar_url,bio,city,owner_visibility,require_visible_owner,onboarded_at,created_at,updated_at,birth_date,gender,last_active_at,verification_status,verified_at,owner_social_open,region_slug,interests,connection_tag
bilgi authenticated SELECT kolonları: (19 kolonun hepsi)
FAIL authenticated profiles.birth_date SELECT yetkisi yok
FAIL authenticated profiles.gender SELECT yetkisi yok
FAIL authenticated profiles.last_active_at SELECT yetkisi yok
ok   authenticated display_name/bio/city/avatar_url SELECT yetkisi var
FAIL authenticated SELECT kolonları tam olarak güvenli liste
FAIL get_my_profile() authenticated çağırabilir [hata: function "public.get_my_profile()" does not exist]
FAIL get_my_profile() anon çağıramaz [hata: function "public.get_my_profile()" does not exist]
FAIL A, public B'nin birth_date'ini okuyamaz — değer döndü
FAIL A, public B'nin gender'ını okuyamaz — değer döndü
FAIL A, public B'nin last_active_at'ini okuyamaz — değer döndü
FAIL A, select * ile B'nin birth_date'ini alamaz — değer döndü
FAIL A, eşleştiği after_match C'nin birth_date'ini okuyamaz — değer döndü
ok   A, public B'nin display_name/bio/city/avatar_url'ini okur
ok   A, public B'nin owner_photos satırını görür (politika alt sorgusu çalışır)
ok   A kendi satırını doğrudan güncelleyebilir
FAIL A kendi birth_date/gender'ını get_my_profile() ile okur [hata: function get_my_profile() does not exist]
FAIL get_my_profile() yalnız çağıranın satırını döndürür [hata: function get_my_profile() does not exist]
ok   discover_playdate_pets B için yaş kovası + cinsiyeti hâlâ döndürür
bilgi service_role profiles SELECT (tablo): t
bilgi anon profiles SELECT (tablo / herhangi kolon): t / t
✗ zz_otonom_G01.test.sql
    ERROR:  FAIL: A17 kırmızı assert'ler: | … (13 etiket) …
1/25 test dosyası düştü
```

## Kabul (3) — Düzeltme planı

### Güvenli kolon listesi (authenticated'a SELECT)

`profiles` 19 kolon (test çıktısı, `types/database.ts:866-889` ile aynı). Kural: **başkasının satırı için yalnız RLS politikalarının ve ürünün zaten gösterdiği vitrin alanları**; geri kalan her şey ya kişinin kendisine (`get_my_profile()`) ya da SECURITY DEFINER RPC'lere (kova/maske uygulayarak) kalır. İstemcide başkasının `profiles` satırını doğrudan okuyan yer yok (`rg 'from("profiles")'` yalnız kendi satırını okuyan 5 yeri ve bir UPDATE'i buluyor; gömülü `profiles(...)` join'i yok); keşif/beğeni/sohbet yüzeyleri SECURITY DEFINER RPC (profiles'a dokunan 32 fonksiyonun hepsi definer, invoker yok; view yok).

| Kolon | Karar | Gerekçe |
|---|---|---|
| `id` | **grant** | Politika alt sorguları (`20260827144529_…:38-48` owner_photos, `0039_avatar_policy_blocked_helper.sql:41-58` storage) çağıran bağlamında `p.id` okur; kendi satırına `UPDATE … WHERE id=` (`core/api/onboarding.ts:84-93`) `id` üzerinde SELECT ister |
| `owner_visibility` | **grant** | Aynı iki politika `p.owner_visibility` okur; satır görünürse zaten çıkarılabilir (politika kendisi bunu ele verir) |
| `display_name`, `avatar_url`, `bio`, `city` | **grant** | Kabul kriterinin vitrin alanları; public profilde ürünün gösterdiği bilgi (`city` serbest metin, ≤80, `20260929120000_…:416`) |
| `interests` | **grant** | Sabit taksonomi, keşifte zaten gösteriliyor (`0049_owner_interests_in_discovery.sql`); hassas değil. Alternatif: dar liste (aşağıda sahip kararı) |
| `owner_social_open` | **grant** | Keşif filtresinin public sahip için açıkladığı bayrak (`0066_connection_signal_and_consent.sql:6-10`); `after_match` satırını yalnız eşleşen görür. Alternatif: dar liste |
| `birth_date`, `gender` | **revoke** | Asıl açık; gösterim yalnız RPC'de yaş kovası / tek yönlü cinsiyet (`0068_owner_age_gender_one_way.sql:11,54`) |
| `last_active_at` | **revoke** | Aktiflik zamanı = davranış takibi (taciz senaryosu) |
| `region_slug`, `require_visible_owner`, `verification_status`, `verified_at`, `connection_tag`, `onboarded_at`, `created_at`, `updated_at` | **revoke** | Konum/tercih/moderasyon/üstveri; başkasına ham hâli gerekmiyor. `connection_tag` romantik sinyal — gösterim RPC'de koşullu (`0066:12-15`) |

Not: kolon grant'ı yeni kolonlara yayılmaz — ileride eklenen her kolon varsayılan olarak kapalı doğar; taslaktaki "tam eşitlik" assert'i bunu bilinçli karar hâline getirir.

### Migration taslağı (`YYYYMMDDHHMMSS_profiles_column_privacy.sql`; yalnız rapor)

```sql
-- A17: profiles satırı RLS ile görünür olsa bile hassas kolonlar başkasına kapalı.
-- Kişi kendi tam satırını get_my_profile() ile okur. Keşif/beğeni/sohbet RPC'leri
-- SECURITY DEFINER olduğu için etkilenmez; service_role (edge) etkilenmez.

revoke select on table public.profiles from anon, authenticated;

grant select (
  id,
  display_name,
  avatar_url,
  bio,
  city,
  owner_visibility,
  owner_social_open,
  interests
) on table public.profiles to authenticated;

create or replace function public.get_my_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;
```

- `returns setof public.profiles`: PostgREST `rpc("get_my_profile").select("<kolonlar>")` ile kolon seçimine izin verir; istemci değişikliği sorgu başına tek satır kalır. Oturumsuz çağrıda `auth.uid()` null → boş küme.
- `surface.test.sql` kontrolleri (anon fonksiyon çalıştıramaz, definer'da `search_path` sabit, `(select auth.uid())` sarmalı) taslakla uyumlu.
- Gizli bağ: `supabase/tests/_helpers.sql:144-169` SELECT türü için kolon grant'ı varsa toptan grant vermez → test ortamı prod daraltmasını aynen yansıtır (bugün grant yok diye helper tablo SELECT'i veriyordu).

### İstemcinin kendi satırını okuduğu 5 yer

| Yer | Okunan kolonlar | Liste dışı | Değişim |
|---|---|---|---|
| `core/api/profile.ts:152-158` (`loadEditableProfile`) | display_name, city, owner_visibility, bio, birth_date, gender, avatar_url, owner_social_open, connection_tag, interests, verification_status, region_slug | birth_date, gender, connection_tag, verification_status, region_slug | `.from("profiles").select(…).eq("id", userId).single()` → `.rpc("get_my_profile").select(…).single()`; eşleme `:238-246` değişmez |
| `core/api/discovery.ts:235-241` (`loadDiscoveryDeck`) | owner_visibility, gender, owner_social_open, require_visible_owner, verification_status, avatar_url | gender, require_visible_owner, verification_status | Aynı dönüşüm; kullanım `:259-294` değişmez |
| `core/api/profile.ts:468-471` (`updateOwnerDiscoveryFilters`) | avatar_url, owner_visibility | — (liste içinde) | Grant'la çalışmaya devam eder, ama `.eq("id")` yok → B4. `rpc("get_my_profile")` ya da ön kontrolü kaldır |
| `core/api/profile-completion.ts:20-24` | avatar_url, bio, interests | — (liste içinde) | Değişim gerekmez; tutarlılık için RPC'ye alınabilir (isteğe bağlı) |
| `stores/auth.ts:33` (`readAccountStatus`) | onboarded_at, region_slug | ikisi de | `.rpc("get_my_profile").select("onboarded_at,region_slug").maybeSingle()`; oturum açılışında çağrılır — burası kırılırsa uygulama girişte takılır, öncelikli |

Ek: `core/api/onboarding.ts:84-93` UPDATE `return=minimal` (`.select()` yok) → yalnız `id` SELECT'i gerekir, listede; kırmızı testte `ok` ile kilitli.

### `types/database.ts` etkisi

- `profiles.Row` (`types/database.ts:866-889`) değişmez — üretilmiş tipler kolon yetkisini ifade etmez; bu yüzden typecheck A17 sonrası kırık okumayı **yakalamaz** (hata yalnız çalışma anında `permission denied for table profiles`). Kilitleme vitest ile: 5 yerin `rpc("get_my_profile")` çağırdığını `vi.mock("./supabase.client")` kalıbıyla doğrulayan testler (app-test hattı, `discovery.ts`/`profile.ts` yüklenebilir — README).
- `Functions` altına `get_my_profile` (Args `never`, Returns `profiles` Row[], `SetofOptions`) eklenir. Üretim `gen:types` ile (L0, canlıya bağlanır) — migration canlıya uygulandıktan sonra sahip üretir. O zamana kadar `.rpc("get_my_profile")` tip hatası verir; geçici çözüm olarak elle ekleme yapılmaz (dosya üretilmiş).
- Bilgi: `types/database.ts` son değişim 2026-08-28; kuyruk `öneriler`'deki tip drift denetimi bu migration'dan sonra koşulmalı.

### `send-notification:403,434` — service role doğrulaması

- İstemci `supabase/functions/send-notification/index.ts:249` `SUPABASE_SERVICE_ROLE_KEY` ile `:258` `createClient(…, serviceRoleKey, { auth: … })` kuruyor; kullanıcının JWT'si yalnız `admin.auth.getUser(jwt)` doğrulamasında kullanılıyor (`:262`), istek başlığı olarak istemciye geçirilmiyor → sorgular `service_role` ile.
- `:401-407` okunanlar `owner_visibility, avatar_url, owner_social_open, verification_status, require_visible_owner, region_slug`; `:433-436` `id, owner_visibility, region_slug`. İkisinde de hassas kolon yok, ama listede olmayanlar var — `service_role` yetkisi revoke'tan etkilenmez: taslak yalnız `anon, authenticated`'dan alıyor; kırmızı koşuda `service_role profiles SELECT (tablo): t`.
- Sonuç: **etkilenmez.**

## Doğrulanamayanlar

- **Prod'da `anon`/`authenticated` grant durumu:** test ortamı bilgi satırı `anon … t / t`; prod'daki varsayılan yetkilerin aynı olduğu varsayıldı. Doğrulama (sahip, salt okuma, çalıştırılmadı): `select grantee, privilege_type from information_schema.role_table_grants where table_schema='public' and table_name='profiles' and grantee in ('anon','authenticated');`
- **Düzeltmenin yeşil koşusu:** migration taslağı yerel koşuda uygulanmadı (L1: migration yazımı yok). Sahip PR'ında beklenen: bu test + B3'teki 3 dosyanın güncellenmiş hâli ile 25/25.
- **B4 PostgREST davranışı** (`.single()` çok satırda `PGRST116`) kod okumasından; uygulama çalıştırılamadı (simülatör L0). Fonksiyonun çağıranı olmadığı için kullanıcı etkisi bugün yok.
- **Realtime:** `profiles` publication'da değil (`rg` boş); etki beklenmiyor.

## İyi olanlar

- Okuma yüzeylerinin tamamı SECURITY DEFINER RPC'de ve yaş/cinsiyet maskesi (`0068`) orada test edilmiş (`owner-age-gender-display.test.sql`) — düzeltme yalnız tablo yolunu kapatıyor, RPC'lere dokunmuyor.
- `_helpers.sql:139-169` kolon grant'larına saygı gösteriyor; düzeltme sonrası testler prod'u gerçekçi yansıtır.
- UPDATE tarafı zaten kolon bazında daraltılmış (`0012:16-27`, `0021:38`) — aynı desen SELECT'e uygulanıyor.

## İş önerileri (kuyruk `öneriler` için; dispatcher merkez'de ekler)

- **Sahip / L0:** A17 düzeltme PR'ı — migration taslağı + `profile-column-privacy.test.sql` (yumuşak assert'ler `tests.assert`'e) + 5 istemci yeri (`stores/auth.ts:33` öncelikli) + B3'teki 3 test + `gen:types`. Kabul: `test:db` 25/25, `npm test`/`typecheck` yeşil, onboarding → keşif → profil düzenle akışı elle denenmiş.
- **app-test (L2), A17 sonrası:** `core/api/profile.ts`/`discovery.ts` için kendi profil okumasının `rpc("get_my_profile")` olduğunu kilitleyen vitest (typecheck yakalamadığı için). Kabul: mock'lu testler `from("profiles").select` çağrısı olmadığını doğrular.
- **app-kucuk-is (2. faz):** B4 — `updateOwnerDiscoveryFilters` ölü kod/`.eq` eksik. Kabul: fonksiyon silinir ya da RPC ile tek satır okur + vitest.

## Sahip kararı

- Güvenli liste genişliği: önerilen 8 kolon mu, yoksa en dar 6 kolon (`id, owner_visibility, display_name, avatar_url, bio, city`; `interests` ve `owner_social_open` yalnız RPC'den) mı? Teste etkisi yalnız tam eşitlik dizisi.
