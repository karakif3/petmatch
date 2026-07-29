# Amaç modeli — pet ilk ortak nokta

> **Durum:** ✅ uygulandı. `0007`–`0010` yazıldı ve izole bir Postgres'te
> davranışsal olarak doğrulandı. Domain katmanı (`core/domain/`) şemayla
> hizalandı. Kalan iş ekranlar ve moderasyon arayüzü.

Güncel kurucu ilke:

> **Pet buluşması gerçek ve birincil bağlamdır; insan katmanı kullanıcı
> kontrolünde oyun arkadaşlığından dostluğa veya romantik bir bağa açılabilir.
> Bu ihtimal kullanıcıdan ve mağazadan saklanmaz.**

Bu ilke PetMatch'i jenerik bir “hot-or-not” dating uygulamasından ayırır:
pet uyumu yalnız pazarlama cover'ı değil, keşfeti ve ilk buluşmayı etkileyen
gerçek ürün girdisidir. Bugünkü model ilişki türü veya cinsel yönelim toplamaz.
Dating olarak açık pazarlama yapılmadan önce sürümlü bağlantı modu, karşılıklı
niyet, yaş güvencesi ve moderasyon kapıları
[`pet-first-connection.md`](pet-first-connection.md) uyarınca tamamlanır.

---

## 1. Amaçlar yalnızca pete ait

```sql
create type match_goal as enum ('playdate', 'adoption');

alter table pets
  add column goals match_goal[] not null default '{playdate}',
  add constraint pets_goals_not_empty check (cardinality(goals) > 0);
```

Uygunluk kuralı: **amaç kümeleri kesişiyorsa uygun** (`&&`). `pets.intent`
ve `both` özel durumu emekliye ayrılıyor.

Amaçlar pette yaşıyor çünkü hepsi pete ait — sahibe ait bir amaç yok.

### `mating` neden yok

Üreme amacı MVP'den **bilinçli olarak çıkarıldı**. Gerekçe yasal risk ya da
moderasyon yükü değil, **hikâye tutarlılığı**: bir yanda "bu hayvanlara yuva
bulalım", öbür yanda "yeni yavru üretelim" aynı uygulamada birbirini çürütür.
Sahiplendirme huninin girişi yapıldığı anda üremenin maliyeti riskten ibaret
olmaktan çıkıp konumlandırmanın kendisi oldu.

Adını yumuşatmak ("hayat arkadaşı" vb.) **çözüm değil**: muğlak etiket
moderasyonu imkânsızlaştırır (şikâyet geldiğinde talebin ne olduğunu ayırt
edemezsin), Türkçede insan ilişkisi çağrıştırdığı için tam da kaçındığımız
yanlış okumayı geri getirir, ve sonradan "gizlemeye çalışmışlar" manşetine
dönüşür. Ya açık adıyla ve şartlarıyla, ya hiç.

İleride eklenirse şartları: doğrulanmış hesap · mikroçip/kayıt numarası ·
fiyat alanı yok · açık refah şartları.

### Tek deste, mod değiştirici yok

Amaçlar yalnızca pete ait olduğu için kesişim tek anlamlı: deste, petinin
amaçlarıyla kesişen petleri gösterir, kart üzerinde rozet durur. Bu yüzden
`swipes` tablosuna amaç kolonu **gerekmiyor** — beğeninin hangi niyetle
atıldığı belirsiz kalmıyor.

Sahiplendirme ayrı bir yüzey (bkz. §4), çünkü karşılıklı beğeni değil.

---

## 2. İnsan katmanı: görünürlük + tanışmaya açıklık

Aradığımız özellik şemada zaten var — `profiles.owner_visibility`:

| Değer | Anlamı |
|---|---|
| `hidden` | Sadece pet görünür |
| `after_match` *(varsayılan)* | Eşleşince sahibi de görünür |
| `public` | Sahip fotoğrafı ve kısa bio kartta görünür |

