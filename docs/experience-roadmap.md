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
"buluştunuz mu?" verisini sıralamaya bağlamak.

### Süper beğeni — ✅ yapıldı

Şema kararı ölçülerek verildi: enum'a değer eklemek yerine ayrı
`swipes.is_super boolean` (0044) — `alter type ... add value`'nun bazı
akışlarda transaction içinde çalışmaması riskini sıfırladı. Yalnızca
`like` üstüne süper olunabilir, `pass` DB seviyesinde CHECK ile reddediliyor.

Ürün kuralı öngörüldüğü gibi Beğeniler sekmesine bağlandı: "karşı tarafın
destesinde öne çıkma" pratikte **Beğeniler sıralaması** demek (deste zaten
swipe edilmiş çiftleri göstermiyor). `pending_likes()` `is_super desc,
created_at desc` sıralıyor; "Süper" rozeti kilitli kartta bile görünüyor
(kimlik değil, sadece "bu beğeni özel" sinyali — `monetization.md`'ye de
yazıldı). Keşfet ekranına üçüncü bir düğme eklendi (X · ★ · kalp).

Simülatörde uçtan uca doğrulandı: gönderilen süper beğeni `is_super=true`
olarak kaydedildi, karşılıklıysa anında eşleşme oluşturdu; alıcı tarafta
kilitli kartta bile "★ Süper" rozeti göründü.

