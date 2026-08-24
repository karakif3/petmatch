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

---

## 12. Profil tamamlama şeridi + Keşfet'te görünürlük anahtarı (2026-08-09)

Üç küçük iş, tek gerekçe: **kararın alındığı yer ile sonucunun görüldüğü
yer aynı ekran olsun.**

### Tamamlama kartı: tek CTA → pet/sahip iki grubu

`core/domain/profile-completion.ts` eksikleri zaten `route: "/profile/pet"
| "/profile/owner"` ile işaretliyordu, yani model ikisini de biliyordu.
Sorun yalnızca sunumdaydı: kart `missing[0]`'ın route'una giden TEK bir
düğme gösteriyordu ve eksikler `improvesMatching`'e göre sıralandığı için
pet maddeleri hep öne geçiyordu — sahip profili eksik olan kullanıcı, pet
eksikleri bitene kadar `/profile/owner` bağlantısını **hiç görmüyordu**.

Şimdi eksikler route'a göre iki gruba ayrılıyor ve her grup kendi sayısını
taşıyan ayrı bir çipe dönüşüyor ("Pet profili 3" / "Sahip profili 2").
Grubu boş olan çip render edilmiyor; ikisi de boşsa kart zaten hiç
çıkmıyor (eski davranış korundu).

### Kart küçültüldü — hero kart değil

