# Hat: guvenlik-test

| Alan | Değer |
|---|---|
| **Durum** | açık |
| **Seviye** | L1 (yalnız rapor) — önerilen L2'nin bir altı. A17 + A18 sahipte kapanınca L2 (yeşil SQL test PR'ı) sahip onayıyla |
| **Rol (zorunlu)** | **auditor** (güvenlik denetim türü; doğrulayıcısı yerel `test:db` kırmızı koşusu). qa rolü bu hatta kullanılmaz (simülatör/kanıt modu yok) |
| **Amaç** | RLS/grant/RPC açıklarını (A17 kolon gizliliği, A18 rıza öncesi public, engelleme sonrası erişim) **kırmızı SQL testi + düzeltme planı** olarak kanıtlamak. Düzeltmeyi sahip kendi oturumunda yapar; rapor onun girdisidir |
| **Kapsam** | Okuma: `supabase/migrations/**`, `supabase/tests/**`, `supabase/functions/**`, `core/**`, `app/**`, `stores/**`, `types/database.ts`, `docs/**`. Yazma: yalnız merkez'de `docs/otonom/raporlar/<ID>-<kisa-ad>-<tarih>.md`, kuyruk maddesinin durumu + `öneriler`, geçici `/tmp/petmatch-otonom/<id>.test.sql` ve `is`'te geçici `supabase/tests/zz_otonom_<id>.test.sql` (README "kırmızı test koşusu"; koşudan hemen sonra silinir, commit edilmez) |
| **Asla** | README L0 yollar; migration/fonksiyon/test dosyası commit'lemek; `_helpers.sql`, `_bootstrap.sql` ve mevcut `*.test.sql`'e dokunmak; `supabase` CLI (her biçim), `docker` doğrudan, `npm run db:*|local:*|gen:types|seed:*|reset:*`; canlı Supabase'e bağlanmak (sayım sorguları yalnız taslak); rapora proje ref'i/URL/e-posta/token yazmak (public repo) |
| **Doğrulayıcı** | `npm run test:db` çıktısı: mevcut 24 dosya yeşil, **yalnız yeni assert'ler FAIL** (kırmızı kanıt). Rapor `oc/orchestrator/roller/auditor.md` formatında; her bulgu dosya:satır; kabul kriterindeki her başlık karşılanmış; `git status` (is) boş |
| **Çıktı** | Yalnız rapor, doğrudan merkez'e (PR'sız; README "L1 raporları"); sonunda `## Sahip kararları`. Geçici SQL ve kırmızı koşu `is`'te (detached `origin/main`); `is`'ten commit/push yok |
| **Onay kapısı** | Rapor okunması + ürün kararı (G02) — sahip |
| **Bütçe** | günde en fazla 1 iş; ücretli işlem 0. `test:db` koşusu iş başına en fazla 3 (ilk + 2 deneme) |
| **Çakışma alanı** | **`test:db` tek kilit:** container adı sabit `petmatch_test_db`, script önce/sonra `docker rm -f` yapar. `pgrep -fl 'test-db[.]mjs'` boş değilse bu hat o tetiklemede atlanır. Sahibin A17/A18 dalı (`supabase/` altı) — okunur, dokunulmaz |
| **Arayüz** | yok |

**Kırmızı test kuralı:** Test "olması gereken"i tanımlar (açık burada kanıtlanır) — bu hatta mevcut davranış kilitlenmez; çünkü test commit edilmez, raporda düzeltme PR'ının parçası olarak durur. Kırmızı koşuda **mevcut** bir test dosyası düşüyorsa (yeni assert'ler dışında) bu bulgudur: koşuyu `takıldı: test:db mevcut test kırmızı` olarak raporla, düzeltmeye çalışma.

**Ortam takılmaları:** Docker çalışmıyor → `takıldı: docker` (colima'yı başlatmak sahipte). İmaj çekilemiyor → `takıldı: test:db imaj`. İkisinde de rapor yine yazılabilir ama kabul kriteri (2) eksik kalır → `takıldı`, `bitti` değil.

**Zaten raporlanmış:** `oc/orchestrator/audit/2026-10-03-petmatch-kuyruk-onerisi.md` §1 (A17/A18/engelleme doğrulamaları), `oc/orchestrator/audit/2026-10-03-kod-denetimi.md` §2 — başlangıç noktası; tekrar keşfetme, link ver.