Kullanıcı kendini gösterip göstermeyeceğini ve petiyle birlikte yeni insanlarla
tanışmaya açık olup olmadığını seçer. Karşı taraf “sahibini de gösterenler”,
“doğrulanmış sahip” ve karşılıklı “tanışmaya açık” filtrelerini kullanabilir.

`owner_social_open` bugün bir köprü boolean'ıdır: arkadaşlık veya romantik bağ
ihtimalini birbirinden ayırmadan yalnız “petimle birlikte yeni insanlarla
tanışmaya açığım” der. Açılması için sahip adı, private Storage'da sahip
fotoğrafı ve `owner_visibility = 'public'` zorunludur. Kapanınca sosyal filtre
tercihi sunucuda otomatik kapanır. Dating pazarlamasından önce bu alan
`connection_mode` modeline sürümlü ve geriye uyumlu biçimde taşınacaktır.

### Karşılıklı açıklama kuralı

Cinsiyet ve yaş filtreleri gerekiyor; parasal olarak ücretsiz, mahremiyet
bakımından ise yalnız karşılıklı açıklama koşuluyla. Kural, şemada zaten
kullanılan `require_visible_owner` desenine denk:

> **Cinsiyetini/yaşını paylaşanlar, paylaşanları görür ve filtreleyebilir.
> Paylaşmayanlar bu alanın tamamen dışında — ne görür ne görünür.**

Önemli olan bunun **kamuya açıklama değil karşılıklı açıklama** olması. Aksi
halde kuralın bedeli asimetrik olur: cinsiyet filtresinin en meşru kullanıcısı,
tanımadığı biriyle parkta buluşurken aynı cinsten birini tercih eden kadındır —
ona "bu filtreyi kullanmak için kadın olduğunu herkese ilan et" demek, korunmak
isteni riske atmaktır.

### Cinsiyet: kolon evet, tercih hayır

Bu başlık bugünkü `pets_only/friendship` köprüsünü tarif eder. Dating modu
açıldığında “kimi görmek istiyorum” karşılıklı eşleşme girdisi olacaktır; ürün
bu tercihi bağlantı amacından otomatik çıkarmaz ve ödeme duvarına koymaz. Tercih
sunucuda tutulmadan karşılıklı dating uyumu güvenilir biçimde zorlanamayacağı
için kalıcı model ancak özel nitelikli veri incelemesi, açık rıza, geri alma ve
silme kontrolleri tamamlandıktan sonra eklenir.

| Ne saklanıyor | Statü | Karar |
|---|---|---|
| `profiles.gender` | Sıradan kişisel veri | Kolon olarak eklenir, **opsiyonel** ("belirtmek istemiyorum") |
| "kimleri görmek istiyorum" | **Çıkarımla yönelim** — KVKK m.6 / GDPR Art. 9 | Kolon **yok**; sorgu parametresi, cihazda hatırlanır |

Tek başına cinsiyet alanı masum. Ama "kadınım" + "sadece erkekleri göster"
kalıcı saklandığında, kullanıcı hiç beyan etmemiş olsa bile yönelim verisi
tutuyor olursun; düzenleyiciler çıkarımla elde edilen özel nitelikli veriyi de
özel nitelikli sayar.

```sql
discover_pets(p_pet_id uuid, p_owner_genders text[] default null, …)
```

Deneyim birebir aynı (filtre "unutulmuş" hissettirmiyor), tek fark cihaz
değişince sıfırlanması.

### Yaş: kesin sakla, kova göster

`birth_date` 18+ kapısı için zaten toplanıyor. Filtre olarak kullanılabilir ama
kartta **"30'lu yaşlar"** görünür, "34" değil. Kesin yaş bir kimlik parçası;
aralık filtre için fazlasıyla yeterli.

### Tutarlılık kuralları

1. **Gizli sahibin cinsiyeti/yaşı filtrelenemez.** Profilini gizleyenin bu
   bilgileri filtre boyutu olarak bile dışarı sızmamalı.
