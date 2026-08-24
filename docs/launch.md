# Lansman — pilot bölge kararı

## Karar

| | |
|---|---|
| Başlangıç şehri | **İstanbul** |
| Pilot bölgeler | **Kadıköy**, **Nişantaşı** ve **Beşiktaş** |

## Neden tek şehirde üç ilçe

Eşleşme ürününün en büyük riski onboarding değil, **ilk kullanıcının boş
desteyle karşılaşması.** Bu bir üründe değil dağıtımda çözülen bir problem:
yoğunluk coğrafi olarak yoğunlaşmadan hiçbir keşfet listesi dolmuyor.

25 km yarıçapla İstanbul'a yayılmış 200 kullanıcı, herkes için seyrek bir
deste demek. Aynı 200 kullanıcının Kadıköy'e sıkışması, yürüme mesafesinde
gerçek buluşmalar demek. Ürünün başarı metriği zaten "kaç konuşma buluşmaya
döndü" olduğuna göre ([`benchmark.md`](benchmark.md)), coğrafi yoğunluk
doğrudan o metriği besliyor.

Üç ilçe seçilmesinin sebebi karşılaştırma: farklı profillerdeki üç
bölgede aynı ürünün nasıl çalıştığını görmek, sonraki bölgeyi seçerken
tahmine değil veriye dayanmayı sağlıyor.

## Bu karar neyi açıyor

| Bekleyen iş | Durum |
|---|---|
| Buluşma yeri önerisi | Artık yapılabilir — hangi şehir belli |
| Pilot bölge yoğunluk ölçümü | Yapılmalı (aşağıda) |
| Sahip segmentinin görünür olması | Yoğunluğa bağlı, kendiliğinden açılacak |
| Sahiplendirme giriş kartı | Yoğunluğa bağlı, kendiliğinden açılacak |

## Buluşma yeri: doğrulama kaynağı kullanıcıya gösterilmeli

[`benchmark.md`](benchmark.md) §3'teki özelliğin engeli koddu değil veriydi;
şehir seçilince engel kalktı. Dört nokta 2026-08-15 tarihinde resmi belediye
kaynaklarıyla masa başında doğrulandı; doğrulama yöntemi ve kaynak bağlantısı
artık veride tutuluyor ve kullanıcıya gösteriliyor.

İnternet doğrulaması yerin varlığını ve belediyenin yayımladığı pet olanağını
kanıtlar; güncel tasma kuralını, geçici kapanmayı veya fiziksel koşulları garanti
etmez. Bu nedenle `official_source` ile `field` ayrı doğrulama seviyeleridir.

Aşağıdaki adaylar bilinen, halka açık ve köpek gezdirilen alanlar olarak
öneriliyor — ama her biri lansmandan önce **yerinde teyit edilmeli**: bir
parkın kural değişikliğiyle hayvan girişine kapanmış olması ya da tasmasız
alan bulunmaması mümkün. Kullanıcıyı yanlış yere göndermek, güvenlik
özelliği olarak konumlandırdığımız şeyin tam tersi olur.

**Resmi kaynakla doğrulananlar:**

- Yoğurtçu Parkı — Kadıköy Belediyesi yenileme duyurusunda evcil hayvan parkı
  ve yürüyüş parkuru belirtiliyor.
- Özgürlük Parkı — Kadıköy Belediyesi 2023 Faaliyet Raporu köpek gezdirme
  alanını belirtiyor.
- Moda Parkı — aynı faaliyet raporu köpek gezdirme alanını belirtiyor.
- Maçka Demokrasi Parkı — İBB Veteriner Hizmetleri kaynağında DuşPet noktası
  belirtiliyor; İBB faaliyet raporu alanı halka açık büyük park olarak kaydediyor.

**Kanıtı yetersiz olduğu için kapalı kalanlar:** Fenerbahçe Parkı · Teşvikiye
çevresi. İkincisi ayrıca belirli bir buluşma noktası değil.

Kaynaklar en geç altı ayda bir yeniden açılıp kontrol edilmeli. Kaynak kalkmışsa,
pet olanağı geri çekilmişse veya saha bilgisiyle çelişiyorsa `is_verified`
hemen kapatılmalı.

