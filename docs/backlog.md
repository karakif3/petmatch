# PetMatch ürün backlog'u

Bu dosya yayın öncesi işlerin tek ve numaralı referansıdır. Sıra değiştirilirse
README yerine önce bu dosya güncellenir.

---

## Güncel durum ve sıra (2026-08-08)

Bu bölüm en üstte duruyor çünkü aşağıdaki numaralı liste tarihsel; **sıradaki
iş burada.**

### Son turlarda kapananlar

Keşfette sağa/sola kaydırma jesti · sahip profiline geçiş paneli (kart ve
sohbet) · ilgi alanları · **Beğeniler sekmesi** (4 sekmeli yapı) ·
**yapılandırılmış buluşma kaydı** (öneri → yanıt → iptal, `0043`) ·
**süper beğeni** (`is_super` kolonu, Beğeniler sıralaması + rozeti, `0044`) ·
auth redirect URL'leri · Supabase hata yutmasının 16 çağrı yerinde
kapatılması · deprecated `SafeAreaView` yüzünden boş render edilen profil
ekranları · telemetriden çıkan `profile-completion` çökmesi.

**Bulgu (0044 sırasında):** `product_events.event_name` DB kısıtı 0027'den
beri genişletilmemişti; `meetup_*`, `discovery_segment_changed`,
`adoption_*` olayları aylardır sessizce reddediliyordu (`track_product_event`
hatayı yutup `console.warn`'a düşürüyor). Kısıt güncel listeyle genişletildi.

**Aynı gece devam eden kapanışlar:** Keşfet'te beğen düğmesi sabit alt
şeride taşındı (kart + tamamlama kartı üst üste gelince kaydırmadan hiç
görünmüyordu) · sohbette son mesajın kardeş öğe (buluşma istemi, hata
şeridi) boy değiştirince görünüm dışında kalması düzeltildi — kök sebep
RLS/sorgu değil, tek `requestAnimationFrame`'in eksik yüksekliğe göre
`scrollToEnd` hesaplaması; çözüm `onLayout` tabanlı düzeltici kaydırma ·
Eşleşmeler'deki 15sn polling kaldırıldı (Beğeniler'deki gibi odağa-girince-
tazele) · eşleşme kutlamasında sahip fotoğrafı rozeti · bağlamsal mini
onboarding ipucu (tur değil, tek satır, ilk karar anında kapanıyor).

**2026-08-08 — UX kalite/premium turu.** Tüm sekmeler ve kritik ekranlar
tek tek review edildi, gerekçesi [`experience-roadmap.md`](experience-roadmap.md)
§10'da. Dört fazda kapandı:

- **Temel (her ekranı etkiler):** yüklenen Inter yüzleri hiçbir metinde
  kullanılmıyordu (`tailwind.config.js`'teki özel `fontFamily` anahtarları
  Tailwind'in çekirdek `fontWeight` sınıflarıyla aynı adı üretip eziliyordu)
  — `global.css`'e `@layer utilities` ile düzeltildi · ~150 `Pressable`'ın
  hiçbirinde basılı durum yoktu — `components/ui/pressable.tsx` (`AppPressable`)
  · haptik yalnızca 2 yerdeydi — `core/ui/haptics.ts` dört fonksiyonluk
  sözlük, geri alınamaz kararlara bağlandı · gölge sistemi tutarsızdı —
  `core/ui/shadow.ts` · Keşfet'in yüzen düğme şeridi dikey yığılıyordu
  (`LinearGradient`'e hem `className` hem `style` verilince ikincisi
  birincisini eziyordu) — düzeltildi ve **canlı simülatörde doğrulandı**
  (geçen turda doğrulanamamıştı; bu kez `test1@petmatch.app` ile giriş
  yapılıp Keşfet/Beğeniler/Mesajlar/Sohbet/Profil tek tek gezildi).
  Doğrulama sırasında YENİ bir çakışma bulundu ve aynı oturumda kapatıldı:
  uyum rozeti ile güvenlik düğmesi (`index.tsx`'in kart üstüne bindirdiği
  `···`) aynı `right-3 top-3` köşesinde üst üste biniyordu — rozet bir
  satır aşağı indirildi.
- **Keşfet kartı yeniden tasarlandı:** tam kadraj foto (3:4) + karusel
  (`components/photo-carousel.tsx`, kullanıcının 1-6 fotoğrafından
  önceden yalnızca ilki görünüyordu) + tıklanabilir uyum rozeti (bileşen
  skorları döküm halinde) + deste derinliği (arkada bekleyen kart) + kart
  üstü krom sadeleştirildi (alt başlık kaldırıldı, segment/sahiplendirme
  bandı öncelik sırasına göre gösteriliyor).
- **Sekmeler:** Profil'e "Profilimi önizle" eklendi (kullanıcı kendi
  kartını ilk kez karşı tarafın gördüğü haliyle görüyor,
  `components/profile-preview-modal.tsx`) · kaydet düğmesi sabit alt
  şeride taşındı, yalnızca form kirliyken görünüyor · Beğeniler/Mesajlar
  sekme rozetleri eklendi · "Eşleşmeler" sekme adı "Mesajlar"a çekildi
  (ekran başlığıyla tutarsızdı) · üç ekrana iskelet yükleyici eklendi
  (`components/ui/skeleton.tsx`) · Beğeniler'deki kilitli karta dokunma
  yanıtı eklendi · Mesajlar'daki boş durum ortalanmıyordu, düzeltildi.
