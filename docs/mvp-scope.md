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

## Amaç (intent) ayrımı

`playdate` · `mating` · `both`. `both` her şeyle eşleşir, `playdate` ve
`mating` birbirleriyle eşleşmez. Bu ayrım baştan konuldu çünkü sonradan
eklemek tüm eşleşme geçmişini geriye dönük yorumlamayı gerektirirdi.
