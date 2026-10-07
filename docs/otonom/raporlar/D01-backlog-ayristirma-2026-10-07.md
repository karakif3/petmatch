taban: a65d8e9 (origin/main, 2026-10-07)

# D01 — Denetim — bayatlık: backlog → kuyruk ayrıştırma — 2026-10-07

Kapsam: `docs/backlog.md` (756 satır), `docs/experience-roadmap.md` (1157 satır); kanıt için `core/`, `app/`, `supabase/`, `package.json`. Kod denetimi §2 (10 bulgu) bugünkü durumu.
Yöntem: salt okuma; `rg`, `git log`, `git show --stat`, `gh pr list`; `npm test` (✓ 16 dosya / 125 test). Simülatör/metro, canlı Supabase, `supabase` CLI, `test:db` kullanılmadı. Hiçbir dosya değiştirilmedi (bu rapor hariç).
Girdi: PR #5 merge edildi (`3147c21`) → `main`'deki backlog günceldir (2026-10-03 deploy notu `backlog.md:342,373-376`'da).
Satır numaraları `a65d8e9`'daki dosyalara göredir. `backlog:N` = `docs/backlog.md:N`, `roadmap:N` = `docs/experience-roadmap.md:N`.

## Özet

- Açık madde envanteri: backlog'da **33** `[ ]` + P1'de **13** açık "Sıradaki"/çıplak madde, roadmap'te **9** `[ ]`; ayrıca işaretsiz açıklar (yayın kapıcıları, kararı bekleyenler, borç). Kuyruk önerisindeki "10 + 8" sayımı eksikti.
- Satır bazında durum: **8 kapanmış ama açık görünüyor** (doküman bayat) · **~50 açık** (kanıtlı; yaklaşık 30'u ürün kararı, yayın günü ya da sahip/L0 işi) · **12 bilinmiyor** (ekran, cihaz, canlı veri ya da hukuk gerekir). Kuyruğa alınabilecek kod/test işi az.
- Kod denetimi §2: **10/10 hâlâ açık**. Düzeltme migration'ı yok (son migration hâlâ `20260929120000`). 1, 4, 5, 6 için kırmızı test + plan hazır (G01/G02/G03). 2, 3, 7 için kuyrukta madde yok.
- Aday: 4 yeni madde (2 app-test, 1 guvenlik-test, 1 denetim) ve mevcut 2 öneriye ek kanıt. Sahip kararı: 6.

## Sahip-acil (ajan yapamaz)

Yok. Yeni acil bulgu çıkmadı. A5, A22 ve A17/A18 düzeltmesi zaten sahipte (kod-haritası §4).

## 1. "Güncel durum" bölümünün bayatlığı

| # | Bulgu | Yer | Etki |
|---|---|---|---|
| 1.1 | Başlık "Güncel durum ve sıra (2026-08-08)", içerik ise 2026-10-03'e kadar gidiyor | `backlog:8` ↔ `:339-343`, `:373-376` | Okuyan kişi bölümün iki ay önce bırakıldığını sanıyor. Gerçek açık liste `:371-402`'nin içinde kalıyor |
| 1.2 | "Sıradaki iş burada" diyor, ama bölüm büyük ölçüde kapananların anlatısı (`### Son turlarda kapananlar`, :13-370) | `backlog:10-13` | Sıra bilgisi yok; açıklar 6 farklı alt başlığa dağılmış (:152, :228, :335, :371, :404, :463, :493) |
| 1.3 | Numaralandırma çakışıyor: "Sıradaki ürün işleri **9**" (ödeme duvarı) ile P1-**9** (moderasyon) aynı numara. "backlog 9" atfı ikisinden birine gidiyor. "(6, 7, 8, 10, 11, 12)" eski numaralandırmaya ait | `backlog:441`, `:641`, `:330`, `:446` | Atıflar belirsiz |
| 1.4 | 08-09 turundan "açık kalanlar" listesi kapanmayı göstermiyor: Lucide `:153` açık yazıyor ama `:275-277`'de kapandı | `backlog:152-158` | Bayat |
| 1.5 | Kapanmış ama açık görünen 8 madde (aşağıda **kapanmış** satırları): `:619`, `:658`, `:659`, `:675`, `:741`, `roadmap:401`, `roadmap:426`; `:153` | §3-§4 | Yanlış iş üretir |
| 1.6 | Belge içinde çelişki var: `backlog:406` `require_owner_photo` çift yönlülüğünü "tamamlandı (0054)" diyor, `roadmap:426` hâlâ `[ ]` | `backlog:406` ↔ `roadmap:426` | — |
| 1.7 | Otonom dokümanlarda sayılar bayat: kuyruk D01 ve README "Kuyruk kaynağı" backlog için "`main`'de 748 satır" diyor, bugün 756 (PR #5 merge edildi). Kuyruk önerisindeki `[ ]` sayımı da "10 + 8", bugün 33 + 9 | `docs/otonom/kuyruk.md` D01, `docs/otonom/README.md` "Kuyruk kaynağı" | Tech-lead Pazartesi tazelemesinde düzeltir |
| 1.8 | Public dokümanda proje ref'leri ve QA hesap adresleri açık yazılı (değerler bu rapora kopyalanmadı) | `backlog:249,251` (ref), `backlog:59,423` (`<qa-hesabı>`) | README'nin public repo yazım kuralıyla çelişiyor. Ref sır değil, ama kural gereği maskelenmeli → K5 |

## 2. Kod denetimi §2 — bugünkü durum (10 bulgu)

Kaynak: `oc/orchestrator/audit/2026-10-03-kod-denetimi.md` §2. Başlangıç doğrulamaları: `oc/orchestrator/audit/2026-10-03-petmatch-kuyruk-onerisi.md` §1. Burada yalnız durum güncelleniyor.

| # | Bulgu | Durum 2026-10-07 | Kanıt (a65d8e9) | Kuyruk bağı |
|---|---|---|---|---|
| 1 | `profiles` kolon sızıntısı (A17) | **açık** | `0035_block_hides_public_profile.sql:28-33` değişmedi; SELECT kolon grant'ı yok | G01 bitti (rapor `docs/otonom/raporlar/a17-profil-kolon-2026-10-04.md`, PR #6 merge); sahip kararı 8 kolon; düzeltme sahipte |
| 2 | Eşleşilen kişi, karşı tarafın **bütün** petlerini (pasif dahil) ~1 km koordinatla okur | **açık** | `0006_rls_performance.sql:133-134` (`pets_select_matched` sahip düzeyinde, `is_active` ve eşleşen pet kontrolü yok); `:51-64` `matched_owner_ids()`; koordinat yuvarlama `0007_location_privacy.sql:20-37` (2 basamak); pets'te SELECT kolon grant'ı yok (`0012:30` yalnız UPDATE revoke). `0062_pet_roster.sql` çoklu peti açtığı için yüzey büyüdü | **yok** → aday G04 |
| 3 | `new_candidate` push: sınırsız alıcı, kullanıcı metni | **açık** | `send-notification/index.ts:417` `.limit(500)` (sırasız), `:519` `Promise.all`, `:527` gövdede pet adı. Pet başına alıcı başına tek teslim var (`0019_push_notifications.sql:20` PK). Ama pet oluşturmada hız sınırı yok: `20260929120000:178-352` yalnız mesaj, swipe, şikâyet ve telemetri için. `created_at` seçiliyor, kullanılmıyor (`:387`) | öneriler'de `edge-test` var → ek kanıt (§6) |
| 4 | Profil KVKK onayından önce public (A18) | **açık** | `20260827204345:10` varsayılan `public`; `core/api/onboarding.ts:67-70` `publicProfileConsent: true`, `:91` ilk kayıtta `public` | G02 bitti (rapor taslak PR #7'de, açık); düzeltme sahipte |
| 5 | Engellenen kişi realtime kanalını izleyebiliyor | **açık** | `0031_*.sql:28-33` yalnız katılımcılığa bakıyor | G03 bitti (rapor taslak PR #9'da, `docs/otonom/raporlar/engel-sonrasi-erisim-2026-10-06.md`); ek B1 `0068:451-481` |
| 6 | `blocks_own` UPDATE/DELETE'e açık | **açık** | `0006_rls_performance.sql:230-232` `for all` | G03 |
| 7 | Karşılıklı beğenide yarış → eşleşme oluşmaz | **açık** | `handle_swipe` son tanımı `0008_goal_model.sql:98-150`; karşılık kontrolü `:114-119` kilitsiz `exists`; tetikleyici `after insert` (`0002_matching.sql:106-108`); kilit ya da yeniden deneme yok | **yok** → 2. faz `sql-taslak` (§6). Tek oturumlu `test:db` ile kırmızı gösterilemez (doğrulanmalı) |
| 8 | `"owner_photos"` geçen her hata yutuluyor | **açık** | `core/api/profile.ts:215-220`, `:374-379` | öneriler'de `app-kucuk-is` var; aday T03 bu davranışı kilitler |
| 9 | Rıza RPC'den önce yazılıyor, sunucu zorlamıyor | **açık** | `core/api/profile.ts:392-397` (`saveOwnerProfile`), `:616-619` | öneriler'de var (G02 ile); T03 sırayı kilitler |
| 10 | Mesaj gönderiminde istemci `id` yok → mükerrer mesaj | **açık** | `core/api/conversations.ts:245-251`; T01 testi bu davranışı kilitliyor (`core/api/conversations.test.ts`) | öneriler'de `app-kucuk-is` var |

## 3. `docs/backlog.md` — açık maddeler

### 3a. 2026-09-30 turunun açıkları (`:335`, `:371-402`)

| Satır | Madde | Durum | Kanıt |
|---|---|---|---|
| :373, :377 | Migration + deploy, keep-alive `[x]` | kapanmış (doğru işaretli) | `.github/workflows/supabase-keep-alive.yml` var; `20260929120000` migration'ı repoda |
| :335 | `client_errors`'taki geliştirme satırlarını temizle | bilinmiyor (canlı veri) | `__DEV__` kapısı `core/api/observability.ts:67`; temizlik canlıda, sahip/L0 |
| :380 | Faz 3 akışları cihazda | bilinmiyor (ekran gerekir) | — |
| :384 | Native crash raporlama | açık (sağlayıcı kararı sahipte) | `package.json`'da sentry vb. yok |
| :386 | Push tetiklemeyi sunucuya taşı; `new_candidate` alıcısını SQL'de seç | açık | Tetikleyen istemci: `core/api/onboarding.ts:170`, `discovery.ts:419,427`, `conversations.ts:256`, `moderation.ts:115`; migration'larda `pg_net`/webhook yok; §2-3 |
| :390 | `hooks/` katmanı, büyük ekranları bölme, `memo` | açık | `hooks/` yok; `app/profile/owner.tsx` 1147, `app/(app)/index.tsx` 982, `app/chat/[conversationId].tsx` 903 satır; `app`/`components`'te `memo(` 0 |
| :392 | expo-image `cacheKey` | açık | `rg cacheKey app components core` boş |
| :394 | `SafeAreaView edges={["top"]}` + sohbette klavye | açık (sonuç bilinmiyor, ekran gerekir) | Hiçbir ekranda `edges=` yok (ör. `app/(app)/likes.tsx:115`); sohbet `KeyboardAvoidingView` `app/chat/[conversationId].tsx:434-436` |
| :396 | Expo SDK 54 → 57 | açık | `package.json:31` `~54.0.37` |
| :397 | Onboarding rızası ayrı ve isteğe bağlı mı | açık, G02 (taslak PR #7) | `core/api/onboarding.ts:67-70,91` |
| :400 | Git geçmişi temizliği | açık, sahip (L0) | kod denetimi §2 "Diğer"; bu denetimde geçmiş taranmadı |

### 3b. Yayın kapıcıları ve yayın günü (`:404-437`, `:272`)

| Satır | Madde | Durum | Kanıt |
|---|---|---|---|
| :406 | `require_owner_photo` çift yönlü | kapanmış | `0054_owner_photo_reciprocity.sql:1-20` |
| :409 (+P0-5 :593) | Yasal alanlar (unvan, adres, e-posta, URL'ler) | bilinmiyor (ortam değişkeni; `.env` okunmadı) | `core/domain/legal.ts:13-35` env'den okur, yoksa köşeli yer tutucu + `readyForRelease=false`; `eas.json`/`app.json`'da bu anahtarlar yok → büyük olasılıkla açık |
| :412 (=P0-2 :570) | Fiziksel cihazda iki hesapla test | bilinmiyor (cihaz gerekir) | `docs/two-device-release-test.md` |
| :423 | Test hesaplarını sil | açık, yayın günü (sahip/L0) | — |
| :429 | `Confirm email` aç | açık, yayın günü (sahip/L0) | Dashboard ayarı, kodda doğrulanamaz |
| :272 | Sunucu şifre asgarisi 6 → 8 | bilinmiyor (Dashboard) | `docs/auth-release-checklist.md` |

### 3c. Ürün kararı, borç ve dağınık açıklar

| Satır | Madde | Durum | Kanıt |
|---|---|---|---|
| :441, :465 | Beğeniler ödeme duvarı + sağlayıcı | açık, sahip kararı | `package.json`'da revenuecat/purchases yok |
| :470 | "Tanışma amacı" yeri/çerçevesi | açık, sahip kararı | — |
| :478 | Mama/ekipman ortaklığı | açık, sahip kararı | — |
| :484 (=roadmap:148) | Petsiz kullanıcı | açık, sahip kararı | — |
| :487 (=roadmap:314) | 5. sekme | açık, sahip kararı | `app/(app)/` 4 sekme |
| :490, :491 | Sohbette fotoğraf, sesli görüşme | ertelendi (sahip); foto ön koşulları roadmap §3 | — |
| :495 (+P1-13 :737) | EN katalog / sabit metinler | açık | `core/i18n/catalogs/tr.ts` 39, `en.ts` 49 satır; "~250 sabit metin" sayımı doğrulanmadı → aday D02 |
| :498 | Türkçe büyük/küçük harf tuzağı | bilinmiyor (kural notu; hata yok iddiası) | — |
| :501 (=P1-12 :728) | `pause_stale_adoption_listings` zamanlanmadı | açık (sahip; `pg_cron` canlıda kurulmalı) | Fonksiyon `0011_adoption_listings.sql:67-103`; migration'larda `cron.schedule` yok |
| :153 | Lucide geçişi | **kapanmış** (bayat) | `backlog:275-277` |
| :158 (=roadmap:744) | Sekme çubuğuna `expo-blur` | açık (native rebuild) | `package.json`'da yok |
| :228 | Uyum skoru sıralamaya + boost | açık, ürün (P1-16) | — |
| :91 (=roadmap:527) | Süper beğeni eşleşmesinde liste rozeti | açık (migration gerekir) | `is_super` hiçbir konuşma RPC'sinde yok |

### 3d. P0 (`:512-624`)

| Satır | Madde | Durum | Kanıt |
|---|---|---|---|
| :558 | `client_errors` `chat/send` izleme | bilinmiyor (canlı, operasyon) | — |
| :606 | `pets_only…dating` bağlantı modu | açık | Migration yok; `0021_owner_social_discovery.sql:3` bilinçli olarak dating kurmuyor |
| :607, :608, :610, :612 | Niyet uyumu, cinsiyet ilgisi modeli, ücretsiz temel tercih, dating doğrulama kapısı | açık (hepsi :606'ya bağlı, ürün) | `gender_interest` benzeri kolon yok |
| :614 | Risk temelli 18+ + Play Restrict Minor Access | açık (kısmen) | Beyana dayalı 18+ DB tetikleyicisi var (`20260929120000:363-374`); risk temelli kapı yok |
| :615 | İçerik filtresi + topluluk standardı | açık | Filtre kodu yok (`rg profanity/content_filter/blocklist` boş); `docs/moderation-runbook.md` var, yayımlanma durumu bilinmiyor |
| :617 | Mağaza metadata | bilinmiyor (mağaza konsolu) | — |
| :619 | `2026-07-29-v2` için yeniden kabul | **kapanmış** (bayat) | Sürüm `2026-08-22-v3` (`core/domain/legal.ts:1`); kabul kapısı `stores/auth.ts:34-47`, yönlendirme `app/_layout.tsx:83` |
| :620 | Özel nitelikli veri için KVKK incelemesi | açık, hukuk/sahip (:606'dan önce şart) | — |

### 3e. P1 (`:626-756`; `[ ]` ve açık "Sıradaki")

| Satır | Madde | Durum | Kanıt |
|---|---|---|---|
| :658 | Doğrulama onay/ret bildirimi | **kapanmış** (bayat) | `0055_verification_decision_feedback.sql:1,11-14` (`verification` olayı); `core/api/moderation.ts:115-116` |
| :659 | Yapılandırılmış ret nedeni + itiraz | **kapanmış** (bayat) | `0055:4-8,22,38` |
| :660 | Aktif pet değişiminde yeniden doğrulama | açık | `0062_pet_roster.sql`'de doğrulama dokunuşu yok |
| :661 | Tekrar fotoğraf kontrolü / ikinci moderatör | açık | İlgili kolon/fonksiyon yok |
| :662 | Dosya imzası, yeniden kodlama, metadata temizliği | açık | İstemcide EXIF/manipulator yok; kod denetimi §2 "Diğer" (EXIF) |
| :673, :674 | Sessize alma; aktiflik/okundu gizlilik tercihi | açık | `rg mute/quiet_hours/read_receipts` boş |
| :675 | Yapılandırılmış buluşma kartı | **kapanmış** (bayat) | `0043_meetups.sql`; `backlog:24` |
| :676 | Offline gönderim kuyruğu | açık | `core/api/conversations.ts:245-251` tek seferlik insert |
| :677 | Okunmamış ayıracı / sohbet içi arama | açık | `core/domain/chat-items.ts`'te unread yok |
| :708 | HEIC/kamera fiziksel test | bilinmiyor (cihaz) | — |
| :727, :730 | Sahiplendirme: ana döngü doğrulaması; 7332 metinleri | bilinmiyor (gerçek kullanıcı / hukuk) | `core/features.ts:22` `adoption: false` |
| :738, :739 | EN insan çevirisi QA; uzun metin/ekran okuyucu kabulü | açık / bilinmiyor (ekran gerekir) | — |
| :740 (P1-14) | Google/Apple ile giriş | açık | `expo-apple-authentication` `package.json:32`'de kurulu ama `app`/`core`/`components`'te import yok; Google yok |
| :741 (P1-15) | Çoklu pet desteği | **kapanmış** (bayat) | `0062_pet_roster.sql`, `app/profile/pets.tsx`, `core/api/pets.ts:86`; commit `1ba6046` |
| :742 (P1-16) | Premium / boost / kim beğendi | açık, ürün | — |
| :747-754 | Mekân `kind` + sponsorluk (5 madde) | açık | `0038_meetup_places.sql`, `0052_*`'de `kind`/sponsor yok |

## 4. `docs/experience-roadmap.md` — `[ ]` (9)

| Satır | Madde | Durum | Kanıt |
|---|---|---|---|
| :86-89 | Sohbette foto ön koşulları (bucket+RLS, şikâyet, bulanık ilk görsel, moderasyon önizleme) | açık (4) | Migration'larda ve `conversations.ts`'te attachment/bucket yok |
| :148 | Petsiz kullanıcı | açık, sahip kararı | = backlog:484 |
| :314 | 5. sekme | açık, sahip kararı | = backlog:487 |
| :401 | `owner_visible` → anlamlı alan | **kapanmış** (bayat) | `0047_owner_profile_shown.sql:12,47`; `core/api/discovery.ts:150,187` |
| :426 | `require_owner_photo` çift yönlü | **kapanmış** (bayat) | `0054:1-20`; çelişki 1.6 |
| :428 | `require_verified_owner` asimetrisi yorumla belgelensin | açık | Migration yorumlarında yok (`rg` boş); `0054:1-2` yalnız fotoğraf filtresini açıklıyor |

## Bulgular (önem sırasıyla)

| # | Önem | Bulgu | Yer | Senaryo | Öneri (hat, seviye) | Kabul kriteri |
|---|---|---|---|---|---|---|
| B1 | orta | §2-2 kuyrukta yok: eşleşilen kişi, karşı tarafın eşleşme dışı ve pasif petlerini koordinatıyla okur. Çoklu pet (0062) yüzeyi büyüttü | `0006:133-134`, `:51-64`; `0007:20-37` | A, B'nin köpeğiyle eşleşir. `pets` tablosundan B'nin pasife aldığı kedisini ve onun ~1 km konumunu okur | G04, guvenlik-test L1 | §6 G04 |
| B2 | orta | §2-3 için ek kanıt: pet oluşturmada hız sınırı yok, dolayısıyla her yeni pet en fazla 500 alıcıya push üretir | `send-notification/index.ts:387,417,519,527`; `20260929120000:178-352` | Bir hesap kısa sürede çok sayıda pet açar ve her biri için toplu push gönderir; gövdede kullanıcının yazdığı ad var | Mevcut `edge-test` önerisine ek (2. faz) | §6 |
| B3 | orta | §2-7 kuyrukta yok: karşılıklı beğeni yarışı | `0008:114-119`; `0002:106-108` | İki kullanıcı aynı anda beğenir; iki işlem de diğerinin satırını görmez ve eşleşme doğmaz | 2. faz `sql-taslak` (L3) | §6 |
| B4 | düşük | Doküman bayat: 8 kapanmış madde açık görünüyor, numaralar çakışıyor, başlık tarihi eski | §1 | Tech-lead ya da ajan kapanmış işi yeniden kuyruğa alır | Sahip / doküman (K1) | §6 |
| B5 | düşük | Public backlog'da proje ref'leri ve QA hesap adresleri | `backlog:59,249,251,423` | Repo kuralıyla çelişki; QA hesaplarını hedef alma kolaylaşır | Sahip (K5) | Değerler `<proje-ref>`/`<qa-hesabı>` ile değişir |
| B6 | düşük | `expo-apple-authentication` bağımlılığı kurulu ama kullanılmıyor (P1-14 hazırlığı olabilir) | `package.json:32` | Kullanılmayan native modül; mağaza incelemesinde Apple girişi beklentisi doğabilir (doğrulanmalı) | Sahip (`package.json` L0); ayrı karar gerekmez, P1-14 ile birlikte | — |

## Doğrulanamayanlar

- **Ekran gerekir:** backlog :380, :394 (görsel sonuç), :739; roadmap §8 görsel. Nasıl: QA hesabıyla simülatör (L0, sahip).
- **Cihaz gerekir:** :412/:570, :708. Nasıl: `docs/two-device-release-test.md`.
- **Canlı veri gerekir:** :335, :558 (`client_errors`), yasal env değerleri (:409). Nasıl: sahip panelden ya da EAS env listesinden bakar. Sorgu taslağı (çalıştırılmadı): `select route, count(*) from client_errors where created_at < '<yayın-öncesi-tarih>' group by route;`
- **Hukuk / mağaza:** :617, :620, :730.
- **§2-7 yarışı:** `test:db` tek oturumda koştuğu için kırmızı gösterilemez. İki bağlantılı yük testi gerekir (L3 / sahip).
- **"~250 sabit Türkçe metin"** (`backlog:496`): sayılmadı → D02.

## İyi olanlar

- Güvenlik sertleştirmelerinin çoğu regresyon testine bağlı (`discovery-owner-filters.test.sql`, `discovery-recirculation.test.sql`, 24 SQL test dosyası). Backlog'daki "testin eski kodda düştüğü doğrulandı" alışkanlığı korunmalı.
- Backlog "neden" yazıyor: kararların gerekçesi ve bilerek yapılmayanlar (ör. `:232-243` konum tazeliği) var. Bayatlık içerikte değil, durum işaretlerinde.
- Bildirim teslimatı pet ve alıcı başına tekil (`0019:20` PK); yasal sürüm değişince yeniden kabul kapısı çalışıyor (`stores/auth.ts:34-47`).

## 6. Aday listesi (hat + kabul kriteri)

Kanıtsız madde yok. Kuyruktaki `öneriler`'de bulunan maddeler (owner_photos yutma, mesaj `id`, rıza sırası, `age.ts`, `coarsenCoordinates`, tip drift, `send-notification` sınırı) tekrar yazılmadı; yalnız ek kanıt notu var.

- **T03 · app-test · `core/api/profile.ts` hata yutma ve rıza sırası (mevcut davranışı kilitler)**
  Kabul: `core/api/profile.test.ts` (yeni) yeşil, toplam test > 125. README'deki 4 `vi.mock` kalıbı kullanılır (`./supabase.client`, `./observability`, `./legal`, `./notifications`). Kilitlenecekler: (a) owner_photos okumasında `PGRST205` → boş liste; mesajında `"owner_photos"` geçen başka bir hata → **yine yutulur** (mevcut davranış, `profile.ts:215-220`, `:374-379`); ilgisiz hata → fırlatır. (b) `saveOwnerProfile`: `recordOptionalConsent("public_profile_consent", …)` `update_my_owner_details` RPC'sinden **önce** çağrılır (`:392-397`); RPC hata verse bile rıza çağrısı yapılmış olur. Kırmızı test kuralı gereği iki davranış PR'da "açık soru" olarak yazılır, mevcut `app-kucuk-is` önerilerine bağlanır.
  Kapsam: okunur `core/api/profile.ts` · yazılır yalnız `core/api/profile.test.ts`. Çakışma: A17 düzeltmesi `profile.ts:153-156`'yı değiştirecek. Test o satırlara dokunmaz.
  Yüklenebilirlik: ✓ (profile.ts dört mock'la, 2026-10-03 denendi). Veri: yok · Arayüz: hayır · Boy: S · Risk: düşük.

- **T04 · app-test · `core/api/safety.ts` sözleşmesi (G03 kararının istemci kanıtı)**
  Kabul: `core/api/safety.test.ts` (yeni) yeşil. Kilitlenecekler: `blockUser` yalnız `rpc("block_user", …)` çağırır, `from("blocks")` hiç çağrılmaz (G03'teki "istemcide DELETE yolu yok" iddiasını kilitler); `reportContent` `report_content` RPC'sine parametreleri doğru eşler; `unmatchConversation` `unmatch_conversation` çağırır; RPC hatasında fırlatır. `deleteAccount` kapsam dışı (hesap silme, auth yüzeyi).
  Kapsam: okunur `core/api/safety.ts` (import: `./supabase.client`, `./observability`) · yazılır yalnız `core/api/safety.test.ts`.
  Yüklenebilirlik: **doğrulanmalı** (README kalıbı kapsıyor ama safety.ts denenmedi; tech-lead aynı gün denemeli). Veri: yok · Arayüz: hayır · Boy: S · Risk: düşük.

- **G04 · guvenlik-test · eşleşilen kişinin eşleşme dışı ve pasif petleri: kırmızı test + düzeltme planı** (kod denetimi §2-2)
  Kabul: `docs/otonom/raporlar/G04-eslesme-disi-pet-<tarih>.md`: (1) SQL taslağı + kırmızı çıktı: A'nın peti ile B'nin aktif peti eşleşik; A, B'nin `is_active=false` petini ve eşleşmede olmayan aktif petini `select` **edemez** (bugün eder: `0006:133-134`). Koruma kontrolleri: eşleşen petin satırı okunur; eşleşme `is_active=false` olunca hiçbiri okunmaz (bugün ok olmalı); konum yuvarlama trigger'ı (`0007:20-37`) değişmez. (2) `test:db`: yalnız yeni assert'ler FAIL, mevcut 24 dosya yeşil. (3) Düzeltme taslağı: `matched_pet_ids()` (eşleşmedeki pet id'leri) ile policy; istemcide eşleşilenin petini okuyan yerlerin listesi (`core/api/pet-profile.ts`, `app/pet/[petId].tsx`, `core/api/conversations.ts`) ve etkisi; K3 kararı seçenek olarak.
  Kapsam: okuma `supabase/migrations/0006*` (`:51-64,130-134`), `0007*`, `0062_pet_roster.sql`, `supabase/tests/_helpers.sql`, ilgili `core/api` · yazma yalnız rapor. Boy: S-M · Risk: yok.

- **D02 · denetim · i18n sabit metin envanteri**
  Kabul: `docs/otonom/raporlar/D02-i18n-envanter-<tarih>.md`: `app/`, `components/`, `core/` altındaki kullanıcıya görünen sabit Türkçe metinlerin dosya bazında sayımı (yöntem `rg` deseni raporda) ve `core/i18n/catalogs/tr.ts`'e taşınmış oranı. Yasal, e-posta ve push metinleri ayrı kolon (`send-notification/index.ts:525-527` gibi). `backlog:496` "~250" iddiasının doğrulanması. 2. faz `i18n` hattı için dosya bazlı ilk 5 iş önerisi.
  Kapsam: okuma `app/`, `components/`, `core/`, `supabase/functions/` · yazma yalnız rapor. Boy: S-M · Risk: yok.

- **Mevcut önerilere ek kanıt (yeni madde değil):**
  - `edge-test` (2. faz, `send-notification` alıcı sınırı): kabul kriterine eklenmeli: pet oluşturma hız sınırı yok (`20260929120000:178-352`); `created_at` seçiliyor ama kullanılmıyor (`:387`); tekillik `0019:20` PK ile pet başına alıcı başına sağlanıyor.
  - `sql-taslak` (2. faz, L3; A17/A18 kapandıktan sonra): §2-7. `handle_swipe` (`0008:98-150`) çift başına `pg_advisory_xact_lock(hashtext(least(..)||greatest(..)))` ya da `swipe_pet` içinde karşılık kontrolü. Kabul: migration taslağı + yarışın iki oturumlu senaryosu. Tek oturumlu pgTAP ile kırmızı gösterilemediği raporda yazılır.

- **Sahip / L0 (kuyruğa alınmaz):** backlog dokümanını düzeltme (K1), ref/QA maskeleme (K5), yayın günü işleri (:423, :429, :272), `pg_cron` (:501), ürün kararları (:441, :470, :478, :484, :487, :606-:620, :742), crash sağlayıcı (:384), SDK 57 (:396), git geçmişi (:400).

## Sahip kararları

- D01-K1: Backlog "Güncel durum" ve 8 bayat işaret kim tarafından düzeltilsin? · seçenekler: A=sahip kendi oturumunda | B=tech-lead doküman PR'ı | C=şimdilik kalsın
- D01-K2: G04 (eşleşme dışı/pasif pet erişimi kırmızı testi) kuyruğa alınsın mı? · seçenekler: ok|hayir
- D01-K3: Eşleşilen kişi karşı tarafın hangi petlerini görsün? · seçenekler: A=yalnız eşleşen pet | B=tüm aktif petler | C=hepsi (bugünkü)
- D01-K4: T03 (profile.ts) ve T04 (safety.ts) app-test maddeleri hazırlansın mı? · seçenekler: ok|hayir
- D01-K5: Backlog'daki proje ref'leri ve QA hesap adresleri maskelensin mi? · seçenekler: ok|hayir
- D01-K6: D02 (i18n sabit metin envanteri) denetim maddesi kuyruğa alınsın mı? · seçenekler: ok|hayir
