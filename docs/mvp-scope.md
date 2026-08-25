# MVP kapsamı

> Temel akış: hesap aç → pet profili oluştur → pet-first tanışma tercihini
> seç → yakındaki uyumlu petleri ve izin veren sahipleri gör → karşılıklı
> beğeni = eşleşme → mesajlaş.

## Kapsam içi

| Modül | Kapsam | Durum |
|---|---|---|
| Auth | E-posta + şifre. Google/Apple sonra. | ✅ iskelet |
| Sahip profili | Opsiyonel ad, avatar, şehir, bio, yaş/cinsiyet açıklaması, görünürlük ve pet-first tanışma modu | ✅ tam düzenleme + private avatar + doğrulama başvurusu |
| Pet profili | Ad, tür, ırk, doğum tarihi, cinsiyet, kısırlaştırma, boyut, enerji, mizaç, uyumluluk, amaç, 1–6 fotoğraf | ✅ tam düzenleme + fotoğraf ekleme/silme/sıralama |
| Keşfet | Bölge havuzu + pet filtreleri + karşılıklı sahip fotoğrafı/sosyal/verification/yaş/cinsiyet filtreleri. Mesafe varsayılan olarak elemez, sıralar (`0061`) | ✅ RPC + güvenli swipe + filtre ekranı |
| Eşleşme | Karşılıklı beğeni → trigger ile match | ✅ DB + inbox ekranı |
| Mesajlaşma | Eşleşme sonrası 1-1 metin | ✅ DB + Realtime sohbet ekranı |
| Bildirim | Yeni eşleşme, yeni mesaj | ✅ istemci tercih/token akışı + Edge Function + EAS bağlantısı · ⏳ fiziksel cihaz build/test |
| Güvenlik | Engelle, şikayet et, eşleşmeyi kaldır, hesap silme | ✅ DB + keşfet/sohbet/profil ekranları |
| Ayarlar | Görünürlük, bildirim, konum, dil | ✅ görünürlük + bildirim + konum + i18n temeli · ⏳ tam katalog/dil yayını |

Pet adı zorunludur ve ürünün birincil görünen kimliğidir. Sahip adı
opsiyoneldir; boş bırakıldığında sahibi görünür yapma tercihi diğer profil
bilgilerini açabilir fakat bir ad metni gösterilmez.

## Kayıt akışında ne sorulur, ne sorulmaz (2026-08-04)

Kayıt önce **17 giriş** istiyordu ve hiçbiri atlanamıyordu. `benchmark.md`'deki
kıyas (Tinder/Bumble/Hinge) ad, doğum tarihi, cinsiyet ve fotoğraf istiyor;
gerisini kullanıma yayıyor. Akış aynı ilkeye çekildi.

**Kayıtta sorulanlar — hepsinin şemada zorlayıcı bir sebebi var:**

| Alan | Neden ertelenemez |
|---|---|
| Sahip doğum tarihi | `profiles_adult` CHECK; 18+ yasal kapısı |
| Pet adı / tür / cinsiyet | NOT NULL, varsayılanı yok |
| En az 1 fotoğraf | Fotoğrafsız kart destede işe yaramaz |
| Yasal onay | KVKK |
| Bölge | Pilot ölçümünün anahtarı (`0037`); tek dokunuş |

**Ertelenenler — hepsinin varsayılanı var ya da null olabiliyor:**
ırk, boyut (`medium`), enerji (`3`), kısırlaştırma (`false`), pet doğum
tarihi, biyografiler, sahip avatarı, sahip görünürlüğü (`after_match`).

Bunlar keşfetin üstündeki **profil tamamlama kartından** toplanıyor. Kart
kapatılabilir ve eksik yoksa hiç render edilmiyor.

İki karar ayrıca not edilmeli:

- **Pete tam doğum tarihi sorulmuyor, yaş soruluyor.** Sokaktan sahiplenen
  kullanıcı doğum tarihini bilmiyor. "Bilmiyorum" gerçek bir seçenek ve
  `null` yazıyor — uydurma tarih üretilmiyor. Ayrıntı:
  `core/domain/pet-age.ts`.
- **Sahip görünürlüğü kayıtta sorulmuyor.** Kullanıcı eşleşmenin ne demek
  olduğunu görmeden verilecek bir karar değildi; varsayılan `after_match`
  zaten herkese açık değil ve açık rıza, "Herkese açık"a geçiş anında
  profilde alınıyor.

## Kapsam dışı (sonraki faz)

Premium/freemium, video profil, grup sohbeti, etkinlik & buluşma organizasyonu,
veteriner/petshop entegrasyonu, kayıp hayvan modülü.

Marka adı **PetMatch** olarak sabittir. Resmi işaret, asset kuralları ve palet
[`brand.md`](brand.md) içinde belgelenir.

## Sahip görünürlüğü — ürün kararı

Kullanıcı iki ayrı ayar tutar:

- **`owner_visibility`** — *benim* sahip profilim karşı tarafa ne zaman görünür:
  `hidden` · `after_match` (varsayılan) · `public`
- **`require_visible_owner`** — *benim* koyduğum zorunluluk: sadece sahibi
  görünen petleri göster.

Zorunluluk **çift yönlü** uygulanır: karşı taraf da bu zorunluluğu koyduysa,
kendi profilin gizliyken ona görünmezsin. Kural `core/domain/matching.ts`
(`isEligible`) ve `discover_playdate_pets()` RPC'sinde birebir aynı yazılıdır —
ikisi ayrışırsa sunucu tarafı bağlayıcıdır.

