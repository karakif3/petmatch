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
> ## Yayından önce silinecek test hesapları
>
> | Hesap | İçerik |
> |---|---|
> | `test1@petmatch.app` | Pet "Luna" · **moderatör (admin)** |
> | `test2@petmatch.app` | Peti yok |
> | `deniz` · `ece` · `mert` · `ayse` **@petmatch.test** | Pet + fotoğraf + **herkese açık sahip profili ve avatarı** |
> | `selin` · `kaan` **@petmatch.test** | Pet + fotoğraf · görünürlük `after_match` |
> | `burak` · `elif` **@petmatch.test** | Pet + fotoğraf · görünürlük `hidden` |
>
> Şifre (hepsi): `Petmatch2026!`
>
> `@petmatch.test` hesapları keşfet destesini doldurmak için 2026-08-04'te
> üretilen **tohum veriydi**: 8 pet, hepsi Kadıköy bölgesinde,
> `goals = {playdate}`, birer yer tutucu fotoğraflı. Dördünün sahip avatarı
> var — sahip segmenti (`OWNER_SEGMENT_MIN_CARDS = 3`) bu sayede test
> edilebiliyor.
>
> Silerken `auth.users` satırını kaldırmak yeterli (pets, pet_photos ve
> profiles FK ile cascade oluyor), ama **storage nesneleri cascade
> OLMUYOR**: `pet-photos/{userId}/…` ve `owner-avatars/{userId}/avatar.jpg`
> ayrıca silinmeli.

Şifre sıfırlama, doğrulama e-postasını yeniden gönderme, mobil deep link,
PKCE `code` değişimi ve Türkçe hata durumları uygulamada hazırdır.

## Şifre politikası — istemci 8, sunucu 6

`core/domain/credentials.ts` yeni şifrelerde **en az 8 karakter + harf +
rakam** istiyor (kayıt ve şifre sıfırlama ekranlarında canlı gösteriliyor).
Supabase'in sunucu tarafı asgarisi ise hâlâ **6**.

Bu ikisi bilerek ayrı:

- **Giriş formunda kural UYGULANMIYOR.** Sunucu 6'ya izin verdiği için
  6-7 karakterle açılmış hesaplar var; girişte 8 dayatmak kullanıcıyı DOĞRU
  şifresiyle kendi hesabından kilitler.
- Yeni şifre üreten her akış (kayıt · sıfırlama) 8 kuralını uyguluyor, yani
  yeni hesaplar zaten güçlü.

- [ ] **Yayından önce:** Dashboard → Authentication → Policies → Minimum
      password length **8** yapılmalı. O zamana kadar istemci tek savunma
      hattı; API'ye doğrudan giden bir istemci 6 karakterle hesap açabilir.

Supabase Dashboard → Authentication → URL Configuration altında:

- [x] **`petmatch://**` allow list'e eklendi** (2026-08-06). Uygulama
      `Linking.createURL("auth/callback")` kullanıyor; dev-client ve
      standalone build'de bu `petmatch://auth/callback` üretiyor
      (`exp://` yalnızca Expo Go'da geçerli, onu kullanmıyoruz).
- [x] **`Site URL` = `petmatch://auth/callback`** yapıldı. Uygulama her
      çağrıda `emailRedirectTo`/`redirectTo` gönderdiği için Site URL sadece
      yedek; ama `http://localhost:3000` kalsaydı yedeğe düşen her e-posta
      bağlantısı kırık açılırdı.
- [ ] Web yayına alındığında gerçek callback URL'si allow list'e eklenmeli ve
      `Site URL` web alanına çevrilmeli — o noktada `petmatch://**` de
      listede kalmalı, mobil onsuz çalışmaz.
- [ ] E-posta şablonlarındaki callback bağlantıları `{{ .RedirectTo }}`
      değerini korumalı (özel SMTP yokken şablonlar düzenlenemiyor).

Supabase resmi dokümantasyonu:

- https://supabase.com/docs/guides/auth/redirect-urls
- https://supabase.com/docs/guides/auth/native-mobile-deep-linking

Fiziksel cihaz kontrolü backlog 2 kapsamında yapılır: şifre sıfırlama e-postası
istenir, bağlantı development build'i açar, yeni şifre kaydedilir ve kullanıcı
yeni şifreyle tekrar giriş yapar. Tam iki cihaz matrisi:
[`two-device-release-test.md`](two-device-release-test.md).