- **Sohbet/onboarding/auth cilası:** sohbette kalıcı sahip kartı header'ın
  ikinci satırına çökertildi (~120pt kazanıldı) · buluşma yeri düğmesi
  hızlı yanıt şeridine taşındı · son mesajda ikon+metin tekrarı kaldırıldı
  · onboarding'de yasal onay gerçek `accessibilityRole="checkbox"` oldu
  · fotoğraf seçimi artık EKLEME yapıyor (önceden mevcut seçimi tamamen
  değiştiriyordu), kapak seçimi `PetPhotoEditor`'a devredildi · ilerleme
  çubuğu animasyonlandı · sign-in'de şifre göster/gizle + köşe yarıçapları
  sisteme çekildi.

**Bilerek kapsam dışı bırakılan/ertelenen:** Beğeniler ızgarasının
`w-[48%]` hesaplaması (kırık değil, gözden geçirilmedi) · süper beğeniyle
gelen eşleşmede liste satırı rozeti — `list_my_conversations` RPC'si
`is_super` döndürmüyor, **yeni migration gerektiriyor**, bu tur
istemci-only kapsamdaydı · onboarding adım içeriğinin geçiş animasyonu
(yalnızca ilerleme çubuğu animasyonlandı). Ayrıntı: `experience-roadmap.md`
§10 "Bilerek ertelenen".

**2026-08-08 — Keşfet kartı: sahip ilgi alanları + fotoğraf sayfası başına
ilerici bilgi.** Kullanıcı isteği üzerine: kart artık tek bir "ayrıntılar"
paneli yerine, fotoğrafın kendisine sığmayan bilgiyi SONRAKİ fotoğraf
sayfasında gösteriyor (mizaç çipleri → bio → sahip teaser'ı, öncelik
sırasıyla dağıtılıyor). Sahip `public` görünürlükteyse küçük bir
avatar+ad+en-fazla-2-ilgi-alanı rozeti de kartta beliriyor, dokununca
`OwnerSheet` açılıyor. `owner_interests` daha önce yalnızca profil
formunda toplanıp hiçbir yerde gösterilmiyordu (§6) — bu **yeni bir
migration'la** (`0049_owner_interests_in_discovery.sql`, canlıya
uygulandı) `discover_playdate_pets` ve `pending_likes`'a eklendi, AYNI
`owner_visibility = 'public'` kapısıyla. Ayrıntı ve karşılaşılan
simülatör-özel görsel artefakt notu: `experience-roadmap.md` §11.

**2026-08-09 — Tamamlama şeridi + görünürlük anahtarı.** "Profilini
tamamla" kartı artık pet ve sahip eksiklerini **iki ayrı CTA** olarak
gösteriyor (önceden yalnızca ilk eksiğin route'una giden tek düğme vardı;
sahip profili eksik olan kullanıcı `/profile/owner` bağlantısını hiç
görmüyordu) ve tek satırlık bir şeride küçültüldü — Keşfet'te hero
destedir. Keşfet başlığına, filtre düğmesinin yanına **sahip görünürlük
anahtarı** eklendi (`hidden`/`after_match` ↔ `public`): tek alanlık yazma
doğrudan tabloya gidiyor (`updateOwnerVisibility`, RLS `profiles_update_self`),
avatar yoksa `public`'e geçmiyor sahip profiline yönlendiriyor, kapatınca
`public` öncesindeki değere dönüyor. Migration gerekmedi. **Yol üstünde
bulunan gerçek hata:** `["profile-completion"]` sorgusunu hiçbir yazma
invalidate etmiyordu — kullanıcı eksiği doldurduktan sonra bile Keşfet'te
aynı sayıyı görüyordu; iki kaydetme yerine invalidate eklendi. Hepsi
simülatörde canlı doğrulandı (toggle iki yönde, avatarsız `public`
engeli, şerit %14 → %43). Ayrıntı: `experience-roadmap.md` §12.

