# Moderasyon ve gözlemlenebilirlik runbook'u

## İlk moderatorü ata

Bu işlem yalnızca Supabase SQL Editor'da service-role yetkili bir operatör
tarafından yapılır:

```sql
insert into app_user_roles (user_id, role)
values ('<auth-user-uuid>', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

Moderator uygulamada `/moderation` deep link'ini açar. Normal kullanıcılar
kuyruğu, fotoğrafları veya metrikleri okuyamaz. Kuyruk en eski kayıtla başlar;
24 saati aşanlar kırmızı işaretlenir. Ret kararında denetim notu zorunludur.
Doğrulama kararı profil durumunu ve keşfetteki rozeti aynı transaction içinde
günceller.

## Her vardiyada kontrol

1. 24 saati aşmış bekleyen kayıtları önce incele.
2. Profil doğrulama fotoğrafında aynı karede sahip ve aktif petin bulunduğunu
   kontrol et; kimlik belgesi isteme.
3. Şikâyetleri bağlamıyla değerlendir; şikâyet sayısı otomatik ban sebebi
   değildir.
4. Son 24 saatte push hatası ve istemci hatası sayaçlarını kontrol et.
5. Tekrarlayan hata varsa Supabase `notification_deliveries.last_error` ve
   `client_errors` kayıtlarını service-role ile incele; kullanıcı mesajı veya
   fotoğrafını tanılama sistemine kopyalama.

## Temel funnel

Operasyon ekranı son 7 gün için onboarding → keşfet → swipe → match → mesaj
olay sayılarını gösterir. Bu sayaçlar ürün sağlığı içindir; reklam profillemesi
yapılmaz ve olay özelliklerine serbest metin/fotoğraf konmaz.

## Sınırlama

React hata sınırı render hatalarını veritabanına yazar. Native süreç çökmesi,
uygulama açılmadan oluşan hata ve offline crash için yayın öncesinde ayrı bir
native crash sağlayıcısı (ör. Sentry/Crashlytics) eklenmesi önerilir.