**Kapsam dışı bırakılan:** anlık push bildirimi, günlük gönderim limiti
(`docs/backlog.md`'ye taşındı).

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

---

## 8. Sahip görünürlüğü kurgusunun denetimi (2026-08-06)

Model üç durumlu ve dört ayrı yerde uygulanıyor. Denetim ölçümle yapıldı;
aşağıdakiler varsayım değil, koddan okundu.

### Kural nerede uygulanıyor

| Yüzey | Fonksiyon / politika |
|---|---|
| Keşfet | `discover_pets` (0012) + `discover_playdate_pets` (0024) |
| Sohbet | `get_conversation_owner_profile` (0023) |
| Beğeniler | `pending_likes` (0042) |
| Avatar dosyası | `owner_avatars_read_visible` (0021 → 0039) |

Dördü de aynı deseni izliyor: ad/avatar/bio yalnızca `public`'te, cinsiyet ve
yaş kovası ise **hem karşı taraf hem de kendisi** `public` olduğunda. Yani
"kendi göstermeden başkasınınkini görme" ilkesi cinsiyet/yaş için sunucuda
kurulu.

### ✅ Doğru çalışan: `after_match` boş blok üretmiyor

`owner_visible` alanı `owner_visibility <> 'hidden'` diye hesaplanıyor, yani
`after_match` için **true** dönüyor — ama ad/avatar/bio `public` şartına bağlı
olduğundan hepsi `null` geliyor. Tek başına bu, kartta "Sahip profili görünür"
yazan ama hiçbir şey göstermeyen bir blok üretirdi.

İstemci bunu yakalıyor (`ownerSummary`, `core/api/discovery.ts`): üç alan da
boşsa `owner` **null** dönüyor, blok hiç render edilmiyor, dolayısıyla yeni
eklenen sahip paneli de açılamıyor. Doğru davranış.

> Yine de `owner_visible` adı yanıltıcı: "gizli değil" demek, "görünür" demek
> değil. Sunucunun ifade etmesi gereken şeyi istemci telafi ediyor.
> - [ ] `owner_visible` yerine anlamı taşıyan bir alan (örn. `owner_disclosed`)
>       ya da doğrudan `after_match`'te `false` döndürmek

### ⚠️ Bulgu: filtrelerde karşılıklılık tutarsız

Dört sahip filtresinden **ikisi çift yönlü, ikisi değil**:

| Filtre | Karşılıklı mı | Değerlendirme |
|---|---|---|
| `require_visible_owner` | ✅ evet (0012, iki yönlü koşul) | doğru |
| `require_owner_social` | ✅ evet (0024, sosyal değilsen hata) | doğru |
| **`require_owner_photo`** | ❌ **hayır** | **tutarsız** |
| `require_verified_owner` | ❌ hayır | **kasıtlı olmalı** |

**`require_owner_photo` sorunlu.** Kendi avatarı olmayan ve görünürlüğü
`hidden` olan bir kullanıcı "yalnızca fotoğrafı olan sahipleri göster"
diyebiliyor: açıklama tüketiyor ama açıklama vermiyor. Bu, kod tabanının
kendi kuralıyla çelişiyor — `0012`'deki yorum "Tek kaynaktan çift yönlü
kural" diyor ama o kural yalnızca `require_visible_owner`'a uygulanmış.

**`require_verified_owner` farklı ve öyle kalmalı.** Doğrulama bir *açıklama*
değil *güvenlik* sinyali. "Yalnızca doğrulanmışları göster" diyen birine
"önce sen doğrulan" demek, güvenlik isteyen kullanıcıyı cezalandırmak olur.
Asimetri burada bilinçli olmalı — ama bugün hiçbir yerde yazılı değil.

- [ ] `require_owner_photo` çift yönlü yapılsın (kendi avatarı olmayan bu
      filtreyi kullanamasın) — `require_owner_social`'daki desen
- [ ] `require_verified_owner`'ın neden kasıtlı olarak tek yönlü olduğu
      migration yorumuna yazılsın, yoksa sonraki denetimde "hata" sanılır

### Beğeniler sekmesi ve görünürlük

`0042` aynı kuralı tekrarlıyor ve doğru uyguluyor. `228819c` ile sosyal-açık
sahiplerin kartı bulanıklaştırılmadan gösteriliyor; bu, `public` +
`owner_social_open` olan kişinin zaten keşfette açık olduğu gerçeğiyle
tutarlı — ödeme duvarı, kullanıcının **zaten görebileceği** bir şeyi
saklamamalı.

## 9. Beğeniler otomatik yenilenmeli mi? — hayır

İlk hali iki sorguyu da 15 saniyede bir yeniliyordu (`refetchInterval`).
Kaldırıldı. Üç sebep:

1. **Beğeni zaman kritik değil.** Beş dakika sonra görmek hiçbir şey
   kaybettirmiyor. Realtime'ı sohbete koyduk çünkü orası karşılıklı ve anlık
   bir alışveriş; beğeni öyle değil.
2. **Maliyet karşılıksız.** Ekran açık kaldıkça sürekli iki RPC atmak, hiçbir
   kullanıcı faydası olmayan bir yük.
3. **Ürün değeri — asıl sebep bu.** Burası ödeme yüzeyi. Kullanıcı bakarken
   kendiliğinden artan bir sayaç kumar makinesidir.
   [`monetization.md`](monetization.md)'deki "asla satılmayacaklar" duruşu
   alınmış bir karardır; sayının artması kullanıcının **eylemine** bağlı
   olmalı, saate değil.

Yerine: sekmeye her girişte bir kez tazeleme (`useFocusEffect`) + aşağı
çekerek yenileme. Rozet sayısı da ileride uygulama öne geldiğinde ve swipe
sonrasında güncellenmeli, zamanlayıcıyla değil.

**Güncelleme (2026-08-08):** Rozet artık var — `app/(app)/_layout.tsx`
`["pending-likes","count"]` sorgusunu doğrudan okuyor, aynı anahtar
`likes.tsx`'in kendisiyle paylaşılıyor (ekstra istek yok). Hâlâ
zamanlayıcı YOK; yukarıdaki üç gerekçe geçerliliğini koruyor — rozet
yalnızca ekran odağa girdiğinde/tazelendiğinde güncelleniyor.

---

## 10. Premium/kalite turu — Keşfet kartı tam kadraja geçti (2026-08-08)

**Neden:** Ürün işlevsel olarak tamamdı ama üç katmanda "amatör" hissi
veriyordu — bkz. bu turun review'ü. Üçü de tek seferde, tüm ekranları aynı
anda etkileyecek şekilde kapatıldı, sonra Keşfet kartı yeniden tasarlandı:

1. **Yüklenen Inter yüzleri hiçbir metinde kullanılmıyordu.**
   `Inter_600SemiBold`/`Inter_700Bold` yükleniyor ama Tailwind'in
   `font-semibold`/`font-bold` sınıfları yalnızca `font-weight` üretiyordu;
   iOS tek ağırlıklı özel yüzü SENTETİK kalınlaştırıyordu. Kök sebep:
   `tailwind.config.js`'teki özel `fontFamily.medium`/`fontFamily.bold`
   anahtarları, Tailwind'in kendi `fontWeight` çekirdek eklentisiyle AYNI
   sınıf adını (`font-medium`, `font-bold`) üretiyor ve çekirdek eklenti CSS
   çıktısında sonra geldiği için onu eziyordu. `global.css`'e `@layer
   utilities` ile aynı sınıf adlarına gerçek `fontFamily` bindirildi — 230+
   çağrı yeri hiç değişmeden düzeldi.
2. **~150 `Pressable`'ın hiçbirinde basılı durum yoktu.**
   `components/ui/pressable.tsx` (`AppPressable`) eklendi: basılıyken opaklık
   + hafif ölçek düşüşü, bilerek animasyonsuz (durum bildirimi, hareket
   değil). Uygulama genelinde `Pressable` yerine kullanılıyor.
3. **Haptik yalnızca iki yerdeydi.** `core/ui/haptics.ts` dört fonksiyonluk
   bir sözlük veriyor (`decisionHaptic`/`successHaptic`/`lightHaptic`/
   `warningHaptic`); beğen/geç/süper beğeni, buluşma yanıtı, engelleme gibi
   geri alınamaz kararlara bağlandı.

### Kart dili kararı: tam kadraj + karusel

Önceki kart üstte 1.3 oranlı foto + altta beyaz bilgi paneli şeklindeydi.
Yeni kart Tinder/Hinge diline geçti:

- **Tam kadraj foto (3:4)**, alt gradyan üstüne ad/yaş/mesafe/uyum biniyor.
  Irk/boyut/enerji/mizaç/bio ve sahip bloğu dokunmayla açılan bir panele
  indi (`components/discovery-card.tsx` içindeki `DetailsSheet`).
- **Fotoğraf karuseli** (`components/photo-carousel.tsx`) eklendi.
  Kullanıcı 1-6 fotoğraf yüklüyor ama uygulamanın hiçbir yerinde
  `photoUrls[0]` dışındaki hiçbiri görünmüyordu — en yüksek değer/maliyet
  oranlı tek iş buydu. Sol/sağ yarıya dokunarak geçiş; `SwipeableCard`'ın
  yatay pan jestiyle çakışmıyor çünkü jest yalnızca
  `activeOffsetX([-12,12])` eşiğini aşan sürüklemelerde devreye giriyor.
- **Uyum rozeti artık tıklanabilir.** Dokununca `core/domain/matching.ts`'in
  zaten hesapladığı bileşen skorlarını (tür/enerji/yaş/mizaç) gösteren bir
  döküm açılıyor — önceden ürünün en ayırt edici sinyali açıklamasız bir
  sayıydı.
- **Deste derinliği** eklendi: bir sonraki kart hafif küçültülmüş halde
  arkada duruyor (`pointerEvents="none"`), swipe sonrası boş ekran anı
  kayboldu.
- **`variant="preview"`** ile aynı bileşen Profil sekmesindeki "Profilimi
  önizle" modalında (`components/profile-preview-modal.tsx`) kendi verisiyle
  yeniden kullanılıyor — kullanıcı kendi kartını ilk kez karşı tarafın
  gördüğü haliyle görebiliyor. Uyum rozeti ve mesafe bu modda gizli (kendine
  göre anlamsız).

### Bilerek ertelenen

- **Beğeniler ızgarasının `w-[48%]` hesaplaması** gözden geçirilmedi —
  fonksiyonel olarak çalışıyor, tek dişli son satırda solda kalıyor
  (masonry ızgaralarda yaygın, kırık değil). Kilitli karta dokunma yanıtı
  (`Alert.alert` ile kısa açıklama) eklendi, gerçek ödeme duvarı hâlâ §9'daki
  aynı "kararı bekleyenler" maddesine bağlı.
- **Süper beğeniyle gelen eşleşmede liste satırı rozeti** kod tarafında
  yapılamadı: `list_my_conversations` RPC'si `is_super` döndürmüyor. Yeni
  migration gerektiriyor, bu tur istemci-only kapsamdaydı.
- **Onboarding adım içeriğinin geçiş animasyonu** (yalnızca ilerleme çubuğu
  animasyonlandı, adım içeriği hâlâ anlık değişiyor) — daha büyük bir
  yeniden yapılanma (mount/unmount fade) gerektiriyor, ayrı bir iş olarak
  bırakıldı.

---

## 11. Keşfet kartı: sahip ilgi alanları + fotoğraf sayfası başına ilerici bilgi (2026-08-08)

**İstek:** pet'le ilgili çekici bilgiler kartın yüzünde görünsün; sahip de
(rıza varsa) fotoğrafı ve ilgi alanlarıyla kartta belirsin; konuma kartta
yer verilsin; birden fazla fotoğrafta sağa/sola geçiş çalışsın.

### Karar: ayrı bir panel yerine, fotoğraf sayfaları arasına dağıt

Kullanıcının kendi önerisi: "sonraki fotoya geçtikçe ilk fotoya
sığdırılamayan bilgiler gözüksün, ayrıntılar diye ayrı bir şeye gerek yok."
§10'daki `DetailsSheet` (dokunmayla açılan alt panel) tamamen kaldırıldı.
Yerine:

- **Sayfa 0 çekirdek bilgiye ayrılmış**: ad, cinsiyet ikonu, ırk·yaş·boyut,
  mesafe — hep görünür, fotoğraf değişse de sabit kalır.
- **Fazladan içerik** (öncelik sırasıyla: enerji/şehir/kısırlaştırma
  çipleri → mizaç çipleri → bio → sahip teaser'ı) sonraki fotoğraf
  sayfalarına dağıtılıyor. Kategori sayısı fotoğraf sayısından fazlaysa
  kalanlar SON sayfada birikiyor — veri kaybı olmuyor. Tek fotoğrafta
  gidecek başka sayfa olmadığı için hepsi çekirdek bilginin üstünde,
  aynı sayfada toplanıyor.
- `components/photo-carousel.tsx` bu yüzden KONTROLLÜ hale getirildi
  (`index`/`onIndexChange` props) — önceden kendi iç state'ini tutuyordu,
  artık `DiscoveryCard` hangi sayfada olunduğunu bilmek zorunda.
- Uyum rozeti artık STATİK (dokunma/döküm yok) — döküm ekranı `DetailsSheet`
  ile birlikte gitti. Geri istenirse ayrı bir iş.

### Sahip teaser'ı: küçük rozet, avatar + en fazla 2 ilgi alanı

`profiles.interests` `0041`'den beri toplanıyordu ama "uyum skoruna
bağlama ve 5. sekme bilerek kapsam dışı" notuyla hiçbir yerde
GÖSTERİLMİYORDU (§6). Bu tur onu Keşfet kartına taşıdı:

- **Yeni migration** (`0049_owner_interests_in_discovery.sql`, canlı
  Supabase'e uygulandı): `discover_playdate_pets` ve `pending_likes`'a
  `owner_interests text[]` eklendi, AYNI `owner_visibility = 'public'`
  kapısıyla (`owner_display_name`/`owner_bio` ile birebir aynı desen).
  İstemci tarafında AYRI bir sorgu yok — 0021'deki karşılıklı açıklama
  kuralı istemci tarafından delinmiyor, veri zaten satırda geliyor.
- Kart yüzünde: avatar (32px) + ad + doğrulama rozeti + en fazla 2 ilgi
  alanı çipi, tek satır, dokununca `OwnerSheet` açılıyor (aynı bileşen,
  sohbet ve eski kart panelinde de kullanılıyordu).
- `variant="preview"`'da (Profilimi önizle) sahip teaser'ı hiç render
  edilmiyor — kendi ilgi alanlarını kendine göstermenin anlamı yok.
- `core/domain/labels.ts`'e `ownerInterestLabels` eklendi (önceden yalnızca
  `app/profile/owner.tsx` içindeydi, aynı taşıma gerekçesiyle —
  `temperamentLabels`/`sizeLabels`'te olduğu gibi).

### Doğrulama ve karşılaşılan bir simülatör artefaktı

Migration canlıya `supabase db push --include-all` ile uygulandı (tek
düz numaralı olmayan `20260729212719_...` migration dosyası CLI'ın
sırayı "geçmişe ekleme" sanmasına yol açıyor — beklenen davranış, veri
kaybı yok). `types/database.ts` `supabase gen types typescript` ile
yeniden üretildi, diff yalnızca iki yeni `owner_interests` alanıydı.

Simülatörde uzun bir doğrulama turunda kart içeriği (ad, mizaç/enerji
çipleri, bio, sahip adı+ilgi alanı) her seferinde DOĞRU render edildi.
Ama tekrar tekrar bir GÖRSEL ARTEFAKT gözlendi: kartın en alt satırı
(ad/ırk/boyut) bazen daha büyük, soluk bir "hayalet" kopyasıyla üst üste
biniyordu — yalnızca kartın ekrandaki konumu değiştiğinde (kaydırma YA DA
üstteki "Profilini tamamla" kartının kapatılmasıyla içerik yeniden
akışı). Kapsamlı izolasyon (deste derinliğindeki arka kartı kapatma,
fazladan içerik bloklarını kapatma, `key` ile native view'ı zorla
tazeleme, `collapsable={false}`, gradyanı güçlendirme) HİÇBİRİ düzeltmedi
— bu da onun **yeni eklenen koddan kaynaklanmadığını** güçlü şekilde
gösteriyor; bir "sürükleyerek kaydırma tetikliyor" varsayımı da düz
dokunmayla (kartın üstündeki tamamlama kartını kapatarak, hiç sürükleme
olmadan) aynı görüntünün oluşmasıyla çürüdü. Simülatör GPU/framebuffer
tazeleme tuhaflığı olarak değerlendirildi, gerçek cihazda tekrar
doğrulanması öneriliyor. Kod tarafında spekülatif "düzeltmeler"den
doğrulanamamış gerekçe taşıyanlar (gradyan `key`'i, `collapsable={false}`)
geri alındı; kendi başına savunulabilir olanlar (daha güçlü gradyan/daha
opak çip arka planları — okunurluk için; foto yüklenemezse opak arka
plan; sayfa değişince içerik bloğunu yeniden mount eden `key`) kaldı.
