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

## P1 — Ana deneyimi güçlendirenler

6. **Keşfet filtreleri** — tamamlandı
   - Mesafe
   - Tür
   - Yaş
   - Sahibi görünür profiller
   - Filtreleri sıfırlama

7. **Boş deste deneyimi** — tamamlandı
   - Yarıçapı genişletme önerisi
   - Filtreleri temizleme
   - “Yeni pet gelince bildir” seçeneği
   - Daha açıklayıcı boş durum

8. **Moderasyon operasyonu ve gözlemlenebilirlik** — temel operasyon tamamlandı
   - Şikâyet kuyruğunu inceleme yöntemi
   - Bildirim teslimat hataları
   - Crash/error takibi
   - Temel funnel analitiği
   - 24 saatlik moderasyon SLA takibi

9. **Profil doğrulama ekranı** — tamamlandı
   - Sahip + pet fotoğrafı gönderme
   - Bekliyor/onaylandı/reddedildi durumu
   - Doğrulanmış rozet

> 5 için gerçek veri sorumlusu unvanı/adresi, destek e-postası, herkese açık
> politika/silme URL'leri ve hukuk incelemesi yayın sahibi tarafından
> tamamlanmalıdır. 8'in veritabanı tabanlı hata takibi hazırdır; native süreç
> crash'leri için harici bir sağlayıcı yayın sertleştirmesi olarak önerilir.

## P2 — Ana MVP sonrasında

10. **Sahiplendirme arayüzü**
11. **Dil ayarı ve gerçek i18n**
12. **Google ve Apple ile giriş**
13. **Çoklu pet desteği**
14. **Premium / boost / kim beğendi özellikleri**
