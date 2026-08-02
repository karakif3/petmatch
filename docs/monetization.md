# Gelir modeli

> **Durum:** karar verildi, uygulanmadı. MVP'de gelir yok; mekanikler
> yoğunluk oluştuktan sonra açılır. Bu belge zamanla en çok değişecek
> dokümandır — amaç modelini ([`goal-model.md`](goal-model.md)) kirletmesin
> diye ayrı tutuluyor.

## Karar

**Para yalnızca insan katmanından alınır. Misyon tarafı ücretsizdir ve
sponsorlukla finanse edilir.**

| Yüzey | Gelir |
|---|---|
| İnsan katmanı — kim beğendi · boost · swipe mekanikleri · son aktif | Kullanıcı öder |
| Sahiplendirme ve misyon tarafı | **Asla kullanıcı ödemez** — sponsorluk / marka |

Bu ayrım, iki tur önce adlandırılan gerilimi çözüyor: *en çok para getirecek
özellik, pazarlayamayacağın özellikti.* Ayrımın sonucu ise anlatılabilir bir
hikâye — **insan katmanı misyonu sübvanse eder.**

Klasik eşleşme uygulaması oyun kitabı uygulanacak: **kim beğendi · boost ·
swipe mekanikleri · son aktif sıralaması.** Bunun anlamı, uygulamanın
fonksiyonel olarak bir dating app olduğunu kabul etmektir.

Kararın iç tutarlılığı önemli: abonelik mekanikleri **günlük kullanım**
gerektirir, onu da pet tarafı değil insan katmanı üretir. Yani insan katmanı
artık örtük bir yan etki değil, **birincil yüzey**.

Bunu hikâyeyle çelişmeden taşımanın yolu:

> **Pet arayüzdür, insan katmanı motordur.** Kartlar pet, sohbet açılışları
> pet üzerinden, anlatı pet — ama frekansı ve ödeme isteğini insan tarafı
> yaratır.

### Bunun bedeli

- **Google Play'in ayrı dating uygulaması politikası** devreye giriyor
- **Apple 1.2 moderasyon işi ertelenemez hale geliyor**: şikâyet, engelleme,
  24 saat müdahale SLA'sı, doğrulama — "sonra" listesinden "yayın öncesi"
  listesine geçer
- Kategori rekabeti sertleşir (ASO, kullanıcı edinme maliyeti)
- 18+ derecelendirme (zaten karar verilmişti)

---

## Faz sırası

| Faz | İçerik | Neden burada |
|---|---|---|
| **0 — MVP** | Gelir yok | Pazar yeri ürününde yoğunluktan önce para kazanmak büyümeyi öldürür. Boş deste zaten en büyük risk. |
| **1** | Kim beğendi · boost · gelişmiş pet/uyumluluk filtreleri · son aktif sıralaması | Kanıtlanmış motor; yoğunluk oluşur oluşmaz açılır |
| **2** | Sahiplenme sonrası ticaret ortaklığı (mama, ekipman, ilk veteriner) | En yüksek ticari niyetli an, misyonla uyumlu, Apple komisyonu dışında |
| **3** | Doğrulanmış hizmet dizini (veteriner · kuaför · pet sitter · eğitmen) | 7332 hayvan **satışını** yasaklıyor, hizmeti değil |
| **3b** | Hayvan kabul eden mekân sponsorluğu (kafe, veteriner) | `meetup_places` altyapısı hazır; mekân öder, kullanıcı ödemez |
| **4** | Marka sponsorluğu / CSR | Pet markaları için değerli kitle; sahiplendirme misyonu CSR bütçesinin finanse ettiği şey |

Teknik bir not faz 2-3'ü cazip tutuyor: **dijital abonelik Apple'a %15-30
komisyon ödetir; fiziksel ürün ve gerçek dünya hizmeti ödetmez.** Aynı ciroda
net gelir belirgin şekilde farklı.

---

## Uygulama kuralları

### "Kim beğendi" — RLS gevşetilmez

`swipes_select_own` politikası yalnızca kendi swipe'ını gösteriyor ve öyle
kalmalı. Politika gevşetilirse tüm beğeni grafiği sızar. Katman farkı
SECURITY DEFINER fonksiyonların içinde yaşar:

| Katman | Fonksiyon | Döndürdüğü |
|---|---|---|
| Ücretsiz | `pending_likes_count()` | Yalnızca sayı — "3 kişi beğendi" |
| Ücretli | `pending_likes()` | Kimlikler |

Ham tabloya erişim hiçbir katmanda açılmaz.

### Son aktif — kolon yok, ve kaba olmalı

`last_active_at` şemada mevcut değil, eklenmeli. Ama **"2 dakika önce aktifti"
gösterilmez** — taciz edenlerin hedef takibi için kullandığı bilinen bir
sinyaldir.

Mesafede uygulanan desenin aynısı: sıralama ve filtre sunucuda kesin değerle
çalışır, istemciye kova çıkar — `bugün` · `bu hafta` · `bu ay`.

### Swipe limiti — yayında kapalı

Mekanik yazılır, limit **sunucu tarafı ayar** olur ve başlangıçta sınırsıza
konur. Yapay kıtlık ancak bolluk varken para kazandırır; 200 kullanıcılı bir
mahallede günlük limit, kullanıcıya pazarı bitirtip uygulamayı sildirir.

