# Pet-first sosyal tanışma kararı

## Karar

PetMatch'in uzun vadeli amacı yalnızca petlere oyun arkadaşı bulmak değildir.
Pet, benzer yaşam biçimine ve hayvan sevgisine sahip insanlar için gerçek bir
ortak nokta ve güven bağlamıdır. Ürün; oyun arkadaşlığı, dostluk veya romantik
bir bağa açık **pet-first sosyal tanışma** deneyimidir.

Bu, mağazadan ya da kullanıcıdan saklanan bir dating uygulaması değildir.
“Oyun arkadaşı” işlevi gerçektir; pet uyumu keşfeti ve ilk buluşmayı anlamlı
biçimde etkiler. Romantik bağ ihtimali de metinlerde, koşullarda ve mağaza
metadata'sında dürüstçe anlatılır.

Birincil marka cümlesi:

> **Petler tanıştırır. Bağınızı siz kurarsınız.**

“For pets. For their people.” marka mottosu kalır. “Only for pets and their
owners” kapsamı gereksiz daralttığı ve insan-insan bağını dışladığı için ana
motto olmaz.

## Bugünkü ürün ne kadar hazır?

Mevcut altyapının önemli kısmı yeniden kullanılabilir:

- 18+ doğum tarihi kapısı;
- private sahip fotoğrafı, görünürlük ve karşılıklı açıklama;
- sahip adı, bio, yaş kovası ve opsiyonel cinsiyet;
- `owner_social_open` ve karşılıklı sosyal filtre;
- sahip + aktif pet aynı kare doğrulaması;
- yaklaşık konum, engelleme, şikâyet, eşleşmeyi kaldırma ve hesap silme;
- karşılıklı beğeni sonrası private sohbet.

Bu yüzden ilk pet-first sosyal sürüm için büyük bir ekran yeniden yazımı
gerekmez. Fakat ürünü doğrudan “dating” kategorisinde pazarlamadan önce niyet,
uyumluluk, yaş güvencesi, moderasyon ve yasal sözleşme katmanları tamamlanmalıdır.

## Geçiş fazları

### Faz A — şeffaf sosyal köprü (şimdi)

`owner_social_open` iki anlaşılır durumu taşır:

1. yalnızca petime arkadaş;
2. petimle birlikte yeni insanlarla tanışmaya açığım.

İkinci durum arkadaşlık veya romantik bağ ihtimalini dürüstçe açıklar; belirli
bir ilişki vaadi değildir. Ad + sahip fotoğrafı + public sahip profili zorunlu
kalır. Eşleşme hâlâ pet uyumuyla başlar.

### Faz B — dating pazarlamasından önce P0

Boolean alanı sürümlü bir `connection_mode` modeline taşı:

```text
pets_only | friendship | dating | friendship_or_dating
```

- Mod seçiminde neyin keşfette gösterileceğini açıkla ve sürümlü onay kaydı tut.
- Yalnız karşılıklı olarak uyumlu modları birbirine göster.
- `dating` ve `friendship_or_dating` için ad + sahip fotoğrafı + public profil
  zorunlu olsun.
- Dating görünürlüğünden önce sahip+pet doğrulamasını tamamlat. Bu rozet
  “kimlik doğrulandı” diye sunulmaz; yalnız başvurudaki kişi ile aktif petin
  aynı karede olduğunun moderasyonla kontrol edildiğini söyler.
- Self-declared doğum tarihine ek olarak risk-temelli yaş güvencesi ve mağaza
  tarafında reşit olmayan erişimini kısıtlama ayarları uygulanır.
- Bio, fotoğraf ve mesajlar için içerik standardı, uygulama içi rapor/engelleme,
  yayınlanmış destek iletişimi ve zamanında moderasyon SLA'sı uçtan uca test edilir.
- App Store/Play açıklaması, ekran görüntüsü, kategori, yaş derecesi ve review
  notları gerçek sosyal/dating deneyimini açıkça gösterir.