Şerit artık tek satır başlık + yüzde + ince (1pt) ilerleme çubuğu + yan
yana iki çip. Giden: uzun açıklama cümlesi ("Boyut ve enerji seviyesi
eklersen eşleşme önerilerin daha isabetli olur"), kalın ilerleme çubuğu,
tam genişlikte büyük düğme, "N madde eksik" satırı — sayı artık çiplerin
üstündeki rozette duruyor. Gerekçe §10'daki K4 ile aynı: Keşfet'te hero
DESTEDİR, kartın üstüne yığılan her modül onu ekranın dışına itiyor.
Kapatma (X) davranışı değişmedi.

### Keşfet başlığında sahip görünürlük anahtarı

Görünürlük ayarı profilde de duruyor ama karşılığını burada veriyor:
`public` olan sahip, kendi kartında avatar + ad + ilgi alanı teaser'ı
olarak görünüyor (§11, `0049`). Anahtar filtre düğmesinin yanında, göz
ikonuyla; açıkken marka rengine dönüyor.

- **Yeni bir RPC yazılmadı.** `update_my_profile` / `update_my_owner_details`
  formun tamamını ister (ad, şehir, pet adı, doğum tarihi…); tek alan
  çevirmek için istemcide o yükü yeniden kurgulamak gerekirdi. Tek alanlık
  yazma doğrudan tabloya gidiyor (`core/api/profile.ts` →
  `updateOwnerVisibility`) — `profiles_update_self` RLS politikası (`0003`)
  yazmayı zaten kullanıcının kendi satırıyla sınırlıyor. Rıza kaydı
  (`public_profile_consent`) burada da alınıyor: onay durumu hangi
  yüzeyden değiştirildiğine bağlı olmamalı.
- **Otomatik açılmıyor.** Varsayılan `after_match`/`hidden` kalıyor.
  Kapatınca `public` ÖNCESİNDEKİ değere dönüyor (`after_match`'e
  sabitlemiyor) — `hidden` seçmiş kullanıcıyı sessizce yukarı çekmek
  gizlilik varsayılanını bozardı.
- **Fotoğrafsız `public` engelleniyor.** Avatar yoksa teaser boş kalırdı;
  anahtar sessizce başarısız olmak yerine sahip profiline yönlendiriyor.
- Yazma sonrası `discovery` ve `profile` sorguları invalidate ediliyor
  (mevcut `applyFilters` deseni).

Telemetri **bilerek eklenmedi**: `product_events.event_name` DB kısıtı
sabit bir listeyle sınırlı (bkz. `0044`), yeni bir olay adı migration
gerektiriyor. Anahtarın benimsenmesini ölçmek istenirse ayrı ve küçük bir iş.

### Yol üstünde çıkan gerçek bir hata: şerit tazelenmiyordu

Canlı doğrulama sırasında bulundu: `["profile-completion"]` sorgusunu
HİÇBİR yazma invalidate etmiyordu. Kullanıcı sahip fotoğrafını ekleyip
Keşfet'e dönünce şerit hâlâ eski sayıyı gösteriyordu — sekme ekranı mount
kalıyor, `staleTime` dolsa bile kendiliğinden tazelenmiyor. İki kaydetme
yerine (`app/profile/owner.tsx`, `app/profile/pet.tsx`) invalidate eklendi;
simülatörde doğrulandı: avatar + bio kaydedildikten sonra şerit %14 → %43
ve "Sahip profili" çipi kayboldu (grubu boşalan çip render edilmiyor).

Bu turda **kart artefaktı (§11) hâlâ görünüyor** — aynı soluk "hayalet"
metin, aynı koşullarda. Yeni koddan bağımsız olduğu bir kez daha teyit
edilmiş oldu; gerçek cihaz doğrulaması bekliyor.

---

## 13. "Hayalet metin" gizemi çözüldü + kart artık ekrana sığıyor (2026-08-09)

### Hayalet, kod değil — seed fotoğrafının kendisi

§11'de "simülatöre özgü GPU tuhaflığı" diye kayda geçen artefakt **bir
render hatası değilmiş.** İzolasyon şöyle yapıldı: `DiscoveryCard`'daki ad
metni geçici olarak `{card.name}~DBG` yapıldı. Ekranda **net metin
"Kömür~DBG", hayalet metin hâlâ "Kömür"** olarak kaldı — yani hayaleti
çizen şey mevcut bileşen DEĞİL. Ardından simülatörün `expo-image` disk
önbelleği (`Library/Caches/com.hackemist.SDImageCache`) açıldı: test
verisindeki fotoğraflar somon renkli bir blok + ALT KENARDA siyah bir
şeritte adın yazılı olduğu üretilmiş yer tutucu görseller. Yani:

- Kartın "arkasındaki" büyük soluk "Kömür / Kedi · Kadıköy" → pet
  fotoğrafının İÇİNE gömülü başlık; okunabilirlik gradyanı onu
  koyulaştırınca hayalet gibi görünüyor.
- "Sahibin yuvarlak fotoğrafı yarım" → sahip avatarı da aynı şablon;
  32×32 daireye kırpılınca üst yarı somon, alt yarı siyah şerit
  (siyah zeminde görünmüyor) + minik "Mert" yazısı.

Kanıt: Profil → "Profilimi önizle" ekranında GERÇEK bir fotoğrafla aynı
kart render edildiğinde hayalet yok. **Kodda düzeltilecek bir şey yok**;
§11'deki "gerçek cihazda tekrar bak" maddesi kapandı. Not: yayın öncesi
test verisinin bu yer tutucularla kalması, her ekran görüntüsü
değerlendirmesini zorlaştırıyor — gerçek fotoğraflarla seed etmek ayrı
bir iş olarak duruyor.

### Gerçek hata: kart ekranı aşıyordu

Kartın yüksekliği fotoğrafın sabit 3:4 oranından geliyordu. Üstünde
başlık + tamamlama şeridi + segment çubuğu varken toplam içerik ekranı
aşıyor, sayfa kaydırılabilir hale geliyor ve kartın **alt satırı
(ad · ırk/boyut · mesafe) yüzen düğme şeridinin altında kalıyordu** —
kullanıcı bilgiyi görmeden karar veriyordu. Şu anki hâl:

- `PhotoCarousel` ve `DiscoveryCard` bir `fill` bayrağı aldı: açıkken
  en-boy oranı yok sayılıyor, foto `flex: 1` ile kabına yayılıyor.
  `SwipeableCard` de aynı bayrağı taşıyor (sarmalayıcı `flex-1` olmazsa
  içteki `flex-1` bağlanacak yükseklik bulamıyor).
- Keşfet'te kart kabı `flex-1` + `minHeight: 320`; kart, üstündeki krom
  ne kadar yer kaplarsa kalanı dolduruyor. Çok dar ekranda `minHeight`
  devreye girip sayfayı yeniden kaydırılabilir yapıyor — ezilmiş kart
  yerine kaydırma.
- Kaydırma kabının alt boşluğu 32 → 44 pt: yüzen şerit gradyanı son 36
  pt'nin üstüne biniyor (`marginTop: -36`), boşluk bundan büyük olmalı.
- Önizleme modalı 3:4 oranını koruyor (`fill` verilmiyor) — orada kart
  bir liste öğesi gibi okunuyor, ekranı doldurması gerekmiyor.

### Sekme çubuğu: ağırlık + renk

Dört sekme ikonu da her zaman DOLU'ydu; aktiflik yalnızca renkle
anlatılıyordu. Dolu ikon görsel olarak ağır olduğundan dördü aynı anda
bağırıyor, hiyerarşi kalmıyor ve renk körlüğünde aktif sekme hiç
okunmuyordu. Artık iOS'un kendi kalıbı: **seçili dolu + marka renginde
hap arka plan, seçili olmayan outline.** Ayrıca üst kenarlık 1pt'den saç
teli kalınlığına indi, etiket tipografisi ve rozet boyutu sisteme çekildi.

Sıradaki (yapılmadı): sekme çubuğu için `expo-blur` ile yarı saydam zemin
— yeni bir native bağımlılık, dev-client'ın yeniden derlenmesini
gerektiriyor. Kalan ikon borcu: uygulama genelinde outline/dolu seçimi
hâlâ ekran ekran kararlaştırılmış durumda; tek bir kural (aktif/seçili
dolu, geri kalan outline) ve tek bir boyut skalası (16/20/24) ayrı bir
tur işi.

---

## 14. Kart hiyerarşisi, Lucide karar ikonları ve "tanışma amacı" değerlendirmesi (2026-08-09)

### Kart: kimlik en üste çıktı, kutular gitti

Kartın alt bloğunda sıralama şöyleydi: çipler → bio kutusu → sahip
kutusu → **ad**. Yani kartın en büyük tipografisi en alttaydı ve göz önce
üç koyu dolu kutuya çarpıyordu; fotoğrafın üstüne yapıştırılmış bir liste
gibi okunuyordu. Yeni sıra **kim → ne → ayrıntı**:

1. Ad + cinsiyet (28px),
2. tek satır meta: `ırk · yaş · boyut · mesafe` — mesafe eskiden sağda
   ayrı bir hapta durup adla yer için yarışıyordu, artık aynı cümlenin
   parçası (bir kutu daha az),
3. ayrıntı blokları: çipler → bio → sahip hapı.

Bio'nun kutusu kaldırıldı (düz metin), sahip bloğu tam genişlikten
`self-start` bir hapa indi ve **sağına bir ok** eklendi — dokunulabilir
olduğunu söyleyen tek görsel işaret bugüne kadar yoktu. Kutular gidince
okunurluğu tamamen gradyan taşıdığı için dip opaklığı 0.88 → 0.92,
geçiş uzatıldı. Çipler de hafifledi (`bg-black/45` + `border-white/15`).

**Sahip ilgi alanı görünmüyordu:** RPC doğru (`0049`, `public` kapısıyla
`prof.interests` dönüyor) — test hesabında `profiles.interests` boş
olduğu için hap yalnızca isimden ibaret kalıyordu. Boşken "Sahibini gör"
metni giriyor; ilgi alanı doluysa o metin çıkmıyor.

### Karar ikonları: Ionicons → Lucide

Geç / süper beğeni / beğen düğmeleri uygulamanın en büyük ve en çok
bakılan yüzeyi; Ionicons **dolu** bir aile olduğu için o boyutta
"sticker" gibi duruyorlardı. Lucide çizgi tabanlı ve tek bir
`strokeWidth` ekseni var — büyük boyutta orantısız kalınlaşmıyor.
`components/ui/icon.tsx` bu üç ikonu + uyum rozetini tek yerden veriyor
(`DECISION_STROKE = 2.5`).

Kapsam **bilerek dar**: tüm uygulamayı tek seferde çevirmek ~40 çağrı
yeri ve her biri kendi boyut/hizalama kararını taşıyor. Geçiş yüzey
yüzey yapılacak; karışık aile geçici, kalıcı hedef tek aile.

`react-native-svg` yeni bir NATIVE bağımlılık: `pod install` + dev-client
yeniden derlemesi gerekti (README'deki `xcodebuild` komutu).

### "Tanışma amacı" sorusu anlamlı mı? — evet, ama sorulduğu yer yanlıştı

Soru (`Yalnızca petime arkadaş` ↔ `Petimle birlikte yeni insanlarla
tanışmak`) ürünün merkezindeki belirsizliği çözüyor: aynı destede hem
yalnızca köpeğine oyun arkadaşı arayan hem de tanışmaya açık insanlar
var. Bu ayrım olmadan bir taraf rahatsız olur, diğer taraf hayal kırıklığı
yaşar — Tinder'ın böyle bir soruya ihtiyacı yok çünkü niyet zaten tek;
burada değil. Yani **soru kalmalı.** Üç uygulama sorunu vardı:

1. **Zamanlama doğru** (kayıtta sorulmuyor, `docs/goal-model.md` §2) ama
   **yeri gömük**: sahip profili formunun içinde, fotoğraf/bio/doğum
   tarihi/cinsiyetin altında. Kararın sonucunun göründüğü yer Keşfet;
   görünürlük anahtarında olduğu gibi (§12) sonuçla aynı ekranda
   sorulması daha iyi olur — sıradaki iş olarak duruyor.
2. **Başarısızlık anı yanlıştı — düzeltildi.** Seçenek işaretleniyor,
   form dolduruluyor, en altta "Kaydet"e basılınca "ad + fotoğraf +
   herkese açık gerekiyor" hatası tek cümlede geliyordu. Artık eksik
   kalemler seçeneğin ALTINDA, seçim anında, tek tek listeleniyor.
3. **İkili olması doğru.** Üçüncü bir "romantik" seçeneği dating modunu
   ve `connection_mode` göçünü gerektirir (goal-model.md §2); köprü
   boolean'ı MVP için yeterli.

---

## 15. İkon ailesi — **KARAR: Lucide** (2026-08-24)

Bugün karışık bir durum var: karar şeridi + uyum rozeti **Lucide**, geri
kalan her şey **Ionicons**. Kalıcı hedef tek aile. Adaylar, bu ürünün
ihtiyaçlarına göre:

> **Karar 2026-08-24: Lucide.** Aşağısı 2026-08-09'daki değerlendirmenin
> kaydı; kararın gerekçesi ve onu değiştiren yeni ölçümler bölümün sonunda.
> 111 çağrı yerinin tamamı çevrildi, Ionicons projeden kaldırıldı.

**İhtiyaç listesi** (aday seçerken ölçüt bunlar):
1. **Ağırlık ekseni** — sekme çubuğunda "seçili dolu / seçili olmayan
   çizgi" kalıbı için aynı ailede fill + regular şart (§13).
2. **Kapsam** — pati, kalkan/doğrulama, takvim, mesaj, konum, filtre,
   yıldız, ev/sahiplendirme... Eksik ikon = ikinci bir aile = başa dönüş.
3. **RN desteği** — hepsi `react-native-svg` istiyor (artık kurulu);
   fark, paketin resmî mi topluluk mu olduğu.
4. **Lisans** — ücretsiz ve ticari kullanıma açık olmalı.

| Aile | Ağırlık ekseni | Kapsam | RN paketi | Lisans | Not |
|---|---|---|---|---|---|
| **Phosphor** | ★ thin/light/regular/bold/**fill**/duotone | ~1.5k × 6 ağırlık | `phosphor-react-native` (resmî) | MIT | Tek ailede fill+regular veren tek gerçek aday; yuvarlak, sıcak dil bir pet ürününe oturuyor |
| **Hugeicons** | stroke/duotone/twotone/bulk/solid | çok geniş (4k+) | resmî RN paketi var | **kısmen ücretli** (pro setler) | Kapsam etkileyici ama lisans katmanları ve genç ekosistem risk |
| **Heroicons** | outline / solid (+20px mini) | ~300 | topluluk (`react-native-heroicons`) | MIT | Çok temiz ama kapsam DAR: pati/pet ikonu yok, kaçınmak istediğimiz "ikinci aile" sorununu doğrudan yaratır |
| **Remix Icon** | line / fill | ~2.8k | topluluk | Apache-2.0 | Kapsam iyi, ağırlık ikilisi var; dil biraz jenerik/Material'a yakın, markaya kimlik katmıyor |
| **Lucide** (bugünkü) | yalnızca stroke | ~1.6k | `lucide-react-native` (resmî) | ISC | Tutarlılığı en yüksek; **fill varyantı yok** — dolu görünüm ancak `fill` prop'uyla taklit ediliyor, kalp/yıldızda çalışıyor ama her ikonda değil |

### Simülatörde yapılan A/B (2026-08-09)

Karşılaştırma kağıt üzerinde bırakılmadı: `phosphor-react-native` kuruldu
(native rebuild GEREKMEDİ, `react-native-svg` zaten vardı), karar şeridi
ve sekme ikonları geçici olarak Phosphor'a çevrildi, ekran görüntüsü
alındı, sonra geri alınıp paket kaldırıldı. Bulgular:

- **Phosphor** (X `bold`, yıldız/kalp `fill`): düz uçlu çizgiler, keskin
  köşeler; yıldızın uçları sivri, kalbin alt ucu dar ve köşeli.
- **Lucide** (`strokeWidth 2.5`, kalp/yıldızda `fill` taklidi): yuvarlak
  uçlu çizgiler; yıldız daha büyük ve köşeleri yumuşak, kalp daha dolgun.

**Bu, ilk tahminin TERSİ çıktı.** "Phosphor daha yuvarlak/sıcak, pet
ürününe daha uygun" beklenirken, bu üç glifte marka diline daha yakın
duran Lucide oldu — sebebi ailenin genel karakteri değil, Lucide'ın
yuvarlak `stroke-linecap` tercihi. Phosphor'un yuvarlak karakteri
`regular`/`light` ağırlıklarında belirgin; `bold`/`fill`'de kayboluyor.
Yani Phosphor'un avantajı estetik değil **yapısal**: ağırlık ekseni.

**Kapsam ölçüldü:** Lucide 1.765 ikon; ihtiyaç listesindeki her şey var
(`paw-print`, `shield-check`, `cat`, `dog`, `map-pin`, `sliders-horizontal`,
`eye`/`eye-off`, `calendar`, `chevron-right`…). Phosphor 1.512 ikon × 6
ağırlık. Yani kapsam ikisinde de sorun değil.

**Göç büyüklüğü:** kod tabanında **104 `<Ionicons>` çağrı yeri / 30 dosya**
(önceki turda "~40" diye tahmin edilmişti, gerçek sayı bu).

**Öneri: Phosphor.** Tek ayırt edici ölçüt ağırlık ekseni: sekme
çubuğundaki aktif/pasif ayrımı ve karar düğmelerinin "kütlesi" aynı
ailede çözülüyor, taklide gerek kalmıyor. İkinci tercih — ve A/B'den sonra
farkın kapandığı yer: Lucide'da kalıp dolu görünümü `fill` ile taklit
etmek. Maliyeti sıfır, bugün çalışıyor ve kalp/yıldız/pati gibi kapalı
şekillerde sorunsuz; risk yalnızca açık şekilli ikonlarda (ör. çan,
konuşma balonu) dolu varyantın bozuk görünmesi.
Heroicons kapsam yüzünden eleniyor; Hugeicons lisans/olgunluk yüzünden
bekletiliyor; Remix nötr.

Geçiş maliyeti şu an en düşük seviyede: yalnızca 4 ikon çevrildi ve
`react-native-svg` zaten kurulu. Karar verilince geçiş yüzey yüzey
yapılacak (önce sekme çubuğu + karar şeridi, sonra ekranlar), kural:
**aktif/seçili dolu, geri kalan çizgi; boyut skalası 16/20/24.**

### 2026-08-24 — kararı değiştiren üç ölçüm

Paketler indirilip **sayıldı** (tahmin değil), kapsam da kodda gerçekten
kullanılan gliflerle test edildi.

| | Lucide | Phosphor | Heroicons | Tabler |
|---|---|---|---|---|
| Tekil ikon | 1.765 | 1.512 × 6 ağırlık | 297 × 2 | 6.185 (930 dolu) |
| Kullanılan 40 glif | 40/40 | 40/40 | **37/40** | 40/40 |
| Yol haritası 19 kavram | 19/19 | 19/19 | 18/19 | 19/19 |
| Sekme çubuğunda dolu varyant | ✗ (`fill` prop) | ✓ | ✓ ama pati yok | ✓ pati dahil |

Üç bulgu §15'in Phosphor önerisini geçersiz kıldı:

1. **Maliyet öncülü bayatlamıştı.** "Yalnızca 4 ikon çevrildi" notu yazıldıktan
   sonra `components/ui/` katmanının tamamı (`button`, `icon-button`,
   `empty-state`, `screen-header`) Lucide üzerine kuruldu. Aile değiştirmek
   artık 111 çağrı değil, **önce kendi tasarım sistemini sökmek** demekti.
2. **Ağırlık ekseni argümanı dört glife iniyor.** Dolgu yalnızca sekme
   çubuğunda gerekiyor ve o dördü de (`paw-print · heart · message-circle ·
   user`) kapalı şekil — Lucide'ın `fill` prop'unun sorunsuz çalıştığı sınıf.
   Üstelik sekme çubuğu zaten hap arka planı + renk kullanıyor; dolgu tek
   sinyal değil.
3. **§15'te olmayan aday: Tabler.** Phosphor'un tek avantajını daha iyi
   veriyor (dolu pati dahil 930 dolu varyant). Ama **6.185 ikon içinde
   `rabbit`, `bird`, `turtle` yok** — Lucide'da üçü de var. Tür genişletmesi
   (`species` enum'u) düşünülüyorsa bu doğrudan alan kaybı.

Dürüst özet: saf teknik değerlendirmede Tabler ile Lucide başa baş; Lucide'ı
öne çıkaran şey kod tabanının bugün nerede durduğu ve pet alanındaki kapsam.

### Göç (2026-08-24)

- **Tek kayıt defteri:** `components/ui/icon.tsx` → `ICONS` sözlüğü +
  `AppIcon` bileşeni + `AppIconName` tipi. 50 glif.
- **Adlandırma Lucide'ın kendi sözlüğü** (`paw-print`, `chevron-right`,
  `circle-check`). Ionicons adlarını korumak bir çeviri katmanı olurdu.
- **`-outline` kavramı kalktı.** Dolgu ayrı bir isim değil `filled` prop'u ve
  **yalnızca durum anlatan yerlerde** kullanılıyor (seçili sekme, karar
  şeridi). Süsleme dolgusu yok — Ionicons'tan kaçış sebebi zaten oydu.
- **Dolgunun sınırı:** `filled`, iç detayı yutmayan gliflerde çalışır. Göç
  sırasında tek gerçek çakışma buydu: sahip doğrulama rozeti Ionicons'ta
  dolu/outline ile durum anlatıyordu, ama `shield-check` doldurulunca
  içindeki çek kayboluyor. Ayrım şekil düzeyine taşındı — onaylıysa
  `shield-check`, değilse düz `shield`.
- `@expo/vector-icons` **doğrudan bağımlılıktan çıkarıldı** (expo üzerinden
  transitively duruyor). Karışık ailenin geri sızmasını engelleyen tek
  yapısal önlem bu.

## 15b. Sohbette dikey alan (2026-08-24)

Simülatörde ölçüldü: 874pt'lik ekranda mesaj listesine **378pt (%43)** kalıyordu.

| Blok | Önce | Sonra |
|---|---|---|
| Başlık (pet satırı + sahip hapı) | ~100pt | **~62pt** |
| Buluşma kartı (onaylanmış) | ~218pt | **~48pt** |
| **Mesaj listesi** | **378pt (%43)** | **~559pt (%64)** |

**Onaylanmış buluşma kartı katlanıyor.** Karar verildikten sonra karttaki
bilginin tamamı (açıklama, olanak çipleri, kaynak bağlantısı, takvime ekle)
referans bilgi — lazım olunca bakılır. Katlanmış hâli yer + tarih/saat tek
satır; dokununca açılıyor. **Bekleyen öneri katlanmıyor:** orada karar
düğmeleri var, katlamak kullanıcıdan beklenen eylemi gizlemek olurdu.

**Sahip bloğu başlık satırının içine girdi ve adını bıraktı.** Küçülme
geçmişi: ayrı tam genişlikte kart (~120pt) → header'ın ikinci satırında ad
taşıyan hap (~36pt) → başlık satırında yalnız avatar. Ad, fotoğraf, yaş
kovası ve bio'nun tamamı zaten `OwnerSheet`'te; header'da adı tekrar etmek
ikinci satır maliyetine değmiyordu ve uzun Türkçe adlar pet adını
sıkıştırıyordu. Avatar aksan renginde halkayla çevrili (dokunulabilirlik
işareti) ve doğrulanmış sahipte köşesinde kalkan duruyor — güven sinyali
kaybolmadı.

**Sırada bekleyen üçüncü kazanç:** hızlı yanıt şeridi (~43pt) kalıcı
duruyor. "Buluşma planla / Uyumluluk sor" bir başlangıç aracı; karşılıklı
ilk mesajlaşmadan sonra yazma satırının yanındaki bir `+` düğmesine
alınabilir. Bu turda bilerek yapılmadı — kullanımını ölçmeden gizlemek
riskli.

---

## 16. Profil ekranı: gruplu liste diline geçiş (2026-08-09)

Ekranın asıl sorunu tek tek bileşenler değil, **her bölümün ayrı bir
görsel dil kullanmasıydı**: kimi bölüm kart, kimi çerçevesiz input
listesi, kimi radyo düğmeleri, kimi tam genişlikte çerçeveli düğme.
Hiçbiri tek başına yanlış değil ama yan yana gelince ekran "form" gibi
değil "farklı zamanlarda eklenmiş parçalar" gibi okunuyordu.

Yeni kural: **her şey bölüm başlığı + kart içinde satır**
(`components/ui/section.tsx`: `SectionTitle`, `SectionCard`, `Row`,
`RowSeparator`). Bölümler: kimlik → Profiller → Temel bilgiler →
Yaklaşık konum → Bildirimler → Hesap → Tehlikeli bölge.

### Yapısal düzeltmeler (görsel değil)

- **Görünürlüğün üç düzenleyicisi vardı** — bu ekrandaki radyo listesi,
  sahip profili ekranı ve Keşfet'teki hızlı anahtar; üçü de aynı kolonu
  (`profiles.owner_visibility`) yazıyordu. Burası artık yalnızca DEĞERİ
  gösteriyor ve sahip profiline götürüyor. Düzenleme tek yerde (sahip
  profili), hızlı anahtar sonucun göründüğü yerde (Keşfet).
- **Kimlik kartı**: pet + sahip avatarı üst üste binen tek blok. Öncesinde
  pet kartı, sahip satırı ve e-posta ekranın üç ayrı yerine dağılmıştı.
- **"Vazgeç"**: kirli bir formdan çıkmanın tek yolu alanları tek tek eski
  hâline getirmekti; kaydet şeridine ikinci düğme olarak girdi.
- **Sonuç mesajları kaydet şeridinin yanına taşındı.** Öncesinde form
  ortasında beliriyordu: kullanıcı en alttaki şeritten kaydediyor,
  "Profilin güncellendi" ekranın yukarısında kalıyordu. Başarı mesajı 5
  saniyede kendiliğinden kayboluyor, hata kalıyor (biri bildirim, diğeri
  görev).
- **Erişilebilirlik:** bildirim satırlarında yalnızca `Switch` (≈50×30 pt)
  dokunulabilirdi, satırın geri kalanı ölüydü — artık tüm satır anahtarı
  çeviriyor. Input'lara `accessibilityLabel` eklendi: React Native
  etiketi otomatik BAĞLAMIYOR, ekran okuyucu bu alanları adsız okuyordu.
- **Çıkış yap** satırında ok yok (ok "alt ekran var" demektir, bu yerinde
  bir eylem); yıkıcı bölge kendi başlığı ve rengiyle ayrıldı.

### Yol üstünde bulunan gerçek hata: ağ hatası ham görünüyordu

Canlı testte kaydetme bir kez ağ hatasıyla düştü ve kullanıcıya
`TypeError: Network request failed` gösterildi — mobilde EN SIK hata ve
kod tabanında İngilizce kalan tek mesaj. `errorMessage` artık ağ
hatalarını ("network request failed", "failed to fetch", "internet
connection appears to be offline") tek bir Türkçe ve eyleme dönük cümleye
çeviriyor; diğer hatalarda sunucunun mesajı korunuyor (orada gösterilecek
bir sebep VAR, ağ hatasında yok). İki test eklendi.

---

## 17. Sahip profili ekranı denetimi (2026-08-09)

Profil ekranındaki (§16) turdan sonra bu ekran denetlendi. Bulunanların
çoğu görsel değil **davranışsaldı** ve bir kısmı veri kaybettiriyordu.

### Kaydedilmemiş değişiklikle geri gitmek sessizce veri kaybettiriyordu

En ciddi bulgu. Profil sekmesinde bu risk yoktu (sekme ekranı mount
kalıyor, state duruyor); burası bir yığın ekranı — geri basınca unmount
oluyor ve 8 alanlık formda yazılan her şey uyarısız gidiyordu. Artık
kirliyken geri tuşu onay soruyor ("Düzenlemeye dön" / "Çık ve vazgeç").

### Kaydet düğmesi sayfanın en altındaydı ve hep aynı görünüyordu

§16'da profil ekranı için düzeltilen sorunun aynısı burada duruyordu.
Artık kirli-durum şeridi: yalnızca gerçekten bir şey değiştiğinde beliren
"Vazgeç" + "Kaydet". Kirlilik karşılaştırması ilgi alanı dizisini ve
avatarın yerel/uzak olma durumunu da hesaba katıyor.

### Doğum tarihi elle biçimlendiriliyordu

Kullanıcı "YYYY-AA-GG" biçimini kendi kurmak zorundaydı ve yanlış
yazdığını **ancak formun en altındaki Kaydet'e bastığında** öğreniyordu.
Artık yalnızca rakam yazılıyor, tireleri alan koyuyor; 18 yaş kontrolü
alan dolduğu anda alanın altında görünüyor ve kaydet düğmesi kilitleniyor.
(Gerçek tarih seçici `@react-native-community/datetimepicker` demek —
yeni native bağımlılık; ayrı iş.)

### Dokunma geri bildirimi hiç yoktu

Faz A'da eklenen `AppPressable` bu ekrana hiç uygulanmamıştı: 27 ham
`Pressable`. Hepsi çevrildi.

### Erişilebilirlik

- Görünürlük seçenekleri sıradan düğmeydi ve seçili durum **yalnızca
  renkle** anlatılıyordu — renk körlüğünde marka rengi ile kenarlık
  rengi ayırt edilemiyor. Artık `accessibilityRole="radio"` + görünür
  radyo işareti.
- Cinsiyet çipleri rol/durum taşımıyordu (ilgi alanlarında vardı,
  burada yoktu — aynı ekranda iki farklı standart). Eklendi; çiplerin
  dokunma yüksekliği 44 pt'ye çıkarıldı.
- Input'lara `accessibilityLabel` (RN etiketi otomatik bağlamıyor).

### Görsel dil

Bölüm başlıkları profil ekranıyla aynı `SectionTitle` diline çekildi;
sonuç mesajları kaydet şeridinin yanına taşındı (başarı 5 sn sonra
kayboluyor, hata kalıyor); bio sayacındaki `-mt-4` hack'i azaltıldı.

### Bilerek yapılmayan

Ekranın tamamını gruplu listeye çevirmek: burası bir **düzenleme formu**,
ayar listesi değil — çipler, radyolar ve fotoğraf alanı satır kalıbına
zorlanınca kullanılabilirlik düşerdi. Ortak olan yalnızca bölüm başlığı
dili ve kaydet şeridi.