2. **Cinsiyet filtresi görünürlük filtresini ima eder.** İki ayrı anahtar
   gereksiz — cinsiyet seçilince görünürlük filtresi otomatik devreye girer.
3. **UI dili güvenlik tarafında durur.** *"Kimlerle buluşmakta rahatsın?"* —
   *"Kimden hoşlanıyorsun?"* değil. Aynı veriyi toplar, farklı ürün kurar.
4. **Cinsiyet/yaş filtre tercihi sunucuda saklanmaz.** Cihaz içi saklama
   kullanıcı deneyimini korur ama hesap verisinden yönelim çıkarılmasını
   engeller.
5. **Kesin yaş çıkmaz.** 18–24, 25–29 ve sonrasında on yıllık kovalar görünür.

### Filtre satırı tek kalıyor

Önceki sürümde `discovery_preferences` PK'sını `(user_id, goal)` yapmayı
önermiştim. **Bu öneri geri alındı**: gerekçesi "petin yaşı mı sahibin yaşı mı"
belirsizliğiydi, insan amaçları ölünce belirsizlik de öldü. Kalan amaçların
filtreleri büyük ölçüde örtüşüyor — tek satır yeterli.

---

## 3. Konum gizliliği — `0007` ile uygulandı

`discover_pets` ham ondalık mesafe döndürüyordu. Saldırgan kendi konumunu üç
noktaya taşıyıp aynı hedefi ölçerse, üç çemberin kesişimi evini metrelerle
verir — dating uygulamalarında defalarca sömürülmüş klasik saldırı.

İki katmanlı savunma yazıldı:

- **Yazarken:** `pets_snap_location` trigger'ı konumu ~1 km ızgaraya oturtur.
  Ham GPS hiç saklanmaz; veritabanı sızsa bile tam adres çıkmaz.
- **Okurken:** `distance_bucket()` — `<1` · `1-3` · `3-5` · `5-10` · `10-25` ·
  `25+`. Sıralama hâlâ gerçek mesafeye göre, o değer sunucuda kalır.

İstemci tarafında `core/domain/distance.ts` aynı sınırları taşır ve
`coarsenCoordinates` konumu göndermeden önce ilk katmanı uygular.

---

## 3b. Pet değiştirme, vefat ve devir

Tek aktif pet kuralı, "peti değiştirme" akışını zorunlu kılıyor: yeni hayvan
alınır, hayvan vefat eder, ya da hayvan sahiplendirilir. Üçü ayrı ele
alınmalı — ve hiçbirinde pet **silinmemeli**.

### Silme neden yasak

`matches` → `pets` ve `messages` → `matches` ilişkileri `on delete cascade`.
Kullanıcı petini sildiğinde eşleşmeler ve mesajlar da gidiyor — yani
**karşı tarafın sohbet geçmişi, o hiçbir şey yapmadan siliniyor.**
`pets_delete_own` politikası bugün buna izin veriyor; kaldırılmalı.

Doğrusu: `is_active = false`. Pet destede görünmez, eşleşmeler ve sohbetler
yerinde kalır.

| Durum | Ne olur |
|---|---|
| **Yeni hayvan** | Eski pet `is_active = false`, yeni pet aktif olur. Eski eşleşmeler ve sohbetler durur — insanlar tanışmıştır, hayvan değişti diye bağ silinmez. |
| **Vefat** | Anma durumu. Arayüzde asla "sil" denmez; profil isteğe bağlı olarak anı olarak saklanır. Bu bir pet uygulamasında karşılaşılacak en duygusal an — dilin buna göre kurulması gerekir. |
| **Sahiplendirme ile devir** | `owner_id` yeni sahibe geçer. Pet kimliği ve geçmişi korunur. **Ama devirle birlikte tüm konuşmalar kapatılır ve swipe geçmişi sıfırlanır** — aksi halde yeni sahip eski sahibin sohbetlerini okur. |

