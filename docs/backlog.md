# PetMatch ürün backlog'u

Bu dosya yayın öncesi işlerin tek ve numaralı referansıdır. Sıra değiştirilirse
README yerine önce bu dosya güncellenir.

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
   - [ ] Aynı yutma kalıbı başka ekranlarda da var; hepsi `errorMessage()`'a
         geçirilmeli

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
