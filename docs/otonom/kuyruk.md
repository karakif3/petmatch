# petmatch — Otonom Kuyruk

> Kurallar: `docs/otonom/README.md` · Durumlar: `hazırlandı | karar-bekliyor | hazır | yapılıyor | incelemede | düzeltmede | onay-bekliyor | bitti | takıldı`
> **Yalnız sahip `hazır` işaretler.** Dispatcher yalnız `hazır` ve `düzeltmede` maddeleri alır. Sıra = öncelik (sahip değiştirir). Hat önceliği: guvenlik-test → app-test → denetim.
> İlk hazırlık: 2026-10-03 (tech-lead kontrol listesi; `core/api` `vi.mock` ile yüklenebilirlik denendi, kapsamlar kodda doğrulandı). Kaynak: `oc/orchestrator/audit/2026-10-03-petmatch-kuyruk-onerisi.md` §5. **Sahip onayı 2026-10-04: G01, G02, G03, T01, T02, D01 `hazır`; ilk gün G01 + T01.**

## guvenlik-test (L1)

Ortak: çıktı `docs/otonom/raporlar/` altında rapor + `otonom/guvenlik-test/<id>-<kisa-ad>` branch'inde taslak PR (diff yalnız rapor + kuyruk satırı). Kırmızı koşu README "guvenlik-test kırmızı test koşusu" yoluyla; SQL taslağı commit edilmez, raporda kod bloğu. Kalıp: `tests.seed_user` + `act_as` + `set local role authenticated` (`supabase/tests/_helpers.sql`, örnek `owner-age-gender-display.test.sql`). Düzeltme sahipte (etkileşimli oturum); rapor onun girdisidir. Ön koşul: `pgrep -fl 'test-db[.]mjs'` boş.

