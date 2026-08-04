# Deneyim yol haritası

Bu dosya "premium ve güvenilir hissettiren" tarafın planı: mikroanimasyonlar,
buluşma akışı, sohbette medya, sesli görüşme, petsiz kullanıcılar, ilgi
alanları ve çok dil. Hiçbiri MVP kapıcısı değil; sırası ve **gerekçesi**
burada.

Yetkili sıra hâlâ [`backlog.md`](backlog.md). Burası "ne yapacağız"dan çok
"neden böyle yapacağız" dosyası.

---

## 1. Mikroanimasyonlar

**Bugünkü durum:** `react-native-reanimated` kurulu ama **tek dosyada**
kullanılıyor — `components/match-celebration.tsx`. Yani kütüphane var,
yatırım yok.

### İlke: animasyon süs değil, durum bildirimi

Güven "hoş görünmek"ten değil, **ne olduğunu görebilmek**ten geliyor. Mesaj
gitti mi, kart destede kaldı mı, fotoğraf kapak oldu mu — kullanıcı bunları
tahmin etmek zorunda kalmamalı. Bu yüzden aşağıdaki liste sıklık ve
belirsizlik giderme değerine göre sıralı, "en havalı"ya göre değil.

**Erişilebilirlik zorunlu:** `match-celebration` zaten
`AccessibilityInfo.isReduceMotionEnabled()` kontrol ediyor. Eklenecek her
animasyon aynısını yapacak — hareket azaltma açıkken animasyon değil, son
durum gösterilecek.

### Sıra

| # | An | Ne | Neden |
|---|---|---|---|
| 1 | **Swipe kartı** | Kart parmağı takip etsin, hafif dönsün, eşikte "beğen/geç" damgası belirsin | Dating ürününün imza etkileşimi. Şu an sadece iki düğme var; kaydırma hissi hiç yok. **Tek en büyük kazanç.** |
| 2 | **Mesaj gönderimi** | Balon aşağıdan ölçeklenerek girsin, "Gönderildi" onayı yumuşak geçsin | En sık tekrarlanan an. Ağ yavaşken "gitti mi?" belirsizliğini kaldırır. |
| 3 | **Gelen mesaj** | Soldan yumuşak giriş + hafif haptik | Realtime'ın canlı olduğunu hissettirir; şu an liste birden değişiyor. |
| 4 | **Yazıyor göstergesi** | Üç noktanın sıralı nabzı | Karşı tarafın orada olduğunu göstermek güven veren en ucuz sinyal. |
| 5 | **Beğen/geç düğmesi** | Basışta ölçek sıçraması + haptik | Dokunuşun kaydedildiğini anında bildirir. |
| 6 | **Profil tamamlama çubuğu** | Değere doğru animasyonla dolsun | İlerleme hissi; şu an statik. |
| 7 | **Kapak fotoğrafı değişimi** | Çapraz geçiş | Küçükten kapağa terfi ederken ne olduğu net olsun. |
| 8 | **Deste yenilenmesi** | Kartlar kademeli girsin | Boş desteden dolu desteye geçiş şu an sert. |

> 1 ve 2 yapılmadan diğerlerine geçmek yanlış olur: ilki ürünün imza
> etkileşimi, ikincisi en sık tekrarlanan an.

---

## 2. Buluşma ayarlama ve takvim

**Bugünkü durum:** Sohbette "Buluşma planla" hızlı yanıtı var ama sadece
metin yazıyor. `meetup_places` (0038) doğrulanmış yerleri tutuyor,
`meetup_feedback` (0036) "buluştunuz mu?" diye soruyor — **ama arada
buluşmanın kendisi bir kayıt olarak yok.** Geri bildirim şu an tahmine
dayanıyor.

### Doğru sıra: önce yapılandırılmış buluşma, sonra takvim

