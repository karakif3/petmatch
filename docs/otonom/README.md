---
oc-anayasa: v1.2
---

# petmatch — Otonom Çalışma Kuralları

> **Canonical genel kurallar OC'de:** `~/Desktop/cursor_claude/oc/orchestrator/ANAYASA.md` (v1.2) · roller: `oc/orchestrator/roller/` · [GitHub: karakif3/oc](https://github.com/karakif3/oc) (branch `orchestrator/iskelet`).
> Bu dosya onları **kopyalamaz**. Yalnız petmatch'e özel ek kuralları taşır. Çelişkide daha sıkı olan geçerlidir.
> **Durum:** kurulum 2026-10-04 (sahip onayı 2026-10-04). İlk döngü 2026-10-04 / 2026-10-05 11:30 (zamanlanmış görevi sahip kurar). Kurulum önerisi ve gerekçeler: `oc/orchestrator/audit/2026-10-03-petmatch-kuyruk-onerisi.md`; kod denetimi: `oc/orchestrator/audit/2026-10-03-kod-denetimi.md` §2.

## Dosyalar

| Dosya | Ne | Kim yazar |
|---|---|---|
| `kod-haritasi.md` | Klasör → sorumluluk, yüklenebilirlik, kritik sözleşmeler, kabul edilmiş riskler | tech-lead |
| `kuyruk.md` | Tüm hatların tek kuyruğu | tech-lead (madde hazırlar), sahip (`hazır` işaretler), dispatcher (durum) |
| `hatlar/<hat>.md` | Hat profilleri | kurulum; değişiklik sahip onayıyla |
| `gunluk/YYYY-MM-DD.md` | Günlük rapor (OC okur, format `roller/dispatcher.md`'de sabit) | dispatcher |
| `raporlar/` | Güvenlik/denetim raporları, haftalık tech-lead raporu | auditor, tech-lead |

## Hatlar ve öncelik

| Öncelik | Hat | Seviye | Durum | Rol |
|---|---|---|---|---|
| 1 | [guvenlik-test](hatlar/guvenlik-test.md) | L1 | **açık** | auditor (güvenlik denetimi + yerel `test:db` kırmızı koşusu) |
| 2 | [app-test](hatlar/app-test.md) | L2 | **açık** (Tellora/teacher-mvp emsali istisna, sahip onayı 2026-10-04) | engineer → reviewer |
| 3 | [denetim](hatlar/denetim.md) | L1 | **açık** | auditor |
| — | app-kucuk-is, edge-test, i18n | L2 | 2. faz, profil yok (L1'den başlar, sahip açar) | — |
| — | sql-taslak (migration taslağı + test) | L3 | 2. faz, A17/A18 sahipte kapandıktan sonra | — |
| — | ui-refactor | L2 | 3. faz (simülatör + canlı QA hesabı gerekir) | — |
| — | Kalıcı L0 (aşağıda) | **L0** | kalıcı | sahip |

Repo tavanı `repos.yaml`'da **L3**. **Seviye artışı (sahip):** A17 + A18 sahip tarafından kapanınca guvenlik-test → L2 (yeşil SQL test PR'ı; `supabase/tests/*.test.sql` yazımı açılır). app-test'te 3 PR değiştirilmeden merge → app-kucuk-is L1'den açılabilir.

**Günlük sınır:** ilk hafta **2 iş** (guvenlik-test ≤ 1, app-test ≤ 1, denetim ≤ 1). 1 hafta sorunsuz → 3 (sahip). Gerçek sınır = min(bu, OC dağıtım dosyası). OC portföy toplamı 8 (petmatch 2). **İlk gün (sahip): G01 + T01.**

**Tetikleme:** her gün **11:30 / 14:30 / 17:30** (Tellora 09:30/12:30/15:30, teacher-mvp 10:30/13:30/16:30 ile çakışmaz). Zamanlanmış görev bu worktree'de (`merkez`) koşar; prompt kaynağı `oc/orchestrator/prompts/gorev-petmatch.md`.

**OC dağıtımı (kanonik: `oc/orchestrator/roller/dispatcher.md` girdi 4):**
- Dağıtım dosyası: `~/Desktop/cursor_claude/_otonom/oc/merkez/orchestrator/dagitim/YYYY-MM-DD.md` (yalnız bugünün tarihi).
- Sahip onayı: `~/.local/state/oc-orchestrator/onaylar/YYYY-MM-DD.md` içinde `dagitim:YYYY-MM-DD:ok` satırı. Dağıtım dosyası var ama onay yoksa → **yalnız L1** (guvenlik-test, denetim).
- `karar: <id> ok` → ilgili `takıldı` maddesi `düzeltmede`; `karar: <id> hayır` → `bitti: sahip reddetti`.

**Geçici kural (sahip onayı 2026-10-04):** dağıtım dosyası **hiç yoksa** `guvenlik-test` + `app-test` + `denetim` çalışır, günlük sınır **2**. Dosya varsa bu kural uygulanmaz.

## Her tetiklemenin ön kontrolleri (dispatcher, iş seçmeden önce)

**Glob ve Grep araçlarına güvenme:** zamanlanmış oturumda Glob aracı yok (teacher-mvp deneme koşusu 2026-10-03). Dosya bulma/arama her rolde Bash ile: `rg -n`, `rg --files`, `find`. Bu bölümdeki kontroller **yalnız** aşağıdaki sabit komutlarla yapılır.

1. **Disk:** `df -g ~` → boş alan **< 15 GB** ise günlüğe `takıldı: disk (<n> GB boş)` yaz ve dur.
2. **Sır kontrolü (iki sabit komut, aynen):** yalnız dosya adı listeler, içerik okumaz.
   - `find ~/Desktop/cursor_claude/_otonom/petmatch/merkez ~/Desktop/cursor_claude/_otonom/petmatch/is -maxdepth 1 -name '.e*' ! -name '*example*'`
   - `find ~/Desktop/cursor_claude/_otonom/petmatch/merkez ~/Desktop/cursor_claude/_otonom/petmatch/is -maxdepth 3 -path '*supabase/.temp*'`
   İkisinden biri boş değilse (`.env`, `.env.local`, `supabase/.temp/project-ref` …) günlüğe `takıldı: sır (<ad>)` yaz ve dur. Dosyayı okuma, silme, taşıma — sahip kaldırır. (Bu worktree'lerde `.env` ve `supabase/.temp/` olmaması = Supabase CLI'ın proje ref'siz kalması; canlıya ulaşamamanın asıl güvencesi budur. `.env.example` serbest ama okunmaz.)
3. **`test:db` kilidi (guvenlik-test maddesi seçilecekse):** `pgrep -fl 'test-db[.]mjs'` (köşeli parantez, komutun kendi kabuğunu eşleştirmemesi için) → çıktı boş değilse (sahip ya da başka oturum `npm run test:db` koşuyor) guvenlik-test bu tetiklemede atlanır, sıradaki hatta geçilir. Sebep: script sabit `petmatch_test_db` container'ını önce/sonra `docker rm -f` ile siler; iki koşu birbirini bozar. `docker ps` kullanılmaz (docker deny'de).

**Guard aşma yasağı (tüm roller):** guard/deny tarafından engellenen komut yeniden ifade edilerek geçirilmez. Dosya içeriği (kuyruk, günlük, rapor, test) Bash heredoc/echo ile değil **Edit/Write aracıyla** yazılır. Gerçek bir yasaksa `takıldı: guard <ne>` yazılır. Hook ve `settings.local.json` değiştirilmez.

## Döngünün evi ve worktree'ler

- **merkez:** `~/Desktop/cursor_claude/_otonom/petmatch/merkez/`, branch `otonom/merkez` (upstream `origin/otonom/merkez`; `main`'i izlemez). Dispatcher kuyruk ve günlük değişikliklerini **yalnız** buraya commit + push eder (`git push origin otonom/merkez`).
- **is (tek iş worktree'si, ANAYASA §7):** `~/Desktop/cursor_claude/_otonom/petmatch/is/` yeniden kullanılır: `git fetch origin && git switch -c otonom/<hat>/<id>-<kisa-ad> origin/main` (branch `--no-track` ise de olur; push her zaman `-u origin otonom/...`). İş bitince temiz bırakılır (`git status` boş; geçici SQL dosyası silinmiş). Yeni worktree açılmaz.
- `node_modules` kurulumda iki worktree'de de `npm ci` ile kuruldu (2026-10-04). Eksikse işçi `is`'te bir kez `npm ci` koşar (`npm install`/`npm i` yasak). `npm ci` ağ ister; ağ yoksa `takıldı: npm ci`.
- Ana branch **`main`**. Branch koruması yok (A22 sahipte) → main'e push = doğrudan prod kod tabanı; asla.

## Doğrulayıcı

```bash
npm run lint && npm run typecheck && npm test          # ağsız; vitest
npm run test:db                                        # yalnız guvenlik-test; yerel Docker (colima), prod'a bağlanmaz
```

- `npm test` = `vitest run` (config yok, varsayılan include `**/*.test.ts`). 2026-10-04 merkez'de: **13 dosya / 93 test** yeşil.
- `npm run test:db` = `scripts/test-db.mjs`: sabit `supabase/postgres:17.6.1.111` imajıyla geçici `petmatch_test_db` container'ı açar, 72 migration'ı sıfırdan uygular, `supabase/tests/*.test.sql` (24 dosya) koşar, container'ı siler. İmaj yerelde yoksa Docker Hub/ECR'den çeker (ağ) — çekilemezse `takıldı: test:db imaj`. Docker çalışmıyorsa `takıldı: docker` (colima'yı başlatmak sahipte).
- CI (`.github/workflows/ci.yml`, her PR): `static` (lint · typecheck · test) · `database` (`test:db`) · `edge-functions` (`deno check`). Kanıt: komut + son satır (`Tests  N passed`, `Tüm veritabanı testleri geçti (24 dosya)` ya da `n/N test dosyası düştü`).

## Test kalıbı ve yüklenebilirlik (engineer ve reviewer için bağlayıcı)

- Yer: kaynağın yanında `<modül>.test.ts` (ör. `core/domain/matching.test.ts`). `import { describe, it, expect, vi } from "vitest"`.
- `core/domain/*` saf → doğrudan import.
- **`core/api/*` doğrudan yüklenmez** (`supabase.client.ts`, `notifications.ts` → `react-native` parse hatası). **`vi.mock` ile yüklenir (2026-10-03 denendi):** `vi.mock("./supabase.client", …)`, `vi.mock("./observability", …)`, `vi.mock("./legal", …)`, `vi.mock("./notifications", …)` → `conversations.ts`, `profile.ts` import edilir. Mock kalıbı test dosyasının başında yorumla belgelenir. Başka bir `core/api` modülü bu dört mock'la yüklenmiyorsa zorlama: `takıldı: kapsam eksik → tech-lead`.
- `app/`, `components/`, `stores/` test edilmez (RN render altyapısı yok; `package.json` değişikliği gerekir → L0).
- vitest config dosyası eklenmez; `package.json` değişmez.

## guvenlik-test kırmızı test koşusu (tek izinli yol)

L1 döneminde SQL testi **commit edilmez**; rapor içinde kod bloğu olarak durur. Kırmızı çıktıyı kanıtlamak için tek izinli yol (`supabase/tests/**` Edit/Write deny'de):
1. Taslağı Write ile `/tmp/petmatch-otonom/<id>.test.sql`'e yaz.
2. `is`'te tek komut: `cp /tmp/petmatch-otonom/<id>.test.sql supabase/tests/zz_otonom_<id>.test.sql && npm run test:db; rm -f supabase/tests/zz_otonom_<id>.test.sql`
3. `git status` boş olmalı. Çıktının ilgili satırları (FAIL/ERROR ve özet satırı) rapora girer.

Hook `supabase/(migrations|functions|tests)/` içine Bash ile yazmayı (`cp`, `mv`, `tee`, `>`, `sed -i`, `rm` …) engeller; tek istisna `supabase/tests/zz_otonom_*` adıdır. `_helpers.sql`, `_bootstrap.sql` ve mevcut test dosyaları asla değişmez.

## L0 yollar (ajan dokunmaz; okuyabilir, çalıştıramaz)

- **Komutlar (deny + hook):** `supabase` her biçimde (`npx supabase`, `node_modules/.bin/supabase`; `db push`, `link`, `login`, `functions deploy`, `migration repair`, `start`, `gen types` …) · `npm run db:*|local:*|gen:types|seed:*|reset:*` · `node scripts/*` (yalnız `npm run test:db` serbest) · `npm start`, `npm run start|web|ios|android`, `expo`/`npx expo` · `eas` her biçim · `xcodebuild`, `pod` · `deno deploy`/`deployctl` · `docker`/`colima` (yalnız `npm run test:db` üzerinden) · `gh workflow run` (`supabase-keep-alive.yml` = prod isteği), `gh secret`, `gh api -X PUT` · `npm install`/`npm i`/`npm add` (yalnız `npm ci`) · canlı adresler (`supabase.co`, `api.supabase.com`, `expo.dev`) · `.env` geçen her komut. `.claude/launch.json` (metro/web → canlı Supabase) ve `preview_start` yasak; iOS simülatör `launch`/`text` yasak (canlı QA hesabı).
- **Şema / backend:** `supabase/migrations/**` (yeni migration da), `supabase/functions/**`, `supabase/tests/**` (L1 döneminde; istisna yukarıda), `types/database.ts` (yalnız `gen:types` üretir — canlıya bağlanır).
- **Yayın / yapılandırma:** `app.json`, `eas.json`, `package.json`, `package-lock.json`, `.github/workflows/**`, `scripts/**`, `.claude/**`, `.env*`, `supabase/.temp/**`, `~/.supabase/**`, `.expo/**`, `ios/**`.
- **Hukuk / moderasyon:** `app/(auth)/legal.tsx`, `core/domain/legal.ts` (sürüm değişimi = herkesten yeniden onay), `core/api/legal.ts`, `docs/legal-release-checklist.md`, `docs/auth-release-checklist.md`, `app/moderation/**`.
- **Ürün kararları (kuyruğa alınmaz, sahipte):** A17/A18 düzeltmesi, ödeme duvarı, tanışma amacı, petsiz kullanıcı, yayın günü işleri (Confirm email, test hesapları), git geçmişi temizliği.

**Public repo yazım kuralı:** repo PUBLIC. PR açıklaması, PR yorumu, rapor ve günlükte Supabase proje ref'i, URL'si, QA hesap e-postası/şifresi, kişisel e-posta, token **yazılmaz**. Gerekirse `<proje-ref>` / `<qa-hesabı>` yer tutucusu.

**Migration adlandırma (rapor taslakları için):** `YYYYMMDDHHMMSS_<ad>.sql`; her güvenlik migration'ının yanında `supabase/tests/<ad>.test.sql`. Taslaklar yalnız rapor içinde kod bloğu.

## Paralel oturumlar

`git worktree list` ile 2026-10-04'te doğrulandı; tech-lead her Pazartesi tazeler:

| Worktree | Branch | Sahibi |
|---|---|---|
| `~/Desktop/cursor_claude/petmatch` | `docs/deploy-status-2026-10-03` (PR #5) ya da sahibin seçtiği | sahip (etkileşimli; **dokunma**, branch değiştirme; kökte izlenmeyen `.claude/`, `.env`, `supabase/.temp/` orada) |
| `~/Desktop/cursor_claude/_otonom/petmatch/merkez` | `otonom/merkez` | otonom döngü (dispatcher) |
| `~/Desktop/cursor_claude/_otonom/petmatch/is` | `otonom/<hat>/<id>` (değişir; kurulumda detached `origin/main`) | otonom iş worktree'si (auditor/engineer) |

Eski dallar (`feat/onboarding-simplification`, `hardening/audit-fixes`, `ops/supabase-keep-alive`, `cursor/discover-geography-48d4`, `schema/goal-model-and-hardening`, `docs/deploy-status-2026-10-03`) **dokunulmaz, silinmez** (sahip siler). Otonom branch yalnız `otonom/<hat>/<id>-<kisa-ad>`, `origin/main`'den. Sahip A17/A18'i kendi etkileşimli oturumunda düzeltir; o dallara ve `supabase/` altına otonom yazım yok.

## Kuyruk kaynağı (tech-lead)

- `docs/backlog.md` — ürün günlüğü (`main`'de 748 satır, PR #5 dalında 756); başlık "Güncel durum 2026-08-08" bayat; gerçek açıklar 2026-09-30 bölümü (~satır 370-402) + "Kararı bekleyenler" + P0/P1. **D01 raporu çıkana kadar her maddeyi kodda doğrula.** PR #5 merge edilmediyse `main`'deki backlog bir günlük eksik olabilir — raporda not düş.
- `docs/experience-roadmap.md` açık maddeleri.
- Kod denetimi §2 (10 bulgu) ve `oc/orchestrator/yapilacaklar.md` A5/A17/A18/A22.
- Ürün kararı gerektirenler kuyruğa alınmaz; `öneriler`'e "Sahip / L0".

## Sahip işleri (kurulumu bekletmez; döngü yapmaz)

- **A5:** `SUPABASE_ACCESS_TOKEN` rotate + kökteki `.env`'den çıkar.
- **A22:** GitHub branch protection (`main`, public repo): PR zorunlu + `static` / `database` / `edge-functions` zorunlu kontrol.
- **PR #5** (`docs/deploy-status-2026-10-03`) merge — D01'in girdisi `main`'deki backlog.
- 0-önde eski dalların silinmesi (yukarıdaki liste).
- **A17 / A18** düzeltmesi (etkileşimli oturum; G01/G02 raporları girdi). A18 ürün yönü: kuyruk G02.

## Reviewer için petmatch kontrol listesi

CI'ın yakaladıklarını (lint, typecheck, test, test:db, deno check) tekrar yazma. CI'ın kaçırdıkları:
- app-test PR'ında diff yalnız yeni `*.test.ts` mi? `core/`, `app/`, `supabase/`, `package.json` altında başka değişiklik varsa merge-güvenli değil.
- `vi.mock` kalıbı: mock'lar dosya başında, yorumlu; gerçek `supabase.client` ya da ağ çağrısı yok; `vi.restoreAllMocks`/`vi.resetAllMocks` her testte.
- Test mevcut davranışı mı kilitliyor yoksa "olması gereken"i mi? (Kırmızı test kuralı, `hatlar/app-test.md`.)
- Gizli bağ testte yorumla belirtilmiş mi (ör. T01 insert kolon listesi ↔ `20260929120000:60-61` kolon grant'ı)?
- L1 PR'larında (guvenlik-test, denetim) diff yalnız `docs/otonom/raporlar/` + kuyruk satırı mı; rapor public-repo yazım kuralına uyuyor mu (proje ref'i, e-posta, token yok)?
- Kullanıcıya görünen metinler Türkçe; test beklentisi metni birebir kopyalıyorsa kabul (sözleşme budur).
