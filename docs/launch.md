# Lansman — pilot bölge kararı

## Karar

| | |
|---|---|
| Başlangıç şehri | **İstanbul** |
| Pilot bölgeler | **Kadıköy** ve **Nişantaşı** |

## Neden tek şehir, hatta tek şehirde iki mahalle

Eşleşme ürününün en büyük riski onboarding değil, **ilk kullanıcının boş
desteyle karşılaşması.** Bu bir üründe değil dağıtımda çözülen bir problem:
yoğunluk coğrafi olarak yoğunlaşmadan hiçbir keşfet listesi dolmuyor.

25 km yarıçapla İstanbul'a yayılmış 200 kullanıcı, herkes için seyrek bir
deste demek. Aynı 200 kullanıcının Kadıköy'e sıkışması, yürüme mesafesinde
gerçek buluşmalar demek. Ürünün başarı metriği zaten "kaç konuşma buluşmaya
döndü" olduğuna göre ([`benchmark.md`](benchmark.md)), coğrafi yoğunluk
doğrudan o metriği besliyor.

İki mahalle seçilmesinin sebebi karşılaştırma: farklı profillerdeki iki
bölgede aynı ürünün nasıl çalıştığını görmek, üçüncü bölgeyi seçerken
tahmine değil veriye dayanmayı sağlıyor.

## Bu karar neyi açıyor

| Bekleyen iş | Durum |
|---|---|
| Buluşma yeri önerisi | Artık yapılabilir — hangi şehir belli |
| Pilot bölge yoğunluk ölçümü | Yapılmalı (aşağıda) |
| Sahip segmentinin görünür olması | Yoğunluğa bağlı, kendiliğinden açılacak |
| Sahiplendirme giriş kartı | Yoğunluğa bağlı, kendiliğinden açılacak |

## Buluşma yeri: aday liste doğrulanmadan gönderilmemeli

[`benchmark.md`](benchmark.md) §3'teki özelliğin engeli koddu değil veriydi;
şehir seçilince engel kalktı ama **yerinde doğrulama** hâlâ gerekiyor.

Aşağıdaki adaylar bilinen, halka açık ve köpek gezdirilen alanlar olarak
öneriliyor — ama her biri lansmandan önce **yerinde teyit edilmeli**: bir
parkın kural değişikliğiyle hayvan girişine kapanmış olması ya da tasmasız
alan bulunmaması mümkün. Kullanıcıyı yanlış yere göndermek, güvenlik
özelliği olarak konumlandırdığımız şeyin tam tersi olur.

**Kadıköy adayları:** Yoğurtçu Parkı · Özgürlük Parkı · Fenerbahçe Parkı ·
Moda Sahili

**Nişantaşı adayları:** Maçka Demokrasi Parkı · Teşvikiye çevresi

Her aday için teyit edilmesi gerekenler:

- Hayvan girişi serbest mi, tasma zorunluluğu ne
- Halka açık ve gündüz kalabalık mı (ilk buluşma güvenliği)
- Su kaynağı / gölgelik var mı
- Toplu taşımayla ulaşılabilir mi

**Yapı `0038` ile kuruldu; veri doğrulaman bekleniyor.**

Adaylar `meetup_places` tablosuna `is_verified = false` olarak yüklendi ve
kullanıcıya **görünmüyorlar** — RLS doğrulanmamış satırı hiç vermiyor, sohbetteki
"Buluşma yeri" butonu da liste boşken hiç çıkmıyor. Yani özellik yayında
olabilir ve yine de kimseyi yanlış yere yollamaz.

Saha teyidinden sonra tek hamle:

```sql
select set_meetup_place_verification('<place_id>', true, 'Tasmasız alan var');
```

Aday listesini `list_meetup_place_candidates()` ile alırsın (moderatör yetkisi
gerekiyor). Doğrulama geri de alınabilir — bir park kapanırsa aynı fonksiyonla
`false` yapmak yeterli, satırı silmeye gerek yok.

## Ölçüm: bölge kırılımı — ✅ `0037`

`pets.city` ve `profiles.city` **serbest metin** — "İstanbul", "istanbul" ve
"Kadıköy/İstanbul" aynı sorguda toplanmıyor. Pilotun tüm amacı iki mahalleyi
karşılaştırmak olduğuna göre bu ölçülemezdi.

`0037` serbest metni **kaldırmıyor** (şehir hâlâ kullanıcıya gösterilen bilgi),
yanına ölçülebilir bir anahtar ekliyor:

- `regions` tablosu — `kadikoy` · `nisantasi` · `other`. Enum değil tablo,
  çünkü yeni bölge açmak istemci sürümü gerektirmemeli.
- `profiles.region_slug` — **null ile `other` ayrı**: onboarding'i
  tamamlamamış kullanıcıyla "başka yerdeyim" diyeni aynı kovaya koymak pilot
  ölçümünü bozar.
- `set_my_region()` — dar yazma yolu
- `region_density()` — moderatöre açık; bölge başına onboarded kullanıcı ve
  aktif peti olan kullanıcı sayısı

Onboarding'in ilk adımında bölge seçimi zorunlu. "Diğer" seçenlerin sayısı,
üçüncü bölgeyi tahminle değil veriyle seçmenin tek yolu.

Bu, `discovery_segment_changed` ve `meetup_feedback` olaylarıyla birlikte
"terfi" kararlarının (ayrı tab, yeni bölge, sesli görüşme) veriyle
verilmesini mümkün kılıyor.

## Lansman öncesi hatırlatma

Migration'lar canlı projeye uygulandı (2026-08-03). Yerel ve uzak geçmiş
birebir eşleşiyor: 39 migration, bekleyen yok.

**Bölge taşıması tamamlandı (2026-08-04):** proje artık `eu-central-1`
(Frankfurt), ref `ktlefybtankyywxuafvh`. İstanbul'a ~30 ms daha yakın.
Kayıt ve bir dahaki sefere reçete: [`region-migration.md`](region-migration.md)

Bekleyen iki iş:

1. **Duman testi + moderatör satırı** — yeni projede hiç kullanıcı yok;
   `app_user_roles` satırı ilk kayıttan sonra girilecek. O satır girilene
   kadar park doğrulaması dahil altı moderatör fonksiyonu erişilemez.
2. **Park listesinin saha teyidi** — yukarıda