### Suistimal: swipe geçmişini sıfırlama

Swipe elemesi `from_pet_id` bazlı olduğu için, yeni pet açan kullanıcı tertemiz
bir desteyle başlar. Bu meşru (gerçekten farklı bir hayvan), ama tekrar tekrar
pet açarak kendini sürekli aynı kişilere göstermek için kullanılabilir.

Engellenmiş kullanıcılar bundan etkilenmiyor — `blocked_user_ids()` **kullanıcı**
düzeyinde çalışıyor, pet düzeyinde değil. Kalan risk için şema değişikliği
değil, oran sınırı yeterli: belirli bir sürede açılabilecek pet sayısı.

## 4. Sahiplendirme: özellik değil, huninin girişi

> Hayvanı olmayan biri sahiplenmek için gelir → sahiplenir → artık hayvanı
> vardır → ana döngüye girer.

Sahiplendirme ana ürünün **kullanıcı kazanım kanalı**. Üstüne jenerik pet
uygulamalarında olmayan bir amaç kazandırıyor: barınak işbirlikleri, basın
ilgisi, öne çıkarılma şansı.

### Karşılıklı beğeni değil, başvuru

Barınak 200 başvuruyu swipe'lamaz. Yön tek:

```
Sahibi peti 'adoption' olarak işaretler
  → ilgilenen "İlgileniyorum" + kısa not gönderir
  → sahibi gelen istekleri inceler ve kabul eder
  → sohbet açılır
```

Bu yüzden Keşfet destesinde değil, kendi yüzeyinde yaşar. Hayvanı olmayan
kullanıcı yalnızca bu yüzeyi görür; Keşfet ona kapalıdır (gösterecek peti yok).
Sahiplendikten sonra "şimdi profilini oluştur" ile ana döngüye geçer.

### Bayat ilan, ürünü öldüren şey

Sahiplendirme yüzeyinin en büyük riski yanlış eşleşme değil, **yanıt vermeyen
ilan sahibi**. Başvuran cevap alamazsa uygulamaya olan güvenini kaybeder ve
bir daha denemez.

Bu yüzden ilanlar **yaşayan kayıt** olarak ele alınmalı:

- Sıralama yanıt oranı ve `last_active_at` üzerinden — bekleme süresi üzerinden
  **değil** (o, aciliyetin değil bayatlığın sinyali)
- Periyodik teyit: "hâlâ yuva arıyor mu?" — N gün teyitsiz kalan ilan
  otomatik duraklar
- Kabul edilip sonuçlanmayan başvurular zaman aşımına uğrar *(henüz yok)*

`0011` bunu kuruyor: `pets.adoption_confirmed_at`, `confirm_adoption_listing()`,
`owner_response_rate()` ve duraklatmayı yapan `pause_stale_adoption_listings()`.
Duraklatma **silmiyor** — amaçtan `adoption` çıkıyor, pet ve geçmişi duruyor,
sahibi tek dokunuşla geri açıyor.

> Kalan iş: `pause_stale_adoption_listings()`'i günlük çağıracak zamanlanmış
> iş (Supabase cron / edge function). Fonksiyon yalnızca `service_role`'e açık.

### Listeleme neden RPC

`pets` üzerindeki RLS "kendi petlerim + eşleştiklerim" diyor. **Hayvanı olmayan
kullanıcının ikisi de yok** — doğrudan `select` ile sıfır satır görüyor.
Sahiplendirme hunisinin girişi tam da bu kullanıcı olduğu için listeleme
`list_adoptable_pets()` SECURITY DEFINER fonksiyonundan geçiyor.

Aynı sebeple sahiplendirme **mesafeye değil şehre göre** filtreleniyor: konum
`pets` tablosunda tutuluyor, hayvanı olmayan kullanıcının konumu yok — ve sırf
bunun için yeni bir konum yüzeyi açmak istemiyoruz.