1. **Buluşma önerisi bir kayıt olsun** — yer (`meetup_places`'ten), tarih,
   saat; karşı taraf onaylar/reddeder/başka saat önerir. Sohbette normal
   mesaj değil, ayrı bir kart olarak görünür.
   - Bu, `meetup_feedback`'i tahminden **ölçüme** çevirir: "geçen cumartesi
     Yoğurtçu Parkı'ndaki buluşma nasıl geçti?" diye sorabiliriz.
   - Ürünün başarı metriği zaten "kaç konuşma buluşmaya döndü"
     ([`benchmark.md`](benchmark.md)); o metrik ancak buluşma kayıtken ölçülür.
2. **Takvime ekle** — `expo-calendar` (kurulu değil). Onaylanan buluşma için
   "Takvime ekle" düğmesi; başlık, yer ve saat dolu gelir.
   - Takvim izni ayrı ve hassas bir izin; **buluşma onaylanmadan istenmemeli.**
   - İzin verilmezse akış bozulmamalı — buluşma kaydı uygulama içinde durur.

> Takvimi önce yapmak cazip ama yanlış: takvime yazacak yapılandırılmış bir
> buluşma olmadan sadece "not al" düğmesi olur.

---

## 3. Sohbette fotoğraf gönderme

**Karar: evet, ama moderasyon kapasitesi olmadan açılmamalı.**

Beklenen bir özellik ve pet paylaşmak bu üründe doğal. Ama istenmeyen müstehcen
görsel, tanışma uygulamalarının **en klasik güvenlik sorunu** ve Apple 1.2
kullanıcı içeriği için moderasyon şart koşuyor.

Açmadan önce gerekenler:

- [ ] Ayrı storage bucket + RLS (yalnızca konuşmanın iki tarafı okuyabilir)
- [ ] Görsel için şikâyet akışı — mevcut `moderation_items` genişletilir
- [ ] **Yeni eşleşmede ilk görsel bulanık gelsin**, alıcı açmayı seçsin
- [ ] Moderasyon kuyruğunda görsel önizleme ve 24 saat SLA'nın işlediğinin
      teyidi ([`moderation-runbook.md`](moderation-runbook.md))

Bunlar hazır olmadan açmak, kapatması zor bir taciz yüzeyi açmak olur.

---

## 4. Sesli görüşme

**Karar: güven özelliği olarak planla, faz 3. MVP değil.**

Değeri eğlence değil **doğrulama**: buluşmadan önce karşı tarafın gerçek bir
insan olduğunu anlamak. Hinge ve Bumble'ın bu özelliği koymasının sebebi de bu.

Kurallar (sektör standardı ve doğrusu):

- Yalnızca eşleşme sonrası, **uygulama içi** — telefon numarası paylaşılmaz
- Her iki taraf da tek dokunuşla bitirebilir; kapatan taraf cezalandırılmaz
- Kayıt yok
- Engelleme aramayı da kapatır

Maliyet gerçek: WebRTC altyapısı (LiveKit/Daily/Twilio) dakika başına
ücretlendirir. Yoğunluk oluşmadan açmak parayı boşa harcamak olur — pilot
metrikleri ([`launch.md`](launch.md)) bunu söyleyecek.

---

## 5. Petsiz kullanıcılar — büyüme fazı

Fikir: son fazda peti olmayanları da kabul edip büyümeyi hızlandırmak;
isteyen pet sahibi petsizlere görünmez olabilsin.

**Büyüme mantığı doğru ama uygulama biçimi ürünün tezini bozabilir.**
Açıkça yazmakta fayda var:

### Riskli hali

Petsizleri **eşleşme destesine** koymak. İki sorun:

1. `goal-model.md`'nin tamamı "hikâye petin etrafında döner" üzerine kurulu.
   Petsiz kullanıcının destede eşleşecek bir şeyi yok — uyum skoru pet
   üzerinden hesaplanıyor.
2. Ayrım yapıcı bir ürün olur: "petsizlere görünme" seçeneği iki katmanlı bir
   deste yaratır ve dışlanan taraf bunu hisseder.

### Önerilen hali

Petsiz kullanıcı **ayrı bir yüzey**, destenin bir segmenti değil:

- **Sahiplendirme** — zaten böyle tasarlandı: `goal-model.md`, petsiz kullanıcı
  için Keşfet'in ZATEN sahiplendirme yüzeyi olduğunu söylüyor
- **Buluşma ve etkinlikler** — hayvan sevenler parkta buluşabilir, bunun için
  pet sahibi olmak gerekmiyor
- **Dönüşüm** — petsiz kullanıcı sahiplenince ana döngüye girer

Böylece hem büyüme elde edilir hem "pet-first" tezi korunur. Kullanıcının
istediği "hayvan sevenleri bir araya toplamak" bu şekilde de oluyor —
üstelik daha savunulabilir bir biçimde.

- [ ] Karar bekliyor: petsiz kullanıcı ayrı yüzey mi, deste segmenti mi

---

## 6. İlgi alanları

**Karar: evet, ama sahip profilinde ve sonradan.**

Kayıt akışının sadeleştirilmesiyle tutarlı: ilgi alanı zorunlu değil,
kullanıcı ürünü gördükten sonra profil tamamlama kartından dolduruyor.
`owner_social_open` zaten var; ilgi alanları sahip-sahip uyumunu anlamlı kılar.

Kurallar:

- **Sabit taksonomi, serbest metin değil** — yoksa filtrelenemez ve
  moderasyon yüzeyi olur
- **KVKK m.6 sınırı:** din, siyasi görüş, sağlık, cinsel yaşam gibi özel
  nitelikli veriye giren başlıklar taksonomiye GİRMEZ. Cinsiyet filtresinde
  aynı gerekçeyle ayrı davranmıştık ([`goal-model.md`](goal-model.md)).
- Pet ile ilgili olanlar (yürüyüş, çeviklik, kedi davranışı) ve nötr yaşam
  tarzı başlıkları (kahve, doğa yürüyüşü, fotoğraf) güvenli alan

---

## 7. Çok dil — "ne kadar kolay" sorusunun dürüst cevabı

**Altyapı hazır, içerik hazır değil.**

| Parça | Durum |
|---|---|
| `expo-localization` + `i18n-js`, fallback, Android sync | ✅ var |
| Type-safe katalog yapısı | ✅ var |
| Locale'e duyarlı tarih | ✅ var |
| Native metadata / izin metinleri | ✅ var |
| **Katalog içeriği** | ❌ `tr.ts` 19 satır, `en.ts` 22 satır |
| **Ekranlardaki metinler** | ❌ **~250 sabit Türkçe metin** doğrudan bileşenlerde |

Yani "İngilizce'yi açalım" dediğimizde bir bayrak çevirmiyoruz; ~250 metni
kataloğa taşımak gerekiyor. Mekanik ama küçük değil — ve taşırken çoğul,
tarih/saat ve uzun metin taşması gibi işler de çıkar.

**İyi haber:** boru hattı kurulu olduğu için bu iş *artımlı* yapılabilir.
Ekran ekran taşınabilir, yarım kalmış hali kırılma yaratmaz (fallback var).

Öneri: yeni yazılan her ekran metni doğrudan kataloğa yazılsın, böylece borç
büyümesin. Mevcut 250 metin ise ekran ekran, başka iş yaparken temizlensin.

---

## Sıralama önerisi

Yoğunluk oluşmadan yapılması anlamsız olanları sona bıraktım:

1. **Swipe kartı animasyonu** — imza etkileşim, yoğunluktan bağımsız
2. **Mesaj gönderim/alım animasyonları** — en sık an
3. **İlgi alanları** — profil tamamlama kartına doğal ekleme
4. **Yapılandırılmış buluşma kaydı** — başarı metriğini ölçülebilir kılar
5. **Takvime ekleme** — 4'ün üstüne
6. **Sohbette fotoğraf** — moderasyon kapasitesi şartıyla
7. **Petsiz kullanıcı yüzeyi** — karar verildikten sonra
8. **Sesli görüşme** — yoğunluk ve gelir oluştuktan sonra
9. **İngilizce katalog** — yayın hedefi belirlenince