- **G01 · guvenlik-test · A17 profil kolon gizliliği: kırmızı test + düzeltme planı** · durum: **düzeltmede** (sahip kararı 2026-10-04: `is` için Edit/Write deny kaldırıldı, koruma hook'ta; kırmızı koşu `is` mutlak yoluyla — README) · önceki: **takıldı: guard kırmızı koşu `cp` → `supabase/tests/zz_otonom_G01.test.sql` reddedildi (deny göreli yolu oturum dizini `merkez`'e göre çözüyor; `is`'e `cd` işe yaramıyor). Sahip: zz_otonom istisnasını `is` mutlak yoluna da tanıt ya da kırmızı koşuyu `is` oturumundan çalıştır.** Kod okuma analizi hazır, SQL taslağı yerelde (`/tmp/petmatch-otonom/G01.test.sql`, commit edilmedi); PR açılmadı, branch silindi (2026-10-04) (sahip onayı 2026-10-04; ilk gün)
  Kabul: `docs/otonom/raporlar/a17-profil-kolon-<tarih>.md`: (1) `profile-column-privacy.test.sql` taslağı: A, public B'nin `birth_date`/`gender`/`last_active_at`'ini okuyamaz (`has_column_privilege(...,'SELECT')` false + doğrudan select hata/boş); `display_name`/`bio`/`city`/`avatar_url` okunur; A kendi `birth_date`'ini RPC ile okur; RPC'ler (`discover_playdate_pets` yaş kovası) değişmez. (2) `test:db` çıktısı: yalnız yeni assert'ler FAIL, mevcut 24 dosya yeşil. (3) Güvenli kolon listesi gerekçesiyle; migration taslağı (`revoke select` + `grant select(<kolonlar>)` + `get_my_profile()` RPC, kod bloğu); istemcinin kendi satırını okuduğu 5 yerin değişimi: `core/api/profile.ts:153-156`, `core/api/discovery.ts:236-239`, `core/api/profile.ts:469-470`, `core/api/profile-completion.ts:21-22`, `stores/auth.ts:33`; `types/database.ts` etkisi; `send-notification:403,434` service role → etkilenmediğinin doğrulaması.
  Kapsam: okuma `supabase/migrations/0001*,0008*,0012*,0021*,0035*`, `supabase/tests/_helpers.sql` (`:140-170` kolon grant'ına dokunmuyor — gizli bağ), `owner-age-gender-display.test.sql`, `core/api/profile.ts`, `discovery.ts`, `profile-completion.ts`, `stores/auth.ts`, `supabase/functions/send-notification/index.ts:395-440` · yazma yalnız rapor
  Boy: M · Risk: yok (kod değişmez)

- **G02 · guvenlik-test · A18 rıza öncesi public: kırmızı test + KVKK uyumlu görünürlük planı** · durum: **hazır** (sahip onayı 2026-10-04)
  **Sahip ürün yönü (2026-10-04, bağlayıcı; rapor bunu merkeze alır, yeniden tartışmaz):** "Pet profili eşleşmeden önce görünür; insan profili varsayılan resimli görünür, ama kullanıcı resimsize ya da yalnız eşleşince'ye çekebilir."
  Kabul: `docs/otonom/raporlar/a18-riza-oncesi-public-<tarih>.md`:
  (1) **SQL taslağı + kırmızı çıktı:** `auth.users` insert → `handle_new_user` profili `public` değil (`after_match`); `public_profile_consent` kaydı olmayan kullanıcı `owner_visibility='public'` yapamaz (RPC ve doğrudan UPDATE — `owner_visibility` istemciye UPDATE açık, `0012:22`); rıza geri çekilince görünürlük `after_match`'e düşer (karar maddesi olarak işaretli). `test:db` çıktısında yalnız yeni assert'ler FAIL.
  (2) **KVKK uyumlu uygulama (kabul kriteri):** insan fotoğrafı/kişisel verisi rızadan ÖNCE public olmaz; **önceden işaretli kutu geçerli rıza değildir** (bugün `core/api/onboarding.ts:67-70` `publicProfileConsent: true` sabit, `:91` ilk kayıtta `public` yazıyor — bu iki yer açıkça bulgu). Önerilecek tasarım: onboarding'de zorunlu yasal kutudan **ayrı**, önceden seçili olmayan **açık seçim** — "resimli" / "resimsiz" / "yalnız eşleşince"; seçim yapılana kadar profil `after_match`; sunucuda "`public` ⇒ geçerli rıza kaydı" kontrolü (tetikleyici ya da RPC + UPDATE grant'ının kaldırılması — artı/eksi). Sahibin "varsayılan resimli" yönünün KVKK ile nasıl bağdaştığı: varsayılan = arayüzde **önerilen/ilk sıradaki** seçenek olabilir, işaretli gelemez; kullanıcı dokunmadan `public` yazılmaz.
  (3) **Üç seçeneğin mevcut enum'a eşlenmesi:** `owner_visibility` bugün `public | after_match | hidden`. "resimli" → `public`; "yalnız eşleşince" → `after_match`; "resimsiz" için seçenekler (`hidden` mı — pet görünür, insan gizli; yoksa yeni bir mod mu — ad/bio public, `avatar_url` ve owner fotoğrafları gizli) ve her birinin keşif/beğeni RPC'lerine etkisi (`0042_likes_tab.sql:120-139`, `0023_conversation_owner_profile.sql:41-59`, `0007_location_privacy.sql:172-177`). Yeni mod gerekiyorsa **sahip kararı** olarak işaretle.
  (4) Pet profilinin eşleşme öncesi görünürlüğünün bugün bu yönle uyumlu olduğunun doğrulaması (dosya:satır).
  (5) Mevcut `public` + rızasız satırlar için sayım sorgusu taslağı (**çalıştırılmaz**, canlıya bağlanılmaz) ve geçiş seçenekleri (ör. `after_match`'e indirip bir sonraki açılışta seçim sormak).
  (6) İstemci etki listesi: `core/api/onboarding.ts:67-70,91`, `app/onboarding.tsx:~859`, `core/api/profile.ts:395-398,616-619`, `app/profile/owner.tsx` görünürlük seçici; `core/domain/legal.ts` sürümü **değişmeden** (değişirse herkesten yeniden onay — L0, ayrı karar).
  Kapsam: okuma `supabase/migrations/0001*` (`:28`), `0018*`, `0025_legal_acceptances.sql`, `0066_connection_signal_and_consent.sql`, `20260827204345_owner_visibility_default_public.sql`, `0012*`, `core/api/onboarding.ts`, `core/api/legal.ts`, `core/api/profile.ts`, `app/onboarding.tsx`, `app/profile/owner.tsx` · yazma yalnız rapor
  Boy: M · Risk: yok · **Ürün kararı sahipte;** rapor seçenek + öneri sunar, karar vermez.

- **G03 · guvenlik-test · engelleme sonrası erişim: `blocks` UPDATE/DELETE + realtime kanal** · durum: **hazır** (sahip onayı 2026-10-04)
  Kabul: `docs/otonom/raporlar/engel-sonrasi-erisim-<tarih>.md`: SQL taslağı + kırmızı çıktı: engelleyen `update blocks set blocked_id=…` yapamaz (bugün yapar: `0006:230-232` `for all`); engellenen taraf `can_access_conversation_realtime('conversation:<id>:ephemeral')` false (bugün true: `0031:28-33`); DELETE (sessiz engel kaldırma) istemcide yolu yok (`core/api/safety.ts` yalnız `block_user` RPC) → kapatılmalı mı karar notu. Düzeltme taslağı: policy'yi select/insert'e böl; fonksiyona aktif eşleşme + `blocked_user_ids()`.
  Kapsam: okuma `supabase/migrations/0003*` (`:153`), `0005*` (`:118`), `0006*` (`:225-250`), `0020*` (`:11`), `0031*`, `supabase/tests/safety.test.sql`, `core/api/safety.ts` · yazma yalnız rapor
  Boy: S-M · Risk: yok

## app-test (L2)

- **T01 · app-test · `core/api` test iskeleti + `conversations` sözleşmesi** · durum: **hazır** (sahip onayı 2026-10-04; ilk gün)
  Kabul: `core/api/conversations.test.ts` (yeni) yeşil, toplam test > 93. `vi.mock("./supabase.client")`, `vi.mock("./observability")`, `vi.mock("./notifications")` (+ gerekirse `./legal`) — 2026-10-03 denendi. Kilitler: `sendMessage` boş/boşluk gövde → "Mesaj boş olamaz." ve insert çağrılmaz; insert yükü **yalnız** `conversation_id`, `sender_id`, `body` (trim'li); hata → fırlatır, bildirim/analytics çağrılmaz; başarı → `requestNotificationDelivery({type:"message"})` bir kez. Mock kalıbı dosya başında yorumla belgelenir.
  Gizli bağ: `supabase/migrations/20260929120000_abuse_and_storage_hardening.sql:60-61` kolon grant'ı — insert'e `created_at`/`read_at` eklenirse prod'da reddedilir; test bunu yorumla anar. İstemci `id` göndermiyor (`conversations.ts:245-251`; idempotency önerisi `öneriler`'de) — mevcut davranış kilitlenir.
  Kapsam: okunur `core/api/conversations.ts` (392), `core/api/notifications.ts`, `core/api/observability.ts` · yazılır yalnız `core/api/conversations.test.ts` · bağlam `app/chat/[conversationId].tsx`
  Test kalıbı: `core/domain/*.test.ts` (vitest) + README `vi.mock` · Yüklenebilirlik: ✓ (mock'la, 2026-10-03)
  Veri: yok · Arayüz: hayır · Boy: S · Risk: düşük (yalnız test)

- **T02 · app-test · konum ve yaş saf modülleri** · durum: **hazır** (sahip onayı 2026-10-04)
  Kabul: `core/domain/distance.test.ts`, `core/domain/age.test.ts` (yeni) yeşil. Kilitler: `coarsenCoordinates` 2 basamak varsayılanı sunucu yuvarlamasıyla aynı (`supabase/migrations/0007_location_privacy.sql:28,31` `round(…,2)`) — gizli bağ yorumla; `distanceKm` simetrik, aynı nokta 0, bilinen iki İstanbul noktası ±0.1 km; `distanceBucket` sınırları (null, 0.99, 1, 3, 25, 25.01); `ageInYears`/`formatAge` doğum günü öncesi/sonrası, null, gelecekteki tarih (`now` parametresi sabit).
  Kapsam: okunur `core/domain/distance.ts` (55), `core/domain/age.ts` (25) · yazılır iki `.test.ts` · bağlam `core/api/discovery.ts`, `app/pet/[petId].tsx`, `components/discovery-card.tsx`
  Test kalıbı: `core/domain/pet-age.test.ts` · Yüklenebilirlik: ✓ (saf)
  Veri: yok · Arayüz: hayır · Boy: S · Risk: düşük

## denetim (L1)

- **D01 · denetim · backlog → kuyruk ayrıştırma** · durum: **hazır** (sahip onayı 2026-10-04)
  Kabul: `docs/otonom/raporlar/backlog-ayristirma-<tarih>.md`: `docs/backlog.md` (başlık 08-08; `main`'de 748 satır, PR #5 dalında 756) ve `docs/experience-roadmap.md`'deki her `[ ]` / açık P0-P1 maddesi için açık / kapanmış / bilinmiyor + dosya:satır kanıtı; "Güncel durum" bölümünün bayatlığı; kod denetimi §2'deki 10 bulgunun bugünkü durumu (`oc/orchestrator/audit/2026-10-03-petmatch-kuyruk-onerisi.md` §1 doğrulamaları başlangıç); sonda hat + kabul kriterli aday listesi ve "sahip kararı" listesi. Kanıtsız madde önerilmez.
  **Girdi notu:** girdi `origin/main`'deki backlog. PR #5 (`docs/deploy-status-2026-10-03`, backlog güncellemesi) merge edilmeden alınırsa raporun başına "PR #5 merge edilmemiş; 2026-10-03 deploy durumu eksik olabilir" notu düşülür (PR #5 diff'i `gh pr diff 5` ile okunabilir, yazılmaz).
  Kapsam: okuma `docs/*.md`, ilgili `core/`, `app/`, `supabase/` · yazma yalnız rapor + bu madde
  Yöntem: `rg`, `git log`; simülatör/metro yok (L0). Görsel doğrulama gerekenler "bilinmiyor (ekran gerekir)".
  Boy: M · Risk: yok

## sahip (döngü almaz; kurulumu bekletmez)

- **A5** · `SUPABASE_ACCESS_TOKEN` rotate + kökteki `.env`'den çıkar.
- **A22** · GitHub branch protection (`main`, public repo): PR zorunlu + `static` / `database` / `edge-functions` zorunlu kontrol.
- **PR #5** merge (D01 girdisi).
- 0-önde eski dalları sil: `feat/onboarding-simplification`, `hardening/audit-fixes`, `ops/supabase-keep-alive`, `cursor/discover-geography-48d4`, `schema/goal-model-and-hardening` (yerel + uzak).
- **A17 / A18** düzeltmesi (etkileşimli oturum; G01/G02 raporları + kırmızı testler aynı PR'da yeşile).

## öneriler (tech-lead Pazartesi hazırlar; dispatcher almaz)

- `app-kucuk-is` (2. faz): `core/api/profile.ts:216-219,374-377` — `"owner_photos"` geçen her hata yutuluyor; önce kırmızı test.
- `app-kucuk-is` (2. faz): mesaj gönderiminde istemci `id` (idempotency) — `core/api/conversations.ts:245-251`; grant izin veriyor (`20260929120000:61`).
- `app-kucuk-is` (2. faz): `saveOwnerProfile` rıza sırası — `core/api/profile.ts:395`, `:616` (G02 ile birlikte).
- `denetim`: `types/database.ts` (08-28) ↔ migration'lar tip drift raporu (çevrimdışı karşılaştırma; `gen:types` L0).
- `edge-test` (2. faz): `send-notification` `.limit(500)` + `Promise.all` alıcı sınırı (backlog:384).
- **Sahip / L0:** A17/A18 düzeltmesi, `repos.yaml` kuyruk yolu (`docs/otonom/kuyruk.md`) ve SQL test sayısı (24) düzeltmesi (OC tarafı).