### Bedeli: `conversations` ara katmanı

Sahiplendirme sohbeti `matches`'e sığmıyor — `matches` iki pet gerektiriyor,
başvuran kullanıcının peti olmayabilir. Çözüm:

```sql
create table conversations (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('match', 'adoption')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- matches ve adoption_interests ikisi de bir conversation açar
-- messages.match_id → messages.conversation_id
```

Bu, ilk denetimde çok petli kullanıcı için önerilip ertelenen katmanın aynısı;
sahiplendirme onu zaten gerektiriyor. Kullanıcı verisi yokken bir tablo,
sonra sohbet geçmişi taşımak.

*Reddedilen alternatif:* `swipes.from_pet_id`'yi nullable yapmak — "beğeniyi
atan gerçekten o petin sahibi" garantisini veren kısıtı zayıflatıyor.

---

## 5. Satıcıya ve dolandırıcıya karşı yapısal caydırıcılık

7332 sayılı kanunla 14 Temmuz 2022'den itibaren pet shop vitrinlerinde kedi-
köpek satışı yasak; **sosyal medya üzerinden ticari amaçlı hayvan satışı da
yasak**. Uygulama istemese de araç olur ve sorumluluk platforma döner.

Kural bazlı değil, **yapısal** tedbirler işe yarar:

| Tedbir | Etkisi |
|---|---|
| Tek aktif pet *(zaten karar verildi)* | Çoklu ilan imkânsız |
| Fiyat alanı hiç yok | Satış dili kuracak yer yok |
| "İlan" değil "yuva arıyor" dili | Pazar yeri çağrışımı yok |
| Boost `adoption` petlerinde çalışmaz | Yuva arayan hayvan parayla öne çıkarılamaz ([`monetization.md`](monetization.md)) |
| Bio ve sohbette telefon/link filtresi | Satıcının ilk hamlesi dışarı çekmek |
| Sahiplendirme ilanı = doğrulanmış hesap | Kimlik sürtünmesi |
| `report_reason`'a `commercial_sale` | Şikâyet edilebilir hale gelir |

Para kazanmak için gelen kitle normal kullanıcıdan kat kat aktiftir; geldikleri
anda ürünün tonu kalıcı olarak kayar ve geri dönüşü yoktur.

> ⚠️ Bu tedbirler **barınakları da vuruyor** — 40 kedisi olan barınak tek pet
> kuralına sığmaz. Çözüm kuralı gevşetmek değil, sonradan **doğrulanmış kurum
> hesabı** tipi eklemek.

---

## 6. Doğrulama = moderasyon hattı

"Sahibiyle doğrulanmış" (sahip + pet birlikte selfie) hem güven rozeti hem
sahiplendirmenin kapısı. Kritik nokta: bu, App Store 1.2'nin zaten zorunlu
kıldığı moderasyon altyapısıyla **aynı sistem**.

```sql
create type moderation_kind   as enum ('report', 'verification', 'photo');
create type moderation_status as enum ('pending', 'approved', 'rejected');

create table moderation_items (
  id              uuid primary key default gen_random_uuid(),
  kind            moderation_kind not null,
  status          moderation_status not null default 'pending',
  subject_user_id uuid references profiles (id) on delete cascade,
  subject_pet_id  uuid references pets (id) on delete cascade,
  payload         jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid,
  note            text
);
```

`created_at` → `reviewed_at` farkı 24 saatlik SLA'nın ölçülebilir hali.

**Kural: şikâyet sayısı asla otomatik ban tetiklemez.** Organize toplu şikâyet
(brigading) aksi halde silah olur; sayı yalnızca kuyruk sıralamasını etkiler.

---

## 7. Yaş — 18+

Tüm uygulama 18+. Tek derecelendirme, yaş kapısı yok, açıklanacak gri alan yok.