- Değişen koşullar mevcut kullanıcılara yeniden gösterilir; sessizce yeni amaç
  altında veri işlenmez.

### Faz C — insan uyumluluğu

Pet uyumuna ek olarak hassas olmayan, cevaplaması opsiyonel yaşam biçimi
prompt'ları eklenebilir:

- pet bakım yaklaşımı ve hayvan refahı;
- yürüyüş/ev düzeni ve sosyal enerji;
- ilk buluşma tercihi: park, kafe, grup yürüyüşü;
- planlı/spontane iletişim tarzı;
- hafta içi/hafta sonu uygunluk kovaları.

Siyasi görüş, inanç, sağlık, cinsel hayat veya kullanıcı mesajlarından çıkarılan
etiketler eşleşme amacıyla profillenmez. Serbest bio metninden “mindset skoru”
üretilmez.

## Veri sınırları

| Veri | Karar |
|---|---|
| Bağlantı modu | Açık kullanıcı seçimi, amaçla sınırlı, silinebilir |
| Sahibin cinsiyeti | Opsiyonel sıradan kişisel veri; karşılıklı açıklama |
| Kimi görmek istediği | Sunucuda kalıcı tercih olarak tutulmaz; birleşik veri yönelim çıkarımı yaratabilir |
| Cinsel yönelim/cinsel hayat | MVP'de toplanmaz veya çıkarılmaz |
| Kesin yaş/doğum tarihi | 18+ kontrolü için private; kartta yalnız yaş kovası |
| Kesin konum | Gönderilmez; yaklaşık bölge ve mesafe kovası |
| Doğrulama fotoğrafı | Private, karar sonrası silinir; biyometrik tanıma yapılmaz |
| Mesaj/bio/fotoğraf | UGC ve güvenlik politikalarına tabi; reklam profillemesine girmez |

KVKK bakımından cinsel hayata ilişkin veri özel niteliklidir. İleride yönelim
veya cinsiyet tercihi açıkça toplanacaksa yalnız bir checkbox eklemek yeterli
değildir: belirli ve bilgilendirilmiş açık rıza, geri alma, veri minimizasyonu,
saklama/silme, aktarım ve yeterli güvenlik önlemleri hukuk incelemesiyle birlikte
tasarlanmalıdır.

## Yayın kabul testleri

1. Yeni kullanıcı ürünün pet-first sosyal/dating amacını kayıt olmadan anlar.
2. Pets-only kullanıcı dating kartına zorlanmaz ve dating modundakilerce bu
   amaçla filtrelenmez.
3. Dating görünürlüğü ad/fotoğraf/public profil/doğrulama koşullarını atlayamaz.
4. İki hesapta karşılıklı niyet + pet uyumu eşleşir; uyumsuz niyet eşleşmez.
5. Engelleme konuşmayı ve Realtime kanalını kapatır; rapor kuyruğa düşer.
6. Yaş kapısı ve mağaza reşit olmayan erişim kısıtı fiziksel cihazda sınanır.
7. Profil, koşullar, gizlilik metni ve mağaza metadata'sı aynı amacı söyler.
8. Dil değiştirilince UI, native izinler, e-posta/push ve yasal metin aynı dilde
   kalır; eksik katalogla dil yayınlanmaz.

## Resmi politika dayanakları

- Apple App Review Guidelines 1.2, 2.3 ve 4.3:
  https://developer.apple.com/app-store/review/guidelines/
- Google Play UGC:
  https://support.google.com/googleplay/android-developer/answer/9876937
- Google Play incidental dating/minor protection:
  https://support.google.com/googleplay/android-developer/answer/16838200
- KVKK özel nitelikli kişisel veriler:
  https://www.kvkk.gov.tr/Icerik/8364/Ozel-Nitelikli-Kisisel-Verilerin-Islenme-Sartlari
- KVKK açık rıza:
  https://www.kvkk.gov.tr/Icerik/2037/Acik-Riza-Alirken-Dikkat-Edilecek-Hususlar
