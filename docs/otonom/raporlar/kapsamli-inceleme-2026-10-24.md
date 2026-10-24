Taban: `a3e5769` (origin/main, 2026-10-18) · Dal: `claude/sleepy-edison-fxu489`

# Kapsamlı inceleme — 2026-10-24

Kapsam: `main` üzerindeki kod + migration'lar + edge function'lar; önceki
incelemeler (`a17-profil-kolon-2026-10-04`, `otonom/merkez`'deki D01/D03/D04,
PR #7 G02, PR #9 G03, PR #18 yayın öncesi değer incelemesi). Yöntem: salt
okuma, `rg`, `git log`, GitHub Actions geçmişi; `npm ci && typecheck && lint &&
test` yerelde koşuldu (**21 dosya / 217 test yeşil**, lint ve typecheck temiz).
Canlıya bağlanılmadı; `test:db` koşulmadı (Docker yok).

## Özet

- Önceki incelemelerdeki 10 kod denetimi bulgusu **hâlâ 10/10 açık**
  (`main`'deki son migration `20261010120000_ops_keep_alive`; G01/G02/G03
  raporlarının düzeltme taslakları merge edilmedi, PR #7 ve #9 taslak).
- Bu turda **6 yeni bulgu** çıktı; ikisi önceki hepsinden daha acil:
  - **Y1** — herkese açık repoda moderatör/admin test hesabının e-postası
    **ve şifresi** yazılı; `Confirm email` kapalıyken bu hesapla herkes
    moderasyon paneline girer.
  - **Y2** — e-posta doğrulama ve şifre sıfırlama deep link'i mobilde
    büyük olasılıkla **hiç çalışmıyor** (implicit flow → fragment; expo-router
    fragment'ı ayrı parametre olarak vermiyor).
- Önceki 14 "planda olmayan" madde (PR #18) doğru; bu rapor onları
  tekrarlamıyor, yalnız öncelik sırasına yerleştiriyor.
- Her iş için önerilen model (Fable 5.1 / Opus 5.5 / Sonnet 5.5) §4'te.

## 1. Yeni bulgular (önem sırasıyla)

| # | Önem | Bulgu | Kanıt | Senaryo | Düzeltme |
|---|---|---|---|---|---|
| Y1 | **Kritik** | Public repoda QA hesaplarının tam listesi, admin/moderatör olan `test1@petmatch.app` ve ortak şifre `Petmatch2026!` açık yazılı. Hesaplar canlıda duruyor (backlog :423 "yayın günü silinecek") | `docs/auth-release-checklist.md:24-36`, `docs/two-device-release-test.md:17`; D01 B5 yalnız ref/e-postayı saymış, şifreyi atlamış | Repoyu bulan biri `test1` ile giriş yapar → `is_moderator()` true → moderasyon kuyruğu, doğrulama fotoğrafları (`verification_photos_select_moderator`), şikâyet kayıtları, `operations_*` RPC'leri okunur; QA hesaplarıyla gerçek kullanıcılara mesaj atılır | **Bugün:** test hesaplarının şifresini değiştir, `test1`'in `app_user_roles` satırını kaldır. Şifreyi dokümandan sil, `git filter-repo` ile geçmişten temizle (backlog :400 git geçmişi maddesiyle birleşir). Kural: QA kimlik bilgileri yalnız `.env`/password manager |
| Y2 | **Yüksek** | Mobilde e-posta doğrulama / şifre sıfırlama bağlantısı tamamlanamıyor. `createClient` `flowType` vermiyor → auth-js varsayılanı `implicit` (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:24`) → GoTrue `petmatch://auth/callback#access_token=…` döner. expo-router fragment'ı `params['#']` adlı tek string'e koyar (`expo-router/build/fork/getStateFromPath-forks.js:371-376`); `app/auth/callback.tsx:14-21` `access_token`/`code` bekler, ikisi de gelmez → `getSession()` boş → "Bağlantı geçersiz" | `core/api/client-factory.ts:31-38`, `stores/auth.ts:224-247`, `app/auth/callback.tsx:38-50`; `two-device-release-test.md:39` madde 11 hâlâ `[ ]` | Yayın günü `Confirm email` açılınca (backlog :429) **hiçbir yeni kayıt tamamlanamaz**; şifresini unutan kullanıcı hesabına dönemez | `client-factory.ts`'e `flowType: "pkce"` (tek satır) → GoTrue `?code=` ile döner, mevcut `exchangeCodeForSession` dalı çalışır. Ardından fiziksel cihazda madde 11 + yeni kayıt doğrulaması. Not: PKCE verifier cihazda saklanır; e-postayı başka cihazda açan kullanıcı için PR #18'deki universal link / OTP maddesi ayrıca gerekli |
| Y3 | Orta-Yüksek | Push teslimatı istemciden tetikleniyor ve fire-and-forget: `sendMessage`/`swipePet`/`completeOnboarding` insert'ten sonra `functions.invoke` çağırıyor; uygulama o anda kapanır/ağ düşerse push **hiç** gitmez, yeniden deneme yok. Ayrıca `claimAndSend` yalnız *ticket*'a bakıyor; Expo `DeviceNotRegistered`'ı çoğunlukla *receipt*'te döner → ölü token'lar hiç temizlenmiyor, her teslimat onlara da gidiyor | `core/api/conversations.ts:256-260`, `discovery.ts:419-423`, `onboarding.ts:170`; `send-notification/index.ts:150-176` (receipt sorgusu yok) | Yavaş ağda "mesajım gitti ama karşı tarafa bildirim gitmedi" — iki cihaz testi iyi ağda geçer, sahada görülmez | Backlog :386 (sunucu taraflı tetik) ile birleşik: `messages`/`matches` insert trigger'ı → `pg_net` ile edge function; ya da `notification_deliveries`'e `queued` satırı + 1 dk'lık cron işleyici. Receipt kontrolü: 15 dk sonra `/push/getReceipts`, `DeviceNotRegistered` → token sil |
| Y4 | Orta | `new_candidate` yolu ölçeklenmiyor: 500 alıcıya kadar `Promise.all` ile her alıcı için 3-4 sorgu + **ayrı** Expo isteği (Expo 100'lük toplu gönderim önerir). Pet oluşturma hız sınırı yok (D01 B2) | `send-notification/index.ts:397-403`, `:519-533`, `claimAndSend` her çağrıda `discovery_preferences` + `push_tokens` + `notification_deliveries` | Tek hesap peş peşe pet açar → her biri ~2000 eşzamanlı sorgu + 500 Expo isteği; edge function zaman aşımı, DB bağlantı havuzu dolar | Alıcı seçimi SQL'e (tek RPC: `select_new_candidate_recipients(pet_id)`), tek `notification_deliveries` toplu insert, Expo'ya 100'lük chunk. `pets` insert'ine saat başı sınır (mevcut `*_rate_limit` kalıbı) |
| Y5 | Düşük | Migration'lar ve edge function'lar CI'da yalnız *test ediliyor*, canlıya elle uygulanıyor; repo ↔ canlı şema farkını gösteren hiçbir kontrol yok (D03 tip drift'i buldu ama şema drift'i kör) | `.github/workflows/ci.yml`; backlog'da "canlıya uygulandı" notları elle | Düzeltme migration'ı test'te yeşil, canlıda unutulur; A17 gibi güvenlik düzeltmeleri "yapıldı" sanılır | `workflow_dispatch` ile `supabase db diff --linked` çalıştıran, fark varsa kırmızı olan iş; `supabase functions deploy` aynı işte |
| Y6 | Bilgi | Git geçmişinde `.env.bak.2026-08-24` vardı (`f981da4`'te silindi); içerik yalnız `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_ID` (değerler okunmadı, yalnız anahtar adları). Service-role yok → sızıntı değil | `git log --all --diff-filter=D -- '.env*'` | — | Y1'deki `filter-repo` turunda birlikte temizlenir; anon key zaten bundle'da, rotasyon şart değil |

## 2. Önceki bulguların durumu (2026-10-24, `a3e5769`)

| Kaynak | Bulgu | Durum | Not |
|---|---|---|---|
| Kod denetimi §2-1 / G01 | A17 `profiles` kolon sızıntısı (doğum tarihi, cinsiyet, son aktiflik herkese açık) | **açık** | Migration taslağı raporda hazır (`a17-profil-kolon-2026-10-04.md` §Kabul), 3 test dosyası güncellenecek (B3) |
| §2-2 / D01 B1 | Eşleşilen kişi karşı tarafın **tüm** petlerini koordinatla okur | **açık** | `0006:133-134`; G04 kuyrukta yok |
| §2-3 / D01 B2 | `new_candidate` sınırsız alıcı + kullanıcı metni | **açık** | Bu raporda Y4 ile büyüdü |
| §2-4 / G02 | A18 profil rızadan önce `public` | **açık** | `onboarding.ts:91` istemciden doğrudan yazıyor; PR #7 taslak |
| §2-5, §2-6 / G03 | Engel sonrası realtime + `blocks_own for all` + `get_conversation_owner_profile` engel kontrolü yok | **düzeltildi (bu dalda)** | `20261024130000_block_after_access.sql` + `block-after-access.test.sql`; kalıcı engel (G03 karar 1a), tek yazma yolu `block_user` (karar 3), B5 gelen kutusu sahip kararına bırakıldı |
| §2-7 / D01 B3 | Karşılıklı beğeni yarışı → eşleşme doğmaz | **düzeltildi (bu dalda)** | `20261024120000_match_race_lock.sql` çift başına `pg_advisory_xact_lock`; `match-race-lock.test.sql` kilidi ve eşleşmeyi doğrular (iki oturumlu yarış tek oturumda kurulamaz) |
| §2-8, §2-9 | `owner_photos` hata yutma; rıza RPC'den önce yazılıyor | **açık** | `profile.ts:215-220, :392-397` |
| §2-10 | Mesajda istemci `id` yok → yeniden denemede mükerrer | **açık** | `conversations.ts:245-251`; DB `id` grant'ı zaten açık (`20260929:65`) |
| D03 F1/F2 | `moderation_items` 3 kolon tipte yok; eski `update_my_discovery_filters` imzası şemada | **açık** | `types/database.ts` son değişiklik `e11b335` 08-28 |
| D04 | Fotoğraf EXIF/metaveri temizliği yok | **açık** | PR #18 boyutlandırma maddesiyle birlikte `expo-image-manipulator` |
| PR #18 (14 madde) | Push izni istenmiyor, bekleme listesi bildirimi yok, foto boyutlandırma, e-posta masaüstü, mağaza riskleri, OTA, huni analitiği, … | **açık, doğru** | Y2 bunlardan "e-posta masaüstünde ölüyor" maddesini ağırlaştırır: mobilde de ölüyor |
| Backlog :429 / :423 | `Confirm email` kapalı; test hesapları duruyor | **açık, bilinçli** | Y1 ile birleşince "yayın günü" değil **bugün** iş |
| D01 1.x | Backlog bayat işaretler (8 kapanmış madde açık görünüyor) | **açık** | Doküman turu |

## 3. Öncelik sırası (tek liste)

**Bugün / bu hafta — güvenlik ve "ürün çalışmıyor"**

1. Y1 — doküman temizliği **bu dalda yapıldı**; canlıda şifre değişikliği,
   QA hesabından moderatör rolünün alınması ve `git filter-repo` sahipte.
2. Y2 — `flowType: "pkce"` **bu dalda yapıldı**; cihaz doğrulaması (kayıt +
   sıfırlama, `two-device-release-test.md` madde 11) sahipte.
3. G03 — **bu dalda yapıldı** (`20261024130000`), `test:db` 28/28 yeşil.
4. A17 + A18 migration'ı (G01/G02 taslakları) tek PR: profil kolon grant'ı,
   rıza öncesi `after_match`, 3 test dosyası, 5 istemci okuma yeri. Sahip
   kararı bekliyor (A17: 8 kolon listesi; A18: rıza ekranı yeri).
5. §2-7 eşleşme yarışı — **bu dalda yapıldı** (`20261024120000`).
6. Push: izin ön ekranı (PR #18 #1) + sunucu taraflı tetik + receipt (Y3).

**Yayından önce — kalite**

7. Foto boyutlandırma + EXIF temizliği + zaman damgalı dosya adı (PR #18 + D04).
8. Y4 `new_candidate` alıcı seçimini SQL'e al; pet oluşturma hız sınırı.
9. Mesajda istemci UUID (§2-10) + iyimser gönderim (PR #18).
10. Huni analitiği olayları (PR #18) — `0051` olay adı kısıtı genişletilir.
11. Mağaza: kamera izin metni, `privacyManifests`, Android bildirim ikonu;
    OTA (`expo-updates`).
12. Y5 şema drift iş akışı; D03 tip yenileme (`npm run gen:types`).
13. Backlog/doküman bayatlık turu (D01 1.1-1.8), QA ref maskeleme.

**Yayın sonrası** — PR #18'in "ilk tur" listesi (push metni, geri al, davet,
puan istemi, güvenlik ipuçları, sahip filtreleri hesaba, çevrimdışı şerit) ve
G04 (eşleşme dışı pet görünürlüğü, sahip kararı K3'e bağlı).

## 4. Hangi iş hangi modelle

Ölçüt: işin yarıçapı (kaç dosya, RLS/veri etkisi), geri alınabilirliği ve
"yanlış yaparsa ne olur". Geçmiş PR'larda T05-T10 sözleşme testleri Opus
5.5/Sonnet 5.5 ile sorunsuz çıktı; bu kalıp korunuyor.

| Model | Ne için | Bu rapordaki işler |
|---|---|---|
| **Fable 5.1** | Hata maliyeti yüksek, çok dosyalı, güvenlik/veri bütünlüğü ve tasarım kararı içeren işler. Kırmızı testi yeşile çevirirken mevcut 27 SQL test dosyasını bozmadan RLS değiştirmek, eşzamanlılık, mimari değişiklik | 3 (G03 migration), 4 (A17+A18, kolon grant'ı + istemci etkisi), 5 (`handle_swipe` kilit tasarımı), 6'nın sunucu tarafı (trigger → `pg_net` → edge; `notification_deliveries` durum makinesi), Y4 (alıcı seçimi SQL'e — `discover_playdate_pets` ile aynı filtre mantığını tekrar etmeden), Y5 iş akışı tasarımı; sahip kararı gerektiren maddelerin seçeneklerini yazmak (K3, ödeme duvarı) |
| **Opus 5.5** | Net kabul kriteri olan, orta boy, 2-6 dosyaya dokunan özellik ve düzeltme işleri; UI + API birlikte | Y2 (`flowType` + callback akışının gözden geçirilmesi + cihaz test planı), 6'nın istemci tarafı (push izni ön ekranı, `push_permission_result` olayı), 7 (`expo-image-manipulator` boyutlandırma/EXIF, paralel yükleme), 9 (istemci UUID + iyimser balon + "tekrar dene"), 10 (olay listesi + `0051` kısıtı + `trackProductEvent` çağrıları), receipt kontrolü (Y3'ün edge function kısmı), 11'in OTA kurulumu |
| **Sonnet 5.5** | Dar kapsamlı, mekanik, kolay doğrulanan işler; sözleşme testleri; doküman temizliği | Y1 doküman temizliği (şifre/e-posta/ref maskeleme — git geçmişi komutunu sahip koşar), 11'in `app.json` kısmı (izin metinleri, `privacyManifests`, bildirim ikonu), 12 `gen:types` yenileme + D03 F1 kolonları, 13 backlog bayat işaret turu, T03/T04 sözleşme testleri (D01 §6), G04 kırmızı test raporu (mevcut G01-G03 kalıbıyla), `experience-roadmap`/`monetization` bayat satırlar |

Kural önerisi (`docs/otonom/README.md`'ye): migration yazan ya da RLS'e dokunan
her iş Fable; `app/`+`core/` içinde kalan ve kabul kriteri testle verilen iş
Opus; yalnız test/doküman/konfig dosyası yazan iş Sonnet. Model seçimi PR
açıklamasına yazılır, `Co-Authored-By` satırı zaten bunu taşıyor.

## 5. Doğrulanamayanlar

- Y2 cihazda doğrulanmadı (simülatör/cihaz yok); kanıt kod ve kütüphane
  kaynağı. Tek satırlık düzeltme risksiz, test maliyeti düşük.
- `test1@petmatch.app` rolünün canlıda hâlâ admin olduğu dokümana dayanıyor
  (`auth-release-checklist.md:28`); canlı `app_user_roles` okunmadı.
- `test:db` koşulmadı; 27 SQL test dosyasının `main`'de yeşil olduğu CI
  geçmişinden (#133, 2026-10-18, success) biliniyor.
- Canlı şemanın repodaki son migration'la aynı olduğu doğrulanamadı (Y5'in
  nedeni).

## 6. İyi olanlar

- CI üç ayak (statik, DB davranış, deno check) ve `main`'de son 6 koşu yeşil.
- Rate limit katmanı (`20260929`) mesaj/swipe/şikâyet/telemetri için var;
  `messages` kolon grant'ı (`created_at`/`read_at` istemciden yazılamaz) doğru.
- `send-notification` ve `delete-account` kimlik doğrulamayı service-role'dan
  önce yapıyor, iç hata metni istemciye sızmıyor, delete-account storage
  temizliğini sayfalı ve alt klasörlü yapıyor.
- `blocked_user_ids()`, `shares_discover_region`, bölge izolasyonu ve
  `require_*` filtreleri `swipe_pet` içinde sunucu tarafında da uygulanıyor;
  istemci kapıları atlansa bile DB reddediyor.
- Otonom raporlama disiplini (kanıt satırı, kırmızı test, kabul kriteri)
  yüksek; sorun bulguda değil, düzeltmelerin merge edilmemesinde.
