# PetMatch ürün backlog'u

Bu dosya yayın öncesi işlerin tek ve numaralı referansıdır. Sıra değiştirilirse
README yerine önce bu dosya güncellenir.

## P0 — Yayın öncesi kritik

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
   - **Kabul testi:** pets-only ve dating niyetleri ayrışır; dating ön koşulları
     atlanamaz; iki cihazda eşleşme/engelleme/rapor; mağaza ve uygulama aynı amacı söyler

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

## P2 — Ana MVP sonrasında

12. **Sahiplendirme arayüzü**
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