**2026-08-09 — Hayalet metin gizemi kapandı + kart ekrana sığdırıldı.**
§11'de "simülatör GPU tuhaflığı" diye kaydedilen artefakt **render hatası
değilmiş**: test verisindeki fotoğraflar, alt kenarında adın yazılı olduğu
üretilmiş yer tutucu görseller (sahip avatarı da aynı şablon — "yuvarlak
fotoğraf yarım" görüntüsünün sebebi bu). İzolasyon ve kanıt:
`experience-roadmap.md` §13. **Gerçek hata ayrıydı ve düzeltildi:** kart
sabit 3:4 oranıyla boyutlandığı için ekranı aşıyor, alt satırı (ad ·
boyut · mesafe) yüzen düğme şeridinin altında kalıyordu; kart artık kalan
yüksekliği dolduruyor (`fill` bayrağı: `PhotoCarousel`, `DiscoveryCard`,
`SwipeableCard`). Sekme çubuğu iOS kalıbına çekildi (seçili dolu + hap,
diğerleri outline; saç teli kenarlık). Açık kalanlar: sekme çubuğuna
`expo-blur` (native rebuild gerektiriyor), uygulama geneli ikon
kuralı/boyut skalası, **test verisini gerçek fotoğraflarla seed etmek**
(yer tutucular her görsel değerlendirmeyi zorlaştırıyor).

**2026-08-09 (2. tur) — Kart hiyerarşisi + Lucide + tanışma amacı.** Kartın
alt bloğunda ad en alttaydı, üstünde üç dolu kutu (çipler/bio/sahip)
duruyordu; sıra **kim → ne → ayrıntı** olarak tersine çevrildi, bio ve
sahip kutuları kaldırıldı (sahip artık `self-start` bir hap + ok; ilgi
alanı boşsa "Sahibini gör" yazıyor — RPC doğru, test hesabında
`interests` boştu). Karar düğmeleri (geç/süper/beğen) ve uyum rozeti
**Lucide**'a geçti (`components/ui/icon.tsx`); `react-native-svg` yeni
native bağımlılık, dev-client yeniden derlendi. "Tanışma amacı" sorusu
değerlendirildi: **kalmalı** (ürünün merkezindeki belirsizliği çözüyor)
ama ön koşulları artık kaydetme anında tek hata cümlesi olarak değil,
seçim anında tek tek listeleniyor. Ayrıntı: `experience-roadmap.md` §14.

Bu turdan açık kalanlar:
- **Lucide geçişini tamamla** — bugün karışık aile (karar şeridi Lucide,
  geri kalan Ionicons). Yüzey yüzey çevrilecek; kural: aktif/seçili dolu,
  geri kalan outline, boyut skalası 16/20/24.
- **"Tanışma amacı" sorusunun yeri** — sahip profili formunun içinde
  gömük; sonucun göründüğü yer Keşfet (görünürlük anahtarındaki gibi).
- **Sekme çubuğuna `expo-blur`** — native bağımlılık, ayrı derleme.
- **Test verisini gerçek fotoğraflarla seed et** — yer tutucu görseller
  her görsel değerlendirmeyi zorlaştırıyor (bkz. §13).

### ⛔ Yayın kapıcıları — sırayla

1. **`require_owner_photo` tek yönlü.** Avatarı olmayan ve `hidden` bir
   kullanıcı "yalnızca fotoğraflı sahipleri göster" diyebiliyor: açıklama
   tüketiyor, vermiyor. Kod tabanının kendi kuralıyla çelişiyor —
   `require_visible_owner` ve `require_owner_social` çift yönlü.
   Ayrıntı: [`experience-roadmap.md`](experience-roadmap.md) §8.
2. **Yasal alanlar.** Veri sorumlusu unvanı/adresi, destek e-postası,
   herkese açık politika ve hesap silme URL'leri.
   [`legal-release-checklist.md`](legal-release-checklist.md).
3. **Fiziksel cihazda iki hesapla uçtan uca test.** Push bildirimleri
   yalnızca gerçek cihazda doğrulanabiliyor; simülatörde keychain
   entitlement hatası veriyor.

### 🔒 Yayın anında yapılacak — şimdi DEĞİL, bilerek erteleniyor

Bu ikisi yayın kapıcısı ama **şu an kapatılmamalı**: geliştirme ve test
akışını doğrudan besliyorlar. Yayın gününde, aynı oturumda ve bu sırayla
yapılacaklar.

- **Test hesapları duruyor.** 10 hesap (`test1/2@petmatch.app`, altı
  `@petmatch.test`) keşfet destesini, eşleşmeyi, sohbeti ve buluşma
  akışını denemenin tek yolu. Silmek şu an test kapasitesini sıfırlar.
  Silerken: `auth.users` satırı pets/pet_photos/profiles'ı cascade ile
  götürür ama **storage nesneleri GİTMEZ** — `pet-photos/{userId}/…` ve
  `owner-avatars/{userId}/avatar.jpg` ayrıca silinmeli.
- **`Confirm email` kapalı** (`mailer_autoconfirm = true`). Yeni test
  hesabı açabilmek buna bağlı. Açık kaldığı sürece herkes başkasının
  e-postasıyla hesap açabilir ve şifre sıfırlama akışı gerçek sahibine
  kaptırılabilir — **yayından önce mutlaka geri açılmalı.**
  Geri alma: [`auth-release-checklist.md`](auth-release-checklist.md).

> İkisi bağlantılı ama tek yönlü: mevcut test hesapları
> `email_confirm: true` ile açıldığı için `Confirm email`'i sonradan açmak
> onları bozmaz. Yani sıra şu — önce doğrulamayı aç, sonra hesapları sil.

### Sıradaki ürün işleri

9. **Beğeniler ödeme duvarı gerçek olsun.** Bugün istemci tarafı ücretsiz
   görünümü bulanıklaştırarak simüle ediyor; ödeme altyapısı yok (Faz 0).
   Süper beğeni sınırsız gönderiliyor — günlük limit de bu ödeme duvarıyla
   birlikte gelecek doğal kapı. **Kararı bekleyenler**'e taşındı: hangi
   ödeme sağlayıcısı (RevenueCat vb.) kullanılacağı bir ürün kararı.

**2026-08-07 turunda kapananlar (6, 7, 8, 10, 11, 12):** buluşma yanıtı artık
canlı (`meetups` realtime publication'a eklendi, `0045`) · geri bildirim
sorusu buluşma kaydına bağlandı (onaylanmış ve zamanı geçmiş `meetups`
kaydı varsa soru kesin soruluyor, yeri/tarihi adıyla anıyor, `0046`) ·
takvime ekle (`expo-calendar`, yalnızca onaylanmış buluşmada) ·
`owner_visible` → `owner_profile_shown` (`discover_playdate_pets` ve
`pending_likes`, `0047` — istemcideki boş-alan telafisi artık ikincil bir
savunma, birincil sinyal doğru) · profil ekranında satır içi hatalar +
pet fotoğrafında kamera seçeneği · süper beğeni push bildirimi
(`notification_deliveries`'e `super_like` event_type, `0048` —
`send-notification` **2026-08-07'de deploy edildi**, v2 ACTIVE) · Keşfet kartı
Tinder/Bumble referansıyla küçültüldü (foto en-boy oranı 1.05→1.3, panel
boşlukları sıkılaştırıldı) ve düğme şeridi sert kenarlı araç çubuğundan
deste'nin üstüne binen gradyanlı, gölgeli yüzen düğmelere geçti — canlı
ekran görüntüsüyle doğrulanamadı (simülatörün klavye eşlemesi `@`/`.`
karakterlerini bozuyor, oturum açılamadı); typecheck/lint/test temiz.

### Kararı bekleyenler

- **Beğeniler ödeme duvarı gerçek olsun mu, hangi sağlayıcıyla.** Bugün
  istemci tarafı ücretsiz görünümü bulanıklaştırarak simüle ediyor; ödeme
  altyapısı yok (Faz 0). Süper beğeni sınırsız gönderiliyor — günlük limit
  de bu ödeme duvarıyla birlikte gelecek doğal kapı. Hangi sağlayıcı
  (RevenueCat vb.) kullanılacağı ürün kararı, kod kararı değil.
- **"Tanışma amacı" sorusu — yeniden ele alınacak (2026-08-09'da ertelendi).**
  Bu turda yalnızca başarısızlık anı düzeltildi (ön koşullar seçim anında
  listeleniyor). Asıl sorular açık: soru nerede sorulmalı (bugün sahip
  profili formunun içinde gömük; sonucu Keşfet'te görünüyor), nasıl
  çerçevelenmeli (kendini tanımlama mı, sonucu söyleme mi), ikili kalmalı
  mı yoksa `connection_mode`'a mı geçilmeli. Değerlendirmenin tamamı
  [`experience-roadmap.md`](experience-roadmap.md) §14'te; karar
  verilmeden yeni kod yazılmayacak.
- **İkon ailesi: tek aileye karar ver.** Bugün karışık — karar şeridi +
  uyum rozeti Lucide, geri kalan Ionicons. Değerlendirilen adaylar ve
  gerekçeleri `experience-roadmap.md` §15'te (Phosphor · Hugeicons ·
  Heroicons · Remix · Lucide). Şu an geçiş maliyeti en düşük an: yalnızca
  4 ikon çevrildi ve `react-native-svg` zaten kurulu.
- **Mama/ekipman ortaklığı: hangi sağlayıcı.** Yeri ve deseni artık belli
  (sahiplendirme sohbetine gömülü "yeni pet sahibi kontrol listesi" kartı,
  `MeetupCard` deseniyle; gerekçe ve kapsam dışı bırakılanlar
  [`monetization.md`](monetization.md) Faz 2 tasarım notunda). Açık olan
  tek şey ortaklık programı: yerel pet shop zinciri mi, uygulama-içi
  bağlantı + affiliate mi. Ürün kararı; verilmeden kod yazılmayacak.
- **Petsiz kullanıcılar** ayrı yüzey mi (sahiplendirme + etkinlik), deste
  segmenti mi. Öneri: ayrı yüzey — destede eşleşecek şeyleri yok ve
  "petsizlere görünme" seçeneği iki katmanlı bir deste yaratır.
- **5. sekme** topluluklar mı olsun. Öneri: önce Keşfet'te etkinlik kartı,
  veri gelirse sekmeye terfi. Pilot yoğunluğunda boş sekme ürünün ölü
  olduğunu söyler.
- **Sohbette fotoğraf** — moderasyon kapasitesi olmadan açılmamalı.
- **Sesli görüşme** — güven özelliği, yoğunluk ve gelir oluştuktan sonra.

### Borç

- **İngilizce katalog.** Altyapı hazır, kataloglar boş; kodda ~250 sabit
  Türkçe metin var. Artımlı yapılabilir — yeni yazılan her metin doğrudan
  kataloğa gitsin ki borç büyümesin.
- **Türkçe büyük/küçük harf tuzağı.** Bugün hata yok ama arama/eşleştirme
  eklendiği an görünmez şekilde bozulur. Kurallar
  [`i18n.md`](i18n.md) sonunda.
- **`pause_stale_adoption_listings` zamanlanmadı** (`pg_cron` kurulu değil).
  Sahiplendirme bayrakla gizli olduğu için acil değil, açmadan önce şart.

---

> Deneyim tarafının planı ayrı bir dosyada:
> [`experience-roadmap.md`](experience-roadmap.md) — mikroanimasyonlar,
> yapılandırılmış buluşma + takvim, sohbette fotoğraf, sesli görüşme, petsiz
> kullanıcılar, ilgi alanları ve çok dilin **gerçek durumu**. Hiçbiri MVP
> kapıcısı değil ama sırası ve gerekçesi orada.

## P0 — Yayın öncesi kritik

0. **Profil ekranları boş render ediliyordu** — ✅ **çözüldü (2026-08-04)**

   Belirti: hem **Profil sekmesi** hem **pet profili** boş açılıyordu.
   Keşfet ve onboarding sorunsuzdu. Profil tamamlama kartı bu ekranlara
   yönlendirdiği için kullanıcıyı doğrudan etkiliyordu.

   **Kök neden:** `react-native`'in **deprecated `SafeAreaView`**'ı. iOS 26'da
   `SafeAreaView > KeyboardAvoidingView > ScrollView` zincirinde içeriği sıfır
   yüksekliğe düşürüyordu. Keşfet ekranının etkilenmemesinin sebebi zincirinin
   `SafeAreaView > ScrollView` olması — arada `KeyboardAvoidingView` yok.
   Metro zaten her açılışta bu bileşen için deprecation uyarısı basıyordu.

   **Çözüm:** sekiz ekran `react-native-safe-area-context`'e geçirildi
   (paket zaten kuruluydu) ve önkoşulu olan `SafeAreaProvider` root layout'a
   eklendi.

   **Nasıl bulundu:** tahmin tükendikten sonra ölçüldü — her render dalına
   farklı renkte geçici bir işaretleyici konuldu ve ana dalın ASLINDA
   çalıştığı, içeriğin var olduğu ama görünmediği görüldü. Aynı denemede
   `SafeAreaView` düz bir `View` ile değiştirilince içerik anında ortaya çıktı.

   Daha önce elenenler (hepsi ölçülerek): veri (`loadEditableProfile`'ın dört
   sorgusu da HTTP 200), JS istisnası (`AppErrorBoundary` sessiz,
   `client_errors` boş), yükleme/hata dalları, `KeyboardAvoidingView`'ın
   `behavior` prop'u, Fast Refresh artığı ve "benim değişikliğim mi" şüphesi
   (`git stash` ile geri alınıp tekrarlandı — hata duruyordu).


0b. **Mesaj gönderiminde tekrarlanamayan hata** — *izleniyor*

   Eşleşme kutlamasından sohbete geçip ilk mesaj gönderilirken bir kez
   "Mesaj gönderilemedi." alındı. Aynı kullanıcı, aynı konuşma ve aynı metin
   API'den **HTTP 201** dönüyordu, yani şema ve RLS sağlamdı. Uygulama
   yeniden başlatıldıktan sonra gönderim sorunsuz çalıştı ve bir daha
   tekrarlanmadı.

   **Sebep bulunamadı** çünkü gerçek hata mesajı yutuluyordu:
   `error instanceof Error ? error.message : "..."` kalıbı, Supabase'in
   `PostgrestError`'ı bir `Error` örneği OLMADIĞI için her veritabanı
   hatasını yedek metne düşürüyordu.

   O yutma düzeltildi (`core/domain/error-message.ts`) ve sohbet ekranı artık
   hatayı `client_errors`'a da yazıyor. Tekrarlarsa sebebi görünür olacak.

   - [ ] `client_errors` tablosunu ara ara kontrol et; `route = 'chat/send'`
   - [x] Aynı yutma kalıbı **15 çağrı yerinde** daha vardı; hepsi
         `errorMessage()`'a geçirildi (onboarding, profil, keşfet,
         sahiplendirme, sohbet, moderasyon, şikâyet, bildirimler)

1. **Güvenlik ekranları** — tamamlandı
   - Sohbetten eşleşmeyi kaldırma
   - Kullanıcı engelleme
   - Pet/kullanıcı şikâyet etme
   - Hesap silme
   - Onay ve geri dönüş durumları

2. **Gerçek cihaz ve iki hesapla uçtan uca test** — fiziksel cihaz bekliyor
   - Development build
   - İki ayrı hesapla onboarding
   - Karşılıklı beğeni
   - Eşleşme ve sohbet
   - Push bildirimi
   - Engelleme sonrası konuşmanın kapanması
   - Fotoğraf ve konum izinleri

3. **Pet profilini tamamlamak** — tamamlandı
   - Fotoğraf değiştirme/sıralama
   - Bio
   - Irk ve doğum tarihi
   - Boyut, enerji, kısırlaştırma
   - Mizaç
   - Kedi/köpek/çocuk uyumluluğu

4. **Şifre kurtarma ve hesap durumları** — tamamlandı
   - “Şifremi unuttum”
   - Reset bağlantısı/deep link
   - E-posta doğrulanmadı ekranı
   - Oturum hatalarının Türkçeleştirilmesi

5. **Yasal ve mağaza gereksinimleri** — uygulama içi teknik kapsam tamamlandı
   - Gizlilik politikası
   - Kullanım koşulları
   - KVKK aydınlatması ve açık rıza
   - Konum/fotoğraf saklama açıklaması
   - Hesap silme politikası

6. **Pet-first sosyal/dating yayın sözleşmesi** — konumlandırma kararı verildi,
   dating olarak pazarlamadan önce uygulama kapıları bekliyor
   - [x] “Petler tanıştırır. Bağınızı siz kurarsınız.” vaadi ve şeffaf ürün dili
   - [x] Pets-only / yeni insanlarla tanışmaya açık köprü deneyimi
   - [x] Ad + sahip fotoğrafı + public profil ön koşulu
   - [x] Koşullar ve gizlilik metninde arkadaşlık/romantik bağ ihtimalini açıklama
   - [ ] `pets_only | friendship | dating | friendship_or_dating` bağlantı modu
   - [ ] Karşılıklı niyet uyumluluğunu DB/RPC ve swipe yazma anında zorlama
   - [ ] Dating için açık, boş varsayımla başlayan cinsiyet ilgisi modeli;
     kullanıcının amacı üzerinden aynı/karşı cinsiyet tahmin etmeme
   - [ ] Cinsiyet ilgisi ve temel yaş aralığını ücretsiz tutma; yalnız açık
     karşılıklı ilgi örtüşüyorsa dating kartı üretme
   - [ ] Dating görünürlüğü için sahip+pet doğrulama kapısı; rozetin kapsamını
     “kimlik doğrulandı” diye abartmama
   - [ ] Kolay aşılamayan risk-temelli 18+ kapısı ve Google Play Restrict Minor Access
   - [ ] Bio/fotoğraf/mesaj içerik filtresi, yayınlanmış topluluk standardı ve
     destek iletişimi
   - [ ] App Store/Play kategori, yaş derecesi, metadata, ekran görüntüsü ve review
     notlarını gerçek deneyimle aynılaştırma
   - [ ] `2026-07-29-v2` koşullarını mevcut kullanıcılara yeniden kabul ettirme
   - [ ] Cinsiyet tercihi/yönelim gibi özel nitelikli veri toplamadan önce ayrı
     KVKK hukuki temel, açık rıza, geri alma, silme ve aktarım incelemesi
   - **Kabul testi:** pets-only ve dating niyetleri ayrışır; sistem cinsiyet
     varsaymaz; temel uyum tercihi ödeme istemez; dating ön koşulları atlanamaz;
     iki cihazda eşleşme/engelleme/rapor; mağaza ve uygulama aynı amacı söyler

## P1 — Ana deneyimi güçlendirenler

7. **Keşfet filtreleri** — tamamlandı
   - Mesafe
   - Tür
   - Yaş
   - Sahibi görünür profiller
   - Filtreleri sıfırlama

8. **Boş deste deneyimi** — tamamlandı
   - Yarıçapı genişletme önerisi
   - Filtreleri temizleme
   - “Yeni pet gelince bildir” seçeneği
   - Daha açıklayıcı boş durum

9. **Moderasyon operasyonu ve gözlemlenebilirlik** — temel operasyon tamamlandı
   - Şikâyet kuyruğunu inceleme yöntemi
   - Bildirim teslimat hataları
   - Crash/error takibi
   - Temel funnel analitiği
   - 24 saatlik moderasyon SLA takibi

10. **Profil doğrulama ve güven modeli** — temel akış tamamlandı, yayın sertleştirmesi sürüyor
   - Sahip + pet fotoğrafı gönderme
   - Bekliyor/onaylandı/reddedildi durumu
   - Doğrulanmış rozet
   - Çekim öncesi kalite/gizlilik kontrol listesi ve 24 saat hedefi
   - Aynı anda tek bekleyen başvuru, 24 saatte üç gönderim sınırı
   - Private bucket, 6 MB sınır, image MIME allow-list ve Storage nesnesi doğrulaması
   - Moderasyon kararı sonrası fotoğrafı silme
   - Onaylı sahip fotoğrafı değişince rozeti sıfırlama
   - **Sıradaki:** onay/ret için uygulama içi + push bildirimi
   - **Sıradaki:** yapılandırılmış ret nedenleri, Türkçe açıklama ve itiraz yolu
   - **Sıradaki:** aktif pet değişiminde yeniden doğrulama; çoklu pet öncesi pet bazlı rozet
   - **Sıradaki:** tekrar/aynı fotoğraf kontrolü ve riskli başvurular için ikinci moderatör
   - **Sıradaki:** dosya imzası doğrulama, güvenli yeniden kodlama ve metadata temizliği
   - **Kabul testi:** gönder → bekliyor → onay/ret → fotoğraf silme → rozet/yeniden gönderim uçtan uca

11. **Premium sohbet temeli** — tamamlandı
   - 50 mesajlık sayfalama ve eski mesajları kontrollü yükleme
   - Tarih ayraçları, balon gruplama, gönderildi/okundu durumu
   - Private Realtime Presence ile yalnız sohbet içindeyken çevrimiçi sinyali
   - Broadcast ile saklanmayan “yazıyor” sinyali
   - Kesin zaman yerine gizlilik korumalı yaklaşık son aktiflik
   - Yeni mesaj rozeti, akıllı kaydırma ve başarısız gönderimde yeniden deneme
   - Tanışma, uyumluluk ve güvenli buluşma mesaj başlangıçları
   - **Sıradaki:** konuşma bildirimini sessize alma ve sessiz saatler
   - **Sıradaki:** aktiflik/yazıyor/okundu görünürlüğü için gizlilik tercihi
   - **Sıradaki:** yapılandırılmış buluşma kartı (gün/saat/halka açık yer), kabul ve hatırlatıcı
   - **Sıradaki:** offline gönderim kuyruğu ve gerçek teslim edildi durumu
   - **Sıradaki:** okunmamış ayıracı, sohbet içi arama ve isteğe bağlı okundu bilgisi
   - **Kabul testi:** iki cihazda yazıyor/online, okundu, pagination, offline/retry ve engelleme sonrası kanal kapanması

> 5–6 için gerçek veri sorumlusu unvanı/adresi, destek e-postası, herkese açık
> politika/silme URL'leri ve hukuk incelemesi yayın sahibi tarafından
> tamamlanmalıdır. 9'un veritabanı tabanlı hata takibi hazırdır; native süreç
> crash'leri için harici bir sağlayıcı yayın sertleştirmesi olarak önerilir.

11b. **Pet profili ekranının UX kusurları** — *kartla birlikte kritik yola girdi*

   Kayıt akışı sadeleşince ırk/boyut/enerji/kısırlaştırma bu ekrana taşındı ve
   keşfetteki profil tamamlama kartı kullanıcıyı **doğrudan buraya yolluyor**.
   Yani daha önce nadiren açılan bir ekran, artık yönlendirilmiş trafiğin
   indiği yer. Onboarding incelemesinde tespit edilen ama "dar kapsam"
   seçildiği için uygulanmayan maddeler burada duruyor:

   - [x] **Pet yaşı kayıt akışıyla aynı kontrole çevrildi.** Onboarding yaşı
         kovalarla soruyordu, bu ekran hâlâ ham `YYYY-AA-GG` metin alanıydı;
         "3 yaş" seçen kullanıcı profilini açtığında `2023-08-04` görüyor,
         kendi girdiğini tanıyamıyordu. Sadeleştirmenin yarattığı
         tutarsızlıktı, kapatıldı.
   - [ ] Hata mesajları formun altında tek kutuda; hatalı alanın altında
         satır içi gösterilmeli
   - [ ] Fotoğraf eklemede kamera seçeneği yok (galeri-only); doğrulama
         akışında kamera zaten kullanılıyor

   > **Not:** İlk incelemede "enerji çıplak rakam" ve "kısırlaştırma toggle
   > etiketi değişiyor" diye iki madde daha yazılmıştı. Kod okunduğunda ikisi
   > de bu ekran için **yanlış** çıktı: enerji satırının üstünde
   > "1 çok sakin, 5 çok enerjik" açıklaması var ve kısırlaştırma sabit
   > etiketli bir `Switch`. Bu iki kusur **onboarding**'deki versiyonlardaydı
   > ve sadeleştirmeyle birlikte zaten kalktı.

12. **Sahiplendirme arayüzü** — *kod hazır, bayrakla gizli*

    Yüzey çalışır durumda (DB, RLS, RPC'ler, ekran, testler) ama
    `core/features.ts` içindeki `FEATURES.adoption` **kapalı**: ürünün ana
    döngüsü — pet profili, keşfet, eşleşme, sohbet — olgunlaşana kadar
    kullanıcıya gösterilmiyor. `/adoption` rotası duruyor, doğrudan
    gidilirse çalışıyor.

    Açmadan önce:
    - [ ] Ana döngünün gerçek kullanıcıyla çalıştığı doğrulanmış olmalı
    - [ ] `pause_stale_adoption_listings()` zamanlanmalı — `pg_cron` kurulu
          değil, yani şu an bayat ilanları kimse duraklatmıyor
    - [ ] Doğrulama şartı (`0010`) ve 7332 sayılı kanun gereği satış
          caydırıcılığı metinleri gözden geçirilmeli
13. **Tam çok dil yayını** — altyapı ve Türkçe katalog düzeni hazır
    - [x] `expo-localization` + `i18n-js`, fallback ve Android foreground sync
    - [x] Type-safe Türkçe/İngilizce örnek katalog yapısı
    - [x] Locale-aware tarih formatı ve onboarding'de güvenli dil tercihi RPC'si
    - [x] Native metadata/izin çevirisi ve işletim sistemi app-language hazırlığı
    - [ ] Kalan hard-coded UI, hata, yasal, e-posta ve push metinlerini kataloğa taşı
    - [ ] İngilizce insan çeviri/yerelleştirme QA'sı sonrası yayın listesine al
    - [ ] Uzun metin, çoğul, tarih/saat, ekran okuyucu ve iki cihaz kabul testi
14. **Google ve Apple ile giriş**
15. **Çoklu pet desteği**
16. **Premium / boost / kim beğendi özellikleri**
17. **Hayvan kabul eden mekânlar — öneri ve sponsorluk**
    Yapı `0038` ile zaten kurulu: `meetup_places` bölge + doğrulama taşıyor,
    mekân eklemek yeni tablo değil yeni satır demek. Kafeler bu tablonun
    ikinci türü olur.
    - [ ] `meetup_places`'e `kind` (park · kafe) ve sponsorluk alanları
    - [ ] Mekân başvuru akışı — işletme kendi kaydını öneriyor, moderasyon onaylıyor
    - [ ] **Sponsorlu mekân ayırt edilebilir olmalı**; reklam olduğu açıkça
      etiketlenmeli (yasal zorunluluk ve güven meselesi)
    - [ ] **Sponsorluk doğrulamanın yerine geçmez**: parası ödenmiş ama gerçekten
      hayvan kabul etmeyen bir mekân, güvenlik vaadini bozar. Sponsorluk
      görünürlüğü artırır, doğrulama şartını kaldırmaz.
    - [ ] Sıralamada sponsorlu mekân küratörlü listeyi bastırmamalı
    Gelir tarafı [`monetization.md`](monetization.md) faz 3–4 ile aynı çizgide:
    kullanıcı ödemez, işletme öder.
