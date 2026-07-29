# PetMatch marka sistemi

## Konumlandırma

PetMatch, petleri gerçek bir ortak nokta yapan pet-first sosyal tanışma
markasıdır. Oyun arkadaşlığı, dostluk veya romantik bağ ihtimalini sıcak ve
güvenilir bir ortamda birleştirir. Tonu samimi, açık ve hayvan odaklıdır;
insan bağını kullanıcıdan veya mağazadan saklamaz, insanları nesneleştiren
“hot-or-not” diline de kaymaz.

## Motto

Birincil motto **“For pets. For their people.”** ifadesidir. Kısa, sahipleri
ikincil görmeden pet odağını korur. Türkçe ürün vaadi **“Petler tanıştırır.
Bağınızı siz kurarsınız.”** ifadesidir. **“Only for pets and their owners.”**
kapsamı gereksiz daraltır; ana motto veya ürün vaadi olarak kullanılmaz.

Konumlandırmanın ayrıntısı ve dating yayın kapıları
[`pet-first-connection.md`](pet-first-connection.md) içindedir.

## İşaret

Marka işareti birbirine dönük bir kedi ve köpeği tek kalp formunda birleştirir.
Aradaki küçük teal bağ, karşılıklı eşleşmeyi temsil eder. İşaretin içinde yazı
yoktur ve küçük uygulama ikonu boyutlarında da okunacak kalınlıktadır.

| Asset | Kullanım |
|---|---|
| `assets/icon.png` | iOS uygulama ikonu, web favicon kaynağı, uygulama içi marka kartı |
| `assets/adaptive-icon.png` | Şeffaf Android adaptive/monochrome foreground |
| `assets/splash-icon.png` | Şeffaf native splash işareti |
| `assets/favicon.png` | 96 px web favicon |

İkonlara dışarıdan rounded-corner çizilmez; iOS ve Android maskeyi kendisi
uygular. Uygulama içindeki `BrandMark` bileşeni görseli tutarlı bir köşe
yarıçapıyla sunar.

## Palet

| Rol | Renk | Kullanım |
|---|---|---|
| Brand | `#F97362` | Birincil aksiyon, ikon zemini, aktif durum |
| Brand dark | `#E0523F` | Vurgu metni ve basılı durum |
| Accent | `#2FB8A6` | Eşleşme, başarı ve bağlantı |
| Background | `#FFFBF7` | Ana sıcak uygulama zemini |
| Surface | `#FFFFFF` | Kartlar ve form alanları |
| Text | `#1F1A17` | Birincil metin |

Mercan ve teal aynı yüzeyde yalnızca anlamlı vurgu için birlikte kullanılır.
Uzun metinler renkli zemin üzerine yerleştirilmez; okunabilirlik için koyu
metin ve açık yüzey korunur.