```sql
alter table profiles add column birth_date date;

alter table profiles add constraint profiles_adult check (
  onboarded_at is null
  or (birth_date is not null and birth_date <= current_date - interval '18 years')
);
```

Kolon nullable çünkü `handle_new_user()` profili kayıt anında açıyor;
zorunluluk onboarding'in bitişine bağlı.

---

## 8. Onboarding

| # | Ekran | Soru |
|---|---|---|
| 1 | Açılış | **"Hayvanın var mı?"** → *Var* / *Yok, sahiplenmek istiyorum* |
| 2 | Kayıt | E-posta veya Google |
| 3 | Sen | Ad + doğum tarihi (18+) |
| 4 | Peti | Fotoğraf · ad · tür · cinsiyet · doğum tarihi |
| 5 | **"… ne arıyor?"** | 🐾 oyun arkadaşı · 🏠 yuva *(çoklu)* |
| 6 | Görünürlük | *"Sen de görünmek ister misin?"* — atlanabilir |
| 7 | Konum | Bağlam ekranı → izin |
| 8 | Deste | |

**Onboarding'de hiçbir filtre sorulmaz.** Kart görmeden filtre kuran yok;
varsayılanla açılır, filtre destenin üstündeki butonda yaşar.

Adım 1'de "Yok" diyen kullanıcı 2-3-7'yi geçip doğrudan sahiplendirme
yüzeyine gider.

**Ertelenen izinler:** bildirim izni **ilk eşleşmeden sonra** (kayıtta
istenirse çoğu reddeder), doğrulama profil tamamlandıktan sonra rozet
teşvikiyle.

---

## Geçiş planı

Kullanıcı verisi yok — hiçbir adım veri taşıma gerektirmiyor.

| Migration | İçerik | Durum |
|---|---|---|
| `0007` | Konum gizliliği — ızgara + kova | ✅ |
| `0008` | `match_goal` enum · `pets.goals` · `pets.intent` kaldırıldı · `birth_date` · `gender` · `last_active_at` · 18+ kısıtı · karşılıklı açıklama · `discover_pets` cinsiyet/yaş parametreleri | ✅ |
| `0009` | `conversations` · `messages.match_id` → `conversation_id` · `adoption_interests` + 3 RPC · `commercial_sale` şikâyet sebebi · `pets_delete_own` kaldırıldı · devir akışı | ✅ |
| `0010` | `moderation_items` (reports ile birleşti) · `verification_status` / `verified_at` · sahiplendirme ilanı doğrulama şartı | ✅ |
| `0011` | `list_adoptable_pets()` · ilan teyidi + otomatik duraklatma · `owner_response_rate()` | ✅ |

### Doğrulanan davranışlar

18 altı reddediliyor · cinsiyetini paylaşan gizlenemiyor · paylaşmayan
filtreleyemiyor · kesişmeyen amaçlar eşleşmiyor · doğrulanmamış hesap ilan
veremiyor · petsiz kullanıcı başvurabiliyor ve kabul sonrası mesajlaşabiliyor ·
devirde sahip değişip konuşmalar kapanıyor ve swipe geçmişi siliniyor · pet
silinemiyor · `0005`'in güvenlik garantileri hâlâ geçerli.

## Açık sorular

- **Eşleşme listesi tek mi, amaç başına mı?** Öneri: tek liste + rozet.
- **Boş deste.** Asıl funnel riski onboarding değil, ilk kullanıcının boş
  desteyle karşılaşması. Çözüm üründe değil dağıtımda: tek mahalleye/şehre
  yoğunlaşarak başlamak. Uygulama da boş desteyi dürüstçe karşılamalı
  ("yarıçapı genişletelim mi / yeni biri katılınca haber verelim") — bu,
  `discover_pets`'in aday sayısını da döndürmesini gerektirir.
- **KVKK operasyonu:** aydınlatma metni, açık rıza (konum + fotoğraf), saklama
  süresi, VERBİS kaydı gerekip gerekmediği — hukukçuya sorulacak.
