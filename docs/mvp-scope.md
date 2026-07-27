# MVP kapsamı

> Temel akış: hesap aç → pet profili oluştur → yakındaki uyumlu petleri gör →
> karşılıklı beğeni = eşleşme → mesajlaş.

## Kapsam içi

| Modül | Kapsam | Durum |
|---|---|---|
| Auth | E-posta + şifre. Google/Apple sonra. | ✅ iskelet |
| Sahip profili | Opsiyonel ad, avatar, şehir, bio, yaş/cinsiyet açıklaması, görünürlük ve pet buluşmasında sosyalleşme | ✅ tam düzenleme + private avatar + doğrulama başvurusu |
| Pet profili | Ad, tür, ırk, doğum tarihi, cinsiyet, kısırlaştırma, boyut, enerji, mizaç, uyumluluk, amaç, 1–6 fotoğraf | ✅ tam düzenleme + fotoğraf ekleme/silme/sıralama |
| Keşfet | Mesafe + pet filtreleri + karşılıklı sahip fotoğrafı/sosyal/verification/yaş/cinsiyet filtreleri | ✅ RPC + güvenli swipe + filtre ekranı |
| Eşleşme | Karşılıklı beğeni → trigger ile match | ✅ DB + inbox ekranı |
| Mesajlaşma | Eşleşme sonrası 1-1 metin | ✅ DB + Realtime sohbet ekranı |
| Bildirim | Yeni eşleşme, yeni mesaj | ✅ istemci tercih/token akışı + Edge Function + EAS bağlantısı · ⏳ fiziksel cihaz build/test |
| Güvenlik | Engelle, şikayet et, eşleşmeyi kaldır, hesap silme | ✅ DB + keşfet/sohbet/profil ekranları |
| Ayarlar | Görünürlük, bildirim, konum, dil | ✅ görünürlük + bildirim + konum · ⬜ dil |

Pet adı zorunludur ve ürünün birincil görünen kimliğidir. Sahip adı
opsiyoneldir; boş bırakıldığında sahibi görünür yapma tercihi diğer profil
bilgilerini açabilir fakat bir ad metni gösterilmez.

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
(`isEligible`) ve `discover_pets()` RPC'sinde birebir aynı yazılıdır —
ikisi ayrışırsa sunucu tarafı bağlayıcıdır.

`require_visible_owner` simetrik bir kullanıcı kuralı olduğu için yalnızca
`profiles` tablosunda tutulur. `0012` migration'ı eski
`discovery_preferences` kopyasını birleştirip kaldırır.

Sahip fotoğrafı private `owner-avatars` bucket'ındadır. Yalnızca sahibi,
public profil adayını gören oturum veya aktif eşleşmedeki karşı taraf kısa
ömürlü signed URL üretebilir. `after_match` seçeneği aktif sohbet içinde sahip
fotoğrafı, bio ve izin verilen yaş/cinsiyet özetini açar.

## Pet buluşmasında sahip sosyalleşmesi

Kullanıcı iki seçenekten birini seçer:

- **Yalnızca petime arkadaş:** ürünün varsayılan pet↔pet akışı.
- **Pet buluşmasında ben de sosyalleşmeye açığım:** genel arkadaşlık/flört
  amacı değildir; ortak pet buluşmasındaki insan katmanını açık eder.

İkinci seçenek için ad + sahip fotoğrafı + public sahip profili zorunludur.
Sahip+pet birlikte fotoğraf doğrulaması ayrı bir güven rozetidir; sosyal modu
ilk günden kilitlemez. Kullanıcı isterse keşfette yalnızca doğrulanmış sahipleri
gösterir. Doğrulama onayı moderasyon kuyruğundan verilir.

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
yürür; kullanıcı aktif peti profil ekranından değiştirir.

`0012` migration'ı `(owner_id) where is_active` unique index'iyle bu kararı
veritabanı düzeyinde zorlar. Sahiplendirme devri yeni sahibin önceki aktif
petini arşivler; geçmiş konuşmalar kalıcı katılımcı kayıtlarıyla korunur.

Çok petli gerçek destek (sahip çifti başına tekil `conversations` katmanı)
sonraki faza bırakıldı — o noktada mevcut sohbetlerin birleştirilmesi gerekir.
