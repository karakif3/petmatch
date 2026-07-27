# Auth yayın kontrolü

Şifre sıfırlama, doğrulama e-postasını yeniden gönderme, mobil deep link,
PKCE `code` değişimi ve Türkçe hata durumları uygulamada hazırdır.

Supabase Dashboard → Authentication → URL Configuration altında:

- Development/standalone uygulama için `petmatch://**` Additional Redirect URL
  listesine eklenmeli.
- Web yayına alındığında kesin üretim callback URL'si ayrıca eklenmeli.
- Üretim `Site URL` değeri gerçek web alanına ayarlanmalı.
- E-posta şablonlarındaki callback bağlantıları `{{ .RedirectTo }}` değerini
  korumalı.

Supabase resmi dokümantasyonu:

- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/native-mobile-deep-linking

Fiziksel cihaz kontrolü backlog 2 kapsamında yapılır: şifre sıfırlama e-postası
istenir, bağlantı development build'i açar, yeni şifre kaydedilir ve kullanıcı
yeni şifreyle tekrar giriş yapar.
