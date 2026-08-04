# Auth yayın kontrolü

> ## ⛔ AÇIK RİSK — `Confirm email` KAPALI (2026-08-04)
>
> Simülatör testini hızlandırmak için `mailer_autoconfirm = true` yapıldı:
> **kayıtta e-posta doğrulaması istenmiyor, adres doğrulanmadan hesap
> açılıyor.** Bu geçici bir test ayarıydı.
>
> **Yayından önce geri alınmalı.** Açık kalırsa herkes başkasının
> e-posta adresiyle hesap açabilir; şifre sıfırlama akışı da o hesabın
> gerçek sahibine kaptırılabilir.
>
> Geri alma — Dashboard → Authentication → Providers → Email → **Confirm
> email** açık; ya da:
>
> ```
> PATCH /v1/projects/ktlefybtankyywxuafvh/config/auth
> {"mailer_autoconfirm": false}
> ```
>
> Doğrulama: yeni bir adresle kayıt ol, giriş **engellenmeli**.
>
> Aynı anda açılan test hesapları (`test1@petmatch.app`,
> `test2@petmatch.app`) da yayından önce silinmeli.

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
