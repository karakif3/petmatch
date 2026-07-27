# MVP kapsamı

> Temel akış: hesap aç → pet profili oluştur → yakındaki uyumlu petleri gör →
> karşılıklı beğeni = eşleşme → mesajlaş.

## Kapsam içi

| Modül | Kapsam | Durum |
|---|---|---|
| Auth | E-posta + şifre. Google/Apple sonra. | ✅ iskelet |
| Sahip profili | Ad, avatar, şehir, bio, **görünürlük tercihi** | ⬜ ekran yok |
| Pet profili | Ad, tür, ırk, doğum tarihi, cinsiyet, kısırlaştırma, boyut, enerji, mizaç, uyumluluk, amaç, 1–6 fotoğraf | ⬜ ekran yok |
| Keşfet | Mesafe + tür + amaç + yaş filtresi, uyum skoruna göre sıralı deste | ✅ mantık · ⬜ ekran |
| Eşleşme | Karşılıklı beğeni → trigger ile match | ✅ DB |
| Mesajlaşma | Eşleşme sonrası 1-1 metin | ✅ DB · ⬜ ekran |
| Bildirim | Yeni eşleşme, yeni mesaj | ⬜ |
| Güvenlik | Engelle, şikayet et, hesap silme | ✅ DB · ⬜ ekran |
| Ayarlar | Görünürlük, bildirim, konum, dil | ⬜ |

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

> ⚠️ `require_visible_owner` şu an hem `profiles` hem `discovery_preferences`
> tablosunda duruyor ve `discover_pets()` ikisini karışık okuyor (kendi
> zorunluluğunu `discovery_preferences`'tan, karşı tarafınkini `profiles`'tan).
> Kural bu haliyle yarım çalışır. Çözüm [`goal-model.md`](goal-model.md) §3'te:
> simetrik olduğu için `profiles`'ta kalır, `discovery_preferences`'tan silinir.

## Amaç (intent) ayrımı

`playdate` · `mating` · `both`. `both` her şeyle eşleşir, `playdate` ve
`mating` birbirleriyle eşleşmez. Bu ayrım baştan konuldu çünkü sonradan
eklemek tüm eşleşme geçmişini geriye dönük yorumlamayı gerektirirdi.

> ℹ️ Bu bölüm [`goal-model.md`](goal-model.md) ile genişletiliyor: amaç tek
> değer olmaktan çıkıp dört elemanlı bir kümeye dönüşüyor (hayvan için
> oyun/eş, sahip için arkadaşlık/ilişki) ve `both` özel durumu kalkıyor.
> Migration yazılana kadar geçerli olan şema bu bölümdür.

## Kullanıcı başına tek aktif pet — ürün kararı

Şema pet↔pet eşleşme kuruyor: `swipes`, `matches` ve dolayısıyla sohbetler
petlere bağlı. İki hayvanı olan kullanıcı bu modelde aynı kişiyle **iki ayrı
eşleşme ve iki ayrı sohbet** açar, keşfette aynı adayı her peti için ayrı
görür, bir petiyle "pass" dediği profil öbür petiyle geri gelir.

MVP kararı: **kullanıcının aynı anda tek aktif peti olur.** Birden fazla pet
kaydedilebilir ama keşfet ve eşleşme her zaman tek bir "aktif pet" üzerinden
yürür; kullanıcı aktif peti profil ekranından değiştirir.

Bu karar şemayı değiştirmez — `is_active` zaten pets üzerinde var. Ekranlar
yazılırken uygulanacak; istenirse `create unique index on pets (owner_id)
where is_active` ile veritabanı düzeyinde de zorlanabilir.

Çok petli gerçek destek (sahip çifti başına tekil `conversations` katmanı)
sonraki faza bırakıldı — o noktada mevcut sohbetlerin birleştirilmesi gerekir.
