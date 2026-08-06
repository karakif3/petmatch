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

## 6. İlgi alanları — ✅ yapıldı (veri + profil kartı)

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

`0041_owner_interests.sql`: `profiles.interests text[]`, sabit 16'lık
taksonomi (`core/domain/types.ts`'te `OWNER_INTERESTS`) `update_my_owner_details`
RPC'sinde doğrulanıyor (tekrarsız, en fazla 8, listede olmayan değer
reddediliyor). Sahip profili ekranında çip seçimi, profil tamamlama kartında
eksik madde olarak eklendi (`ownerInterests`). Uyum skoruna bağlama ve 5.
sekme (§6c) bilerek KAPSAM DIŞI — bu tur yalnızca veri toplamayı açtı.

---

## 6b. Keşfet etkileşimi: kaydırma, süper beğeni, sahibe geçiş

Üçü de **bugün yok**; ölçüldü, varsayılmadı.

### Sağa/sola kaydırma — ✅ yapıldı

`components/swipeable-card.tsx`. Kart parmağı takip ediyor, hafifçe dönüyor,
eşiğe yaklaşırken BEĞEN/GEÇ damgası beliriyor ve bırakınca uçup gidiyor.
Kısa bir fiske de karar sayılıyor (hız eşiği).

Simülatörde doğrulandı: sağa kaydırma eşleşme üretti, sola kaydırma geçti;
`swipes` tablosunda yönler doğru kaydedildi.

> Düğmeler **kalmalı**: kaydırma keşfedilebilir değil ve erişilebilirlik
> açısından tek başına yeterli olmaz. İkisi bir arada.

### Beğeniler sekmesi — ✅ yapıldı

4. sekme oldu (Keşfet · Beğeniler · Eşleşmeler · Profil). `0042_likes_tab.sql`:
`pending_likes_count()` her zaman gerçek sayı; `pending_likes()` kart
verisini `discover_playdate_pets` ile aynı şekilde döndürüyor (aynı satır
şekli, `mapDiscoveryRow`/`ownerSummary` doğrudan yeniden kullanıldı).
"Pending" = biri petimi beğendi ve ben ona (herhangi bir yönde) henüz
karşılık vermedim; karşılık verdiğim an — eşleşme ya da geçme — düşer.

monetization.md'nin "ücretsiz = sayı, ücretli = kimlik" ayrımı gerçek bir
ödeme katmanı olmadan (Faz 0) uygulandı: istemci tarafı kartları
`blurRadius={60}` + `bg-black/70` örtüyle bulanıklaştırıyor, isim/bio hiç
render edilmiyor (bulanık metin ekran görüntüsünde okunabilir kalabilir,
görüntülemenin en garantili yolu hiç yazmamak). Tuzak: seed fotoğraflarına
gömülü isim yazısı `blurRadius={22}`'yi net biçimde deldi — testte fark
edildi, `60`'a çıkarılıp koyu örtü eklenince kapandı.

RLS gevşetilmedi; katman ayrımı iki SECURITY DEFINER fonksiyonun içinde.
`pending_likes()` da 0024'ün belgelediği RETURNS TABLE tuzağına düştü:
`where id = auth.uid()` OUT parametresiyle çakışıp "ambiguous" hatası verdi,
`where profiles.id = ...` ile düzeldi. `supabase/tests/likes.test.sql`
davranışı kilitliyor (cevapsız/engellenen/eşleşen/geçilen dört senaryo).

React Native'de `refetchOnWindowFocus` çalışmıyor — sekmeler arası geçişte
liste anında güncellenmiyordu (simülatörde yakalandı). `matches.tsx`'teki
`refetchInterval: 15_000` deseni buraya da uygulandı; ayrıca bir swipe
sonrası `["pending-likes"]` invalidate ediliyor.

**Bilinçli yumuşatma:** beğenen tarafın sahibi `owner_social_open` ise (bu
zaten `public` görünürlük + ad + avatar şartına bağlı — yani Keşfet'te
teşhis edilebilir) kart açık gösteriliyor: gerçek fotoğraf, sahibin küçük
yuvarlak avatarı sol üstte, alt bantta pet adı + sahip adı. Yeni bir kimlik
sızdırmıyor, sadece "bu kişi seni beğendi" eşlemesini bu kohort için erken
açıyor. Gerçek premium eklenince koşul `socialOpen || isPremium` olacak.

**Sonraki tur (kapsam dışı bırakıldı):** gerçek ödeme/entitlement kontrolü,
süper beğeni, "buluştunuz mu?" verisini sıralamaya bağlamak.

### Süper beğeni — yok, ve şema değişikliği istiyor

`swipe_direction` enum'ı yalnızca `('like', 'pass')`. Süper beğeni eklemek
üç şey gerektiriyor:

1. **Şema:** enum'a yeni değer. Dikkat — PostgreSQL'de `alter type ... add
   value` bazı sürümlerde transaction içinde çalışmaz; migration'lar
   transaction'da koştuğu için ayrı bir migration ve muhtemelen enum yerine
   ayrı bir kolon (`is_super boolean`) daha güvenli. Karar verilirken
   ölçülmeli.
2. **Ürün kuralı:** süper beğeni ne YAPAR? Sektör standardı: karşı tarafın
   destesinde öne çıkarsın ve beğeninin süper olduğu görünsün. Yani
   "Beğeniler" sekmesi ve sıralama ile doğrudan bağlantılı — o sekme
   olmadan süper beğeninin gösterileceği yer yok.
