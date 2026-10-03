# petmatch — Kod Haritası

> **Sahibi:** tech-lead (`oc/orchestrator/roller/tech-lead.md` "Hafıza"). Her madde hazırlanırken öğrenilen buraya eklenir; keşif repo başına bir kez yapılır.
> **Okuyanlar:** engineer ve reviewer dokunacakları alanı burada kontrol eder; auditor "kabul edilmiş riskler"i tekrar raporlamaz.
> **İlk yazım:** 2026-10-04 (kurulum; kaynak: `oc/orchestrator/audit/2026-10-03-petmatch-kuyruk-onerisi.md` Adım 0 + kod denetimi §2). README'yi tekrarlamaz; kurallar için `docs/otonom/README.md`. 300 satırı geçerse böl.

## 1. Klasör → sorumluluk

| Yer | Sorumluluk | Not |
|---|---|---|
| `app/` (expo-router 6) | `(app)/` sekmeler (keşif `index.tsx` 982, `profile.tsx` 841), `(auth)/` (giriş + `legal.tsx`), `onboarding.tsx` 901, `chat/[conversationId].tsx` 903, `profile/owner.tsx` 1147, `profile/pet.tsx` 791, `pet/`, `adoption/`, `moderation/`, `legal-consent.tsx`, `waitlist.tsx` | UI testi yok; refactor 3. faz. `moderation/` ve `(auth)/legal.tsx` **L0** |
| `components/` | Keşif kartı, owner sheet/görünürlük önizleme, foto editör/karusel, rapor/güvenlik modalları, `chat/`, `ui/` | Test yok |
| `core/api/` (24 dosya, 2987 satır) | Supabase istemci katmanı: `profile` 651, `discovery` 434, `conversations` 392, `onboarding` 175, `notifications` 153, `safety`, `likes`, `meetups`, `adoption`, `legal`, `moderation`, … | **Test yok**; vitest'te yalnız `vi.mock` ile yüklenir (§2) |
| `core/domain/` | Saf mantık: `matching`, `chat-items`, `pet-age`, `owner-age-bucket`, `profile-completion`, `credentials`, `date-validation`, `error-message`, `auth-errors`, `pet-identity` (testli); `distance`, `age` (T02), `labels`, `types`, `legal` (**L0**) | Doğrudan import |
| `core/ui`, `core/i18n`, `core/media`, `core/calendar.ts`, `core/features.ts` | UI yardımcıları (2 test), locale (1 test), medya | |
| `stores/` | zustand: `auth.ts` (`:33` kendi profil satırını okur — A17), `discover-profile.ts` | |
| `supabase/migrations/` (72) | `0001`…`0066` + zaman damgalı (`20260827204345_owner_visibility_default_public`, `20260929120000_abuse_and_storage_hardening` …) | **L0**; canlıya yalnız sahip uygular (`db:push`) |
| `supabase/tests/` (24 `*.test.sql` + `_bootstrap.sql`, `_helpers.sql`) | RLS/RPC davranış testleri; `npm run test:db` | L1 döneminde yazma yok (README istisnası: `zz_otonom_*`) |
| `supabase/functions/` | `send-notification` (587), `delete-account`; Deno; CI `deno check` | **L0** (deploy), deno test yok |
| `scripts/` | `test-db.mjs` (serbest, `npm run test:db`), `seed-qa-pet-photos`, `reset-qa-discovery` (prod'da DELETE), `gen-supabase-types` (canlı `--project-id`) | **L0** (test-db hariç) |
| `types/database.ts` | Supabase üretilmiş tipler (2026-08-28) | **L0**; drift raporu önerilerde |
| `docs/` | `backlog.md` (ürün günlüğü, bayat başlık), `experience-roadmap.md`, `architecture.md`, `i18n.md`, `legal-release-checklist.md` (**L0**), `auth-release-checklist.md` (**L0**), `moderation-runbook.md`, … | |
| `.github/workflows/` | `ci.yml` (static · database · edge-functions), `supabase-keep-alive.yml` (prod isteği) | **L0** |
| `app.json`, `eas.json` | Expo/EAS yapılandırma | **L0** |

## 2. Yüklenebilirlik (vitest, 2026-10-03 denendi)

| Modül grubu | Yüklenir | Nasıl | Not |
|---|---|---|---|
| `core/domain/*` | ✓ | doğrudan | `legal.ts` L0 (okunur, test edilebilir ama sürüm sabiti değişmez) |
| `core/api/conversations.ts` | ✓ (mock'la) | `vi.mock("./supabase.client")`, `./observability`, `./notifications` | T01 |
| `core/api/profile.ts` | ✓ (mock'la) | + `vi.mock("./legal")` | owner_photos hata yutma önerisi |
| Diğer `core/api/*` | denenmedi | aynı dört mock ile dene; yüklenmezse `takıldı: kapsam eksik → tech-lead` | tech-lead madde hazırlarken dener |
| `core/api/supabase.client.ts`, `notifications.ts` | ✗ doğrudan | `react-native` parse hatası | Mock'lanır, test edilmez |
| `app/`, `components/`, `stores/` | ✗ | RN render altyapısı yok | Test edilmez (altyapı `package.json` ister → L0) |

## 3. Kritik sözleşmeler ve gizli bağlar

| Konu | Yer | Not |
|---|---|---|
| Profil kolon gizliliği (A17) | `profiles` SELECT kolon grant'ı yok (yalnız UPDATE: `0012:16-27`, `0021:38`); `0035:28-33` public satırı tüm kolonlarla açar | `birth_date`, `gender`, `last_active_at` okunur. `_helpers.sql:140-170` kolon grant'ına dokunmuyor → düzeltme sonrası test ortamı prod'u yansıtır. G01 |
| Görünürlük + rıza (A18) | `owner_visibility ∈ {public, after_match, hidden}`; varsayılan `public` (`20260827204345:10`); `onboarding.ts:67-70` rıza `true` sabit, `:91` ilk kayıtta `public`; `owner_visibility` istemciye UPDATE açık (`0012:22`); rıza kaydı `0025_legal_acceptances`, `0066_connection_signal_and_consent` | Sahip yönü + KVKK: G02. Görünürlük tüketicileri: `0042_likes_tab.sql:120-139`, `0023_conversation_owner_profile.sql:41-59`, `0007_location_privacy.sql:136-215` |
| Engelleme | `blocks_own` `for all` (`0006:230-232`); `can_access_conversation_realtime` (`0031:7-35`) yalnız katılımcılık | G03 |
| Mesaj insert | `conversations.ts:237-262` `sendMessage`; kolon grant'ı `20260929120000:60-61` (`id` dahil izinli, istemci göndermiyor) | T01; idempotency önerisi |
| Konum kabalaştırma | `core/domain/distance.ts:29` `coarsenCoordinates(…, 2)` ↔ `0007_location_privacy.sql:28,31` `round(…,2)` | T02; biri değişirse istemci/sunucu mesafe kovası ayrışır |
| Hata yutma | `profile.ts:216-219,374-377` `"owner_photos"` geçen her hata | `öneriler` (app-kucuk-is) |
| Bildirim | `send-notification` service role (`:403,434`), `.limit(500)` + `Promise.all` | A17 düzeltmesinden etkilenmez (G01 doğrular); alıcı sınırı önerisi |
| `test:db` | `scripts/test-db.mjs`: sabit container `petmatch_test_db`, `docker rm -f` önce/sonra; imaj `supabase/postgres:17.6.1.111` | Tek kilit (README) |
| Test glob | vitest varsayılan `**/*.test.ts` (config yok) | `node_modules` dışı her `.test.ts` koşar |

## 4. Kabul edilmiş / sahipte bekleyen riskler (auditor tekrar raporlamaz)

- A17, A18 (düzeltme sahipte, G01/G02 girdisi); A5 token rotate; A22 branch protection yok (`gh api …/protection` 404) — telafi otonom deny + hook.
- Canlı Supabase tek ortam (free tier, staging yok): `db:push`, `gen:types`, `seed:*`, `reset:*`, edge deploy, `supabase-keep-alive.yml` → hepsi L0.
- Kök checkout'ta `.env` ve `supabase/.temp/project-ref` var (gitignore); otonom worktree'lerde yok (README ön kontrolü).
- Kod denetimi §2 (10 bulgu): `oc/orchestrator/audit/2026-10-03-kod-denetimi.md`.
