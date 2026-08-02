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

Liste doğrulandıktan sonra tablo + RPC + sohbet içi eylem yazılır. Bu sıra
bilinçli: **doğrulanmamış yer verisiyle özellik göndermek, boş özellik
göndermekten daha kötü.**

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

Migration'lar `0034`–`0037` henüz canlı Supabase projesine uygulanmadı.
Bkz. [`services.md`](services.md).
