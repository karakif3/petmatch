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
2. Profil doğrulama fotoğrafında aynı karede sahip ve aktif petin bulunduğunu,
   yüzün/petin net göründüğünü ve görünür sahip fotoğrafı varsa aynı kişiye ait
   olduğunu kontrol et. Kimlik belgesi isteme.
3. Şikâyetleri bağlamıyla değerlendir; şikâyet sayısı otomatik ban sebebi
   değildir.
4. Son 24 saatte push hatası ve istemci hatası sayaçlarını kontrol et.
5. Tekrarlayan hata varsa Supabase `notification_deliveries.last_error` ve
   `client_errors` kayıtlarını service-role ile incele; kullanıcı mesajı veya
   fotoğrafını tanılama sistemine kopyalama.

Pet-first sosyal/dating modu mağazada açılmadan önce moderasyon kapsamı yalnız
şikâyet kuyruğuna tepki vermekle sınırlı kalmamalıdır. Yayınlanmış topluluk
standardı; taciz, cinsel içerik, reşit olmayanlarla temas, dolandırıcılık,
hayvan satışı/istismarı, nefret, taklit profil ve ısrarlı çevrimdışı temas
kategorilerini ayrı ayrı tanımlamalıdır. Bio/fotoğraf için yayın öncesi
uygunsuz içerik filtresi, mesaj için hız/link risk kontrolleri ve her kategoride
kanıt saklama/silme süresi tanımlanmadan dating pazarlaması açılmaz.

## Doğrulama karar standardı

- **Onay:** Tek yetişkin ve başvurudaki aktif pet aynı karede, yeterince net ve
  görünür sahip fotoğrafıyla çelişmiyor.
- **Ret — kişi/pet görünmüyor:** Kadrajda ikisi birlikte veya yeterince net değil.
- **Ret — profil uyuşmuyor:** Fotoğraf, görünür sahip profili ya da aktif petle
  açıkça çelişiyor.
- **Ret — fotoğraf uygun değil:** Filtre, ekran görüntüsü, birden fazla kişi,
  kimlik belgesi veya karar vermeyi engelleyen başka içerik var.
- Ret notuna yalnız kararın düzeltilmesini sağlayacak kısa açıklamayı yaz;
  kişinin görünüşü hakkında yorum veya hassas veri ekleme.
- Karar sonrasında doğrulama fotoğrafının Storage nesnesinin silindiğini kontrol
  et. Silme hatası varsa aynı vardiyada tekrar dene ve olay kaydı aç.
- Aynı hesabın tekrarlayan veya şüpheli başvurusunda tek başına otomatik ban
  verme; ikinci moderatör incelemesine yönlendir.
- Rozeti yalnız “sahip ve aktif pet aynı karede moderasyonla görüldü” anlamında
  kullan; resmi kimlik, yaş veya kişinin hukuki kimliği doğrulanmış izlenimi verme.

## Temel funnel

Operasyon ekranı son 7 gün için onboarding → keşfet → swipe → match → mesaj
olay sayılarını gösterir. Bu sayaçlar ürün sağlığı içindir; reklam profillemesi
yapılmaz ve olay özelliklerine serbest metin/fotoğraf konmaz.

## Sınırlama

React hata sınırı render hatalarını veritabanına yazar. Native süreç çökmesi,
uygulama açılmadan oluşan hata ve offline crash için yayın öncesinde ayrı bir
native crash sağlayıcısı (ör. Sentry/Crashlytics) eklenmesi önerilir.