`require_visible_owner` simetrik bir kullanıcı kuralı olduğu için yalnızca
`profiles` tablosunda tutulur. `0012` migration'ı eski
`discovery_preferences` kopyasını birleştirip kaldırır.

**Sahip filtresi = sahip katmanı (`0059`).** Sahibe göre kurulan filtreler
(fotoğraf · sosyal mod · doğrulama · yaş · cinsiyet) yalnızca `public`
sahipli adayları değerlendirir; `after_match` ve `hidden` sahipli petler o
filtre açıkken destede hiç çıkmaz. Sebep yalnızca tutarlılık değil: filtreyi
"public olmayana uygulanmaz" diye muaf tutmak, filtre daraltılıp sonuç
kümesindeki değişim okunarak gösterilmeyen bir bilginin (gizli sahibin yaşı,
`after_match` sahibin cinsiyeti) çıkarılmasına izin veriyordu.

Sahip fotoğrafı private `owner-avatars` bucket'ındadır. Yalnızca sahibi,
public profil adayını gören oturum veya aktif eşleşmedeki karşı taraf kısa
ömürlü signed URL üretebilir. `after_match` seçeneği aktif sohbet içinde sahip
fotoğrafı, bio ve izin verilen yaş/cinsiyet özetini açar.

## Pet-first sosyal tanışma

Kullanıcı iki seçenekten birini seçer:

- **Yalnızca petime arkadaş:** ürünün varsayılan pet↔pet akışı.
- **Petimle birlikte yeni insanlarla tanışmak istiyorum:** arkadaşlık veya
  romantik bağ ihtimaline açık insan katmanını görünür eder; belirli bir
  ilişki vaadi değildir.

İkinci seçenek için ad + sahip fotoğrafı + public sahip profili zorunludur.
Sahip+pet birlikte fotoğraf doğrulaması ayrı bir güven rozetidir; sosyal modu
ilk günden kilitlemez. Kullanıcı isterse keşfette yalnızca doğrulanmış sahipleri
gösterir. Doğrulama onayı moderasyon kuyruğundan verilir.

Bugünkü boolean yalnız şeffaf sosyal köprüdür. Dating olarak mağaza
pazarlamasından önce arkadaşlık/dating/both ayrımı, karşılıklı niyet, daha
güçlü yaş güvencesi ve dating görünürlüğü için doğrulama kapısı
[`pet-first-connection.md`](pet-first-connection.md) uyarınca eklenir.

## Amaç modeli

Pet amaçları küme olarak tutulur: `playdate` ve `adoption`. Üreme amacı MVP'de
yoktur. Sosyal Keşfet yalnızca `playdate` petlerini gösterir; `adoption` ayrı
listeleme ve başvuru yüzeyidir. Ayrıntılı gerekçe [`goal-model.md`](goal-model.md)
içindedir.

## Kullanıcı başına tek aktif pet — ürün kararı

Şema pet↔pet eşleşme kuruyor: `swipes`, `matches` ve dolayısıyla sohbetler
petlere bağlı. İki hayvanı olan kullanıcı bu modelde aynı kişiyle **iki ayrı
eşleşme ve iki ayrı sohbet** açar, keşfette aynı adayı her peti için ayrı
görür, bir petiyle "pass" dediği profil öbür petiyle geri gelir.

MVP kararı: **kullanıcının aynı anda tek aktif peti olur.** Birden fazla pet
kaydedilebilir ama keşfet ve eşleşme her zaman tek bir "aktif pet" üzerinden
yürür; kullanıcı aktif peti **Profil → Petlerim** ekranından değiştirir.

> **2026-08-25 düzeltmesi.** Bu cümle uzun süre var olmayan bir ekranı
> anlatıyordu: pet yalnızca onboarding'de yaratılabiliyordu, uygulamada
> ikinci pet eklemenin ya da aktif peti değiştirmenin **hiçbir yolu yoktu**.
> Yani kural pratikte "tek hesap = sonsuza kadar tek pet"ti. En ağır bedeli
> petin ölmesiydi: kullanıcının tek çıkışı hesabı silmekti, o da bütün
> eşleşmelerini ve sohbetlerini götürüyordu. `0062` ile eksik yazma yolları
> (`create_my_pet`, `set_active_pet`) ve Petlerim ekranı eklendi.

İki kural ekranın merkezinde:

- **Aktif olmayan pet silinmez.** Sohbet geçmişi onun üzerinden asılı
  (`conversation_participants`) ve bir petin kaydı sahibi için bir anı.
- **Aktifleştirme ayrı ve bilinçli bir adım.** Yeni pet pasif doğar; en az
  bir fotoğrafı olmadan aktif edilemez (fotoğrafsız aktif pet, destede boş
  kart demek). Böylece kullanıcı mevcut petinin destedeki yerini yan etki
  olarak kaybetmez.

Aktif pet değişimi tek transaction'da yapılır: istemciden iki ayrı istek
atmak, arada bir hata olduğunda kullanıcıyı **hiç aktif peti olmayan**
duruma düşürürdü — o durumda Keşfet, swipe ve profil tamamlama hep birden
kırılır.

`0012` migration'ı `(owner_id) where is_active` unique index'iyle bu kararı
veritabanı düzeyinde zorlar. Sahiplendirme devri yeni sahibin önceki aktif
petini arşivler; geçmiş konuşmalar kalıcı katılımcı kayıtlarıyla korunur.

Çok petli gerçek destek (sahip çifti başına tekil `conversations` katmanı)
sonraki faza bırakıldı — o noktada mevcut sohbetlerin birleştirilmesi gerekir.