3. **Gelir kuralı:** [`monetization.md`](monetization.md)'de süper beğeni
   geçmiyor. Eklenecekse oraya, "asla satılmayacaklar" listesiyle birlikte
   değerlendirilmeli.

**Sıra:** Beğeniler sekmesi → süper beğeni. Tersi olmaz.

### Sahibe tıklayıp profiline geçme — ✅ yapıldı

Kartta sahip bloğu (ad, avatar, bio) render ediliyor ama **tıklanabilir
değil.** Görünürlüğü `public` olan bir sahibin fotoğrafını ve bio'sunu
görüp devamını görememek yarım kalmış bir vaat.

Yapılırken iki kural:

- **Tam ekran değil, alttan açılan panel.** Deste bağlamı kaybolmamalı;
  kullanıcı bakıp kapatıp kaydırmaya devam edebilmeli.
- **Görünürlük kuralına uymalı.** `hidden` sahipte hiç tıklanabilir olmamalı;
  `after_match`'te ancak eşleştikten sonra açılmalı. Panelin içeriği zaten
  RPC'nin verdiğiyle sınırlı — istemci ek veri çekmemeli, yoksa
  `0021`'deki karşılıklı açıklama kuralı istemci tarafından delinir.

Aynı geçiş **sohbetteki sahip şeridinde** de yapıldı — `components/owner-sheet.tsx`,
kartta ve sohbette aynı bileşen. Simülatörde uçtan uca doğrulandı: görünür
sahip için panel açılıp kapanıyor, `after_match` sahipte (henüz eşleşmemiş)
blok hiç render edilmediği için panel de açılamıyor.

---

## 6c. Beşinci sekme: topluluklar ve etkinlikler

**Not: 5. sekmeye karar VERİLMEDİ.** Öneri 4 sekmeydi
(Keşfet · Beğeniler · Sohbetler · Profil) ve 5.'ye karşı gerekçe
`goal-model.md`'de yazılı: *"Boş bir tab uygulamanın ölü olduğunu söyler."*

### Öneri: ilgi alanı toplulukları + etkinlik feed'i

Fikir şu: ilgi alanlarına göre topluluklar, aralarına etkinlikler serpilmiş
bir feed, "Katıl" düğmesiyle başvuru toplama.

**Bu fikir üç ayrı ipi birbirine bağlıyor** ve bu yüzden güçlü:

- **İlgi alanları** (§6) zaten planda — topluluğun tanımı onlardan çıkıyor
- **`meetup_places`** (`0038`) doğrulanmış yerleri zaten tutuyor —
  etkinliğin mekânı hazır
- **Petsiz kullanıcılar** (§5) için önerdiğim "ayrı yüzey" tam olarak bu
  olabilir: hayvan seven ama peti olmayan kişi topluluğa girer, etkinliğe
  katılır, sahiplenirse ana döngüye geçer

Yani ayrı ayrı düşündüğümüz üç şey tek bir sekmede buluşuyor.

### Ama sekme olarak ŞİMDİ açılmamalı

Pilot Kadıköy + Nişantaşı. O yoğunlukta topluluk feed'i boş açılır ve boş
sekme ürünün ölü olduğunu söyler — sahiplendirme girişini tam da bu yüzden
tab yerine **içeriğe bağlı kart** yapmıştık.

**Önerilen sıra:**

1. İlgi alanları toplansın (§6) — topluluk tanımının hammaddesi
2. Etkinlikler önce **Keşfet'te kart** olarak çıksın, sahiplendirme
   girişindeki desenle: gerçekten etkinlik varsa görünür, yoksa hiç
3. Kart düzenli doluyor ve tıklanıyorsa **o zaman** sekmeye terfi etsin

Terfi kararı tahminle değil veriyle verilir — `product_events` zaten
`discovery_segment_changed` gibi sinyalleri topluyor, aynı yöntem.

- [ ] Karar bekliyor: 5. sekme topluluklar mı olsun, yoksa 4 sekmede mi
      kalalım ve etkinlikler kart olarak mı kalsın

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

1. ~~Swipe jesti + kart animasyonu~~ — ✅ yapıldı. Kart parmağı takip
   ediyor, eşikte BEĞEN/GEÇ damgası beliriyor, bırakınca uçuyor.
   Düğmeler korundu.
2. ~~Mesaj gönderim/alım animasyonları~~ — ✅ yapıldı
3. **Sahibe tıklayıp panele geçme** — yarım kalmış vaadi kapatıyor, küçük iş
4. **İlgi alanları** — profil tamamlama kartına doğal ekleme; aynı zamanda
   toplulukların hammaddesi
5. **Beğeniler sekmesi** — süper beğeninin gösterileceği yer; onsuz süper
   beğeni yapılamaz
6. **Süper beğeni** — 5'ten sonra; şema kararı (enum mu ayrı kolon mu)
   ölçülerek verilecek
7. **Yapılandırılmış buluşma kaydı** — başarı metriğini ölçülebilir kılar
8. **Takvime ekleme** — 7'nin üstüne
9. **Etkinlik kartı (Keşfet'te)** — topluluk sekmesinin ön adımı
10. **Sohbette fotoğraf** — moderasyon kapasitesi şartıyla
11. **Topluluk sekmesi + petsiz kullanıcı yüzeyi** — 9 veri üretince
12. **Sesli görüşme** — yoğunluk ve gelir oluştuktan sonra
13. **İngilizce katalog** — yayın hedefi belirlenince