> Not: `swipes_delete_own` politikası bugün "pass"i geri almayı ücretsiz
> sağlıyor — fiilen bedava rewind. Rewind ücretli hale getirilecekse o politika
> gözden geçirilmeli. Öneri: iyi niyet özelliği olarak ücretsiz kalsın.

### Sahiplendirme yüzeyi parasızdır — sıralama yanıt vermeye göre

Sahiplendirmede öne çıkma **satın alınamaz**. Gerekçe ahlaki değil yapısal:
ödeme isteği, istenen niyetle ters orantılıdır. Tek kedisini sahiplendiren
bir kez ve isteksizce öder; 20 hayvan elden çıkarmak isteyen sürekli ve
istekle öder. Görünürlük açık artırmaya çıkarsa **yapısal olarak satıcı
kazanır** — her yerden dışladığımız aktör tam da buradan içeri girer.

> **Fiyat zenginliğe göre eler, oran sınırı hacme göre eler.** Bizim elemek
> istediğimiz hacim.

**Reddedilen alternatif:** "en uzun bekleyen öne çıksın". Bekleme süresi
aciliyetin değil **bayatlığın** sinyali — en uzun bekleyen ilan çoğunlukla
sahibi ilgisini kaybetmiş, hayvanı offline vermiş ya da uygulamayı bırakmış
olandır. Yukarı taşınırsa başvuran ölü uçlara sürülür, iptal oranı yükselir.

Doğru sinyal **yanıt verme**:

- İlan sahibinin gelen başvurulara yanıt oranı ve yanıt süresi
- `profiles.last_active_at`
- **Periyodik teyit:** "hâlâ yuva arıyor mu?" — N gün içinde teyit gelmezse
  ilan otomatik duraklar

Bunlar `0011`'de kuruldu (`owner_response_rate()`, `list_adoptable_pets()`
sıralaması, `pause_stale_adoption_listings()`). Yanıt vermemiş yeni ilan
sahibi **cezalandırılmıyor** — hiç başvuru almamışın varsayılan oranı 1.0,
aksi halde yeni ilanlar hiç görünmez ve yüzey kendini kilitler.

Gerçekten acil olan kişi zaten uygulamayı sürekli açıp hızlı yanıt verir —
yani yanıt verme, aciliyetin ödemeden de bekleme süresinden de iyi vekilidir.

Aciliyet işareti istenirse: **ücretsiz ama kıt** — kullanıcı başına belirli
sürede bir kez, doğrulama şartıyla. Doğrulanmış barınaklar sınırsız.

### Boost — iki kısıtla

**1. `adoption` amaçlı petlerde çalışmaz.** Görünürlük satın alma, hayvan
satmak isteyenin en çok ödemek istediği şeydir; yapısal satıcı savunmasını tam
da en kritik yerinden deler. Sosyal taraf öne çıkarılabilir, yuva arayan hayvan
ilanı parayla öne çıkarılamaz.

**2. Sıralamaya karışmaz, enjekte edilir.** Desteye belirli aralıklarla
yerleştirilen kartlar olarak gelir. Sıralamaya karışırsa mesafe ve uyum
sıralamasını bozar; kullanıcı bunu "alakasız kartlar" olarak hisseder.

---

## Asla satılmayacaklar

Gelir baskısı geldiğinde ilk akla gelecekler bunlar olduğu için baştan
sabitleniyor:

- **Temel eşleşme doğruluğu** — bağlantı amacı, dating için ilgilenilen
  cinsiyet kategorileri ve temel yaş aralığı ücretsizdir. Sistem amacı
  kullanarak aynı/karşı cinsiyet varsaymaz. Premium; güvenli ve doğru kart
  üretmenin ön koşulunu değil, keşif konforunu satar.
- **Doğrulama** — bir güvenlik özelliği. Parayla satılırsa güvenlik, parası
  olanın ayrıcalığı olur.
- **Engelleme / şikâyet** — aynı gerekçe.
- **Konum değiştirme ("passport")** — trilateration savunmasını
  ([`0007`](../supabase/migrations/0007_location_privacy.sql)) doğrudan deler
  ve mahalle yoğunluğuna dayalı ürünün mantığını bozar.
- **Sahiplendirme ilanı vermek** — yuva bulmayı paywall arkasına koymak,
  alınabilecek en kötü manşet.

---

## Sıralama artık bir tasarım problemi

Faz 1 ile birlikte destede dört sinyal yarışıyor: **mesafe · son aktiflik ·
uyum skoru · boost.** Şu anki `discover_pets` yalnızca mesafeye göre sıralıyor
ve ilk 50'yi döndürüyor; uyum skoru istemcide o 50'yi yeniden diziyor.

Bu haliyle taşımaz. Ayrıca `core/domain/matching.ts`'teki mesafe bileşeni
şu an **ölü** (RLS lat/lng vermiyor, skor sabit 0.5 alıyor) — sıralama
tasarımı yapılırken birlikte ele alınmalı.

Öneri: mesafe ve son aktiflik eleme/kaba sıralama katmanı, uyum skoru eşitlik
bozucu, boost enjeksiyon. Ama bu, ekranlar yazılırken gerçek veriyle
kararlaştırılmalı.