Her aday için teyit edilmesi gerekenler:

- Hayvan girişi serbest mi, tasma zorunluluğu ne
- Halka açık ve gündüz kalabalık mı (ilk buluşma güvenliği)
- Su kaynağı / gölgelik var mı
- Toplu taşımayla ulaşılabilir mi

**Yapı `0038` ile kuruldu; kaynaklı doğrulama `0052` ile eklendi.**

Adaylar `meetup_places` tablosunda tutuluyor. RLS yalnız doğrulanmış ve aktif
satırları gösteriyor; sohbetteki "Buluşma yeri" butonu liste boşken çıkmıyor.
`0052` migration'ı kaynak, kontrol tarihi, doğrulama yöntemi ve pet olanaklarını
ekledi.

Saha teyidinden sonra tek hamle:

```sql
select set_meetup_place_verification('<place_id>', true, 'Tasmasız alan var');
```

Aday listesini `list_meetup_place_candidates()` ile alırsın (moderatör yetkisi
gerekiyor). Doğrulama geri de alınabilir — bir park kapanırsa aynı fonksiyonla
`false` yapmak yeterli, satırı silmeye gerek yok.

## Ölçüm: bölge kırılımı — ✅ `0037`

`pets.city` ve `profiles.city` **serbest metin** — "İstanbul", "istanbul" ve
"Kadıköy/İstanbul" aynı sorguda toplanmıyor. Pilotun tüm amacı üç ilçeyi
karşılaştırmak olduğuna göre bu ölçülemezdi.

`0037` serbest metni **kaldırmıyor** (şehir hâlâ kullanıcıya gösterilen bilgi),
yanına ölçülebilir bir anahtar ekliyor:

- `regions` tablosu — `kadikoy` · `nisantasi` · `besiktas` · `other`. Enum değil tablo,
  çünkü yeni bölge açmak istemci sürümü gerektirmemeli.
- `profiles.region_slug` — **null ile `other` ayrı**: onboarding'i
  tamamlamamış kullanıcıyla "başka yerdeyim" diyeni aynı kovaya koymak pilot
  ölçümünü bozar.
- `set_my_region()` — dar yazma yolu
- `region_density()` — moderatöre açık; bölge başına onboarded kullanıcı ve
  aktif peti olan kullanıcı sayısı

Onboarding'in ilk adımında bölge seçimi zorunlu. Seçilen bölge aynı zamanda
Keşfet arama havuzudur (`0057`): üç pilot ilçe birbirini görmez, bekleme
listesi (`other`) destede yoktur. Cihaz konumu isteğe bağlıdır ve yalnızca
aynı bölge içinde mesafe etiketi/filtresi üretir.

Pilot dışındaki kullanıcıdan
ilçe/şehir ve haber alma tercihi `region_waitlist` tablosunda tutulur.
`region_demand()` moderatör sorgusu talepleri normalize edilmiş yer adına göre
sıralar; sonraki bölge böylece toplam ilgi ve bildirim talebiyle seçilir.

Bu, `discovery_segment_changed` ve `meetup_feedback` olaylarıyla birlikte
"terfi" kararlarının (ayrı tab, yeni bölge, sesli görüşme) veriyle
verilmesini mümkün kılıyor.

## Lansman öncesi hatırlatma

Migration geçmişi Supabase CLI ile yerel/uzak karşılaştırılarak korunuyor.

**Bölge taşıması tamamlandı (2026-08-04):** proje artık `eu-central-1`
(Frankfurt), ref `ktlefybtankyywxuafvh`. İstanbul'a ~30 ms daha yakın.
Kayıt ve bir dahaki sefere reçete: [`region-migration.md`](region-migration.md)

Bekleyen iki operasyon işi:

1. **Fiziksel iki cihaz duman testi** — eşleşme → kaynaklı yer seçimi → öneri
   → kabul → takvim akışı iki kullanıcıyla doğrulanmalı.
2. **Park listesinin saha teyidi** — internet doğrulamasını `field` seviyesine
   yükseltmek için yukarıdaki kontrol listesi tamamlanmalı.
