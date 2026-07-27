# MVP kapsamı

> Temel akış: hesap aç → pet profili oluştur → yakındaki uyumlu petleri gör →
> karşılıklı beğeni = eşleşme → mesajlaş.

## Kapsam içi

| Modül | Kapsam | Durum |
|---|---|---|
| Auth | E-posta + şifre. Google/Apple sonra. | ✅ iskelet |
| Sahip profili | Opsiyonel ad, avatar, şehir, bio, **görünürlük tercihi** | ✅ onboarding + ad/şehir/görünürlük düzenleme · ⬜ avatar/bio düzenleme |
| Pet profili | Ad, tür, ırk, doğum tarihi, cinsiyet, kısırlaştırma, boyut, enerji, mizaç, uyumluluk, amaç, 1–6 fotoğraf | ✅ onboarding + ad/konum düzenleme + fotoğraf · ⬜ diğer ayrıntıları düzenleme |
| Keşfet | Mesafe + tür + yaş filtresi, uyum skoruna göre sıralı playdate destesi | ✅ RPC + güvenli swipe + ekran |
| Eşleşme | Karşılıklı beğeni → trigger ile match | ✅ DB + inbox ekranı |
| Mesajlaşma | Eşleşme sonrası 1-1 metin | ✅ DB + Realtime sohbet ekranı |
| Bildirim | Yeni eşleşme, yeni mesaj | ✅ istemci tercih/token akışı + Edge Function · ⏳ EAS proje bağlantısı/native build |
| Güvenlik | Engelle, şikayet et, hesap silme | ✅ DB · ⬜ ekran |
| Ayarlar | Görünürlük, bildirim, konum, dil | ✅ görünürlük + bildirim + konum · ⬜ dil |

Pet adı zorunludur ve ürünün birincil görünen kimliğidir. Sahip adı
opsiyoneldir; boş bırakıldığında sahibi görünür yapma tercihi diğer profil
bilgilerini açabilir fakat bir ad metni gösterilmez.

## Kapsam dışı (sonraki faz)

Premium/freemium, video profil, grup sohbeti, etkinlik & buluşma organizasyonu,
veteriner/petshop entegrasyonu, kayıp hayvan modülü.

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
