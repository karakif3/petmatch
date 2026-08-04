# Bölge taşıması — eu-west-1 → eu-central-1

> **Durum: TAMAMLANDI — 2026-08-04.** Yeni proje `ktlefybtankyywxuafvh`,
> bölge `eu-central-1`, org `karakif2`. Şema, storage, realtime, Edge
> Function'lar ve doğrulama kapıları yeşil. **Kalan tek iş: duman testi
> (§7) ve ardından moderatör satırı.**
>
> Aşağısı hem yapılanın kaydı hem de bir dahaki taşımanın reçetesi.

## Yaparken çıkan dört sürpriz

Runbook'ta olmayan, gerçek işte çıkan şeyler:

1. **Free plan kotası kişi başına, org başına değil.** Yeni proje açılırken
   org'un *tüm* admin/owner üyeleri kendi 2 proje limitine karşı kontrol
   ediliyor. `karakif3`'ü Owner yapmak create'i engelledi — Developer'a
   düşürüp projeyi `karakif2` ile açmak gerekti. Ayrıntı §2'de.
2. **CLI `.env`'i okuyor.** `link` doğru ref'i yazdı ama `db push` eski
   projeye bağlanmaya çalıştı; sebep `.env` içindeki eski
   `SUPABASE_PROJECT_ID`'ydi. **`.env` güncellemesi (§6) `db push`'tan
   ÖNCE yapılmalı** — runbook'un sırası yanlıştı, düzeltildi.
3. **Moderatör satırı bu aşamada girilemez.** `app_user_roles.user_id`,
   `auth.users(id)`'ye FK ile bağlı ve yeni projede hiç kullanıcı yok.
   Satır ancak duman testinde kayıt olduktan sonra girilebilir — §5'ten
   §7 sonrasına taşındı.
4. **`db dump`'ın üç modu var, üçü de ayrı komut.** Bkz. aşağıdaki yedek
   tablosu.

## Karar ve gerekçe

petmatch `eu-west-1`'de (İrlanda), pilot ise İstanbul. `eu-central-1`
(Frankfurt) kabaca 30 ms daha yakın. Mütevazı ama gerçek bir kazanç.

**Neden şimdi:** Supabase bölgeyi yerinde değiştiremiyor — yeni proje açıp
taşımak gerekiyor. Bugün taşınacak veri **gözden çıkarılabilir test verisi**
(10 auth kullanıcısı, ~1 MB dosya). Altı ay sonra aynı iş gerçek kullanıcı
göçü olur.

**Vazgeçme kriteri:** §2 (silme) geri dönüşsüz. Oraya gelmeden önce §1'deki
yedek doğrulaması düşerse dur — sil düğmesine basmadan her şey geri
alınabilir, bastıktan sonra tek dayanak yedek.

---

## Asıl risk: migration'ların taşımadıkları

Şema kendi kendine geliyor — 39 migration sıfırdan temiz uygulanıyor ve bu
`npm run test:db` ile her koşumda kanıtlanıyor. **Unutulacak şeyler
migration'ların dışında kalanlar.** Envanter:

| Taşınacak | Migration taşıyor mu | Bugünkü durum | Unutulursa |
|---|---|---|---|
| Tablolar, RLS, RPC, trigger, enum | ✅ evet | 39 migration | — |
| Storage bucket'ları + boyut/mime limitleri | ✅ evet (`0004`, `0032`) | 3 bucket | — |
| Realtime publication (`messages`) | ✅ evet (`0015`) | açık | Sohbet canlı güncellenmez |
| Bölge ve buluşma yeri tohum verisi | ✅ evet (`0037`, `0038`) | 3 bölge, 6 aday | — |
| **Auth Site URL + Redirect URLs** | ❌ hayır | **boş** | Şifre sıfırlama deep link'i kırılır |
| **Auth sağlayıcıları / e-posta şablonları** | ❌ hayır | varsayılan | — (özelleştirme yok) |
| **Edge Function'lar** | ❌ hayır | 2 tanesi ACTIVE | Bildirim ve hesap silme çalışmaz |
| **Edge Function secret'ları** | ❌ hayır | yalnızca otomatik olanlar | — (`EXPO_ACCESS_TOKEN` opsiyonel ve set değil) |
| **`app_user_roles` satırları (moderatör)** | ❌ hayır | 1 admin (2026-08-03'te eklendi) | Moderasyon kuyruğuna kimse erişemez |
| **`.env` üç değeri** | ❌ hayır | eski ref | Uygulama hiçbir şeye bağlanamaz |

> EAS yapılandırması Supabase'e referans vermiyor; değerler `.env` üzerinden
> geliyor. Kontrol edildi.

## Yol seçimi: yedekle → sil → yeniden aç

`karakif2` org'unda zaten petmatch + doktorumla var; Free plan org başına 2
proje veriyor. **Seçilen yol: eski projeyi yedekleyip silmek, boşalan slotta
yenisini açmak.** Pro'ya çıkmaya ya da ikinci bir org'a dağılmaya gerek yok.

Bu yol şu üç şey doğru olduğu için güvenli:

1. **Şemanın asıl yedeği zaten repo.** 39 migration sıfırdan temiz
   uygulanıyor ve bu her `npm run test:db` koşumunda kanıtlanıyor. Dump,
   ihtiyattan ibaret.
2. **Veri gözden çıkarılabilir** — 10 test hesabı, ~1 MB dosya.
3. **Ayarlar envanteri çıkarıldı** (yukarıdaki tablo): taşınacak özel
   sağlayıcı, şablon ya da secret yok.

### Ama "yedek" tek dosya değil — üç parça

| Parça | Nasıl | Not |
|---|---|---|
| Şema | `supabase db dump -f 01-schema.sql` | Repo zaten bunu taşıyor |
| **Veri** | `supabase db dump --data-only -f 02-data.sql` | **Ayrı komut** — `db dump` varsayılanı yalnızca şema |
| **Roller** | `supabase db dump --role-only -f 06-roles.sql` | **Üçüncü ayrı komut** — Supabase'in resmî yedekleme dokümanı bunu da istiyor |
| **Ayarlar** | Elle not | **Dump'ta YOKTUR** |

`db dump` üç ayrı modda çalışıyor ve **hiçbiri diğerini kapsamıyor**:
varsayılan yalnızca şema, `--data-only` yalnızca satırlar, `--role-only`
yalnızca rol tanımları ve rol düzeyi ayarlar. Üçünü de çalıştırmadan
"yedek aldım" denemez.

> Bu projede roller dump'ı **boş çıktı sayılır** — özel rol yok, yalnızca
> Supabase'in varsayılan `statement_timeout` ayarları var (`03-settings.md`).
> Yine de alındı: "muhtemelen boştur" ile "boş olduğunu gördüm" arasındaki
> fark, geri dönüşsüz bir silmeden önce tam olarak önemli olan şey.

Dördüncüsü en çok atlanan: **auth yapılandırması, redirect URL'ler, sağlayıcı
ayarları ve rate limit'ler veritabanında değil Supabase'in kontrol düzleminde
durur.** `db dump` onları hiçbir zaman yakalamaz. Bu runbook'un başındaki
envanter tablosu tam olarak bu boşluğu kapatmak için var.

### Kabul edilen riskler

- **Silinen Supabase projesi geri gelmiyor.** Free tier'da undelete yok;
  dump tek güvenlik ağı.
- **Silme ile yeni projenin ayağa kalkması arasında uygulama tamamen kapalı.**
  Gerçek kullanıcı olmadığı için bedeli yok, ama bilinerek yapılıyor.
- Slot'un anında boşalmaması ihtimali var; boşalmazsa yeni proje açılana kadar
  beklenir.

---

## Adımlar

### 1. Yedek — ✅ **ALINDI** (2026-08-03)

`~/Desktop/cursor_claude/petmatch-backup-2026-08-03/` — repo dışında,
kullanıcı verisi içeriyor, git'e girmez.

- [x] `npm run test:db` yeşil (39 migration + 7 test dosyası)
- [x] `npx supabase migration list --linked` → bekleyen yok, repoda olmayan yok
- [x] `01-schema.sql` — 129 KB, 46 nesne tanımı
- [x] `02-data.sql` — 17 KB; 15 tablo, `auth.users`, `auth.identities`,
      `storage.objects` dahil
- [x] `06-roles.sql` — 2026-08-04'te eklendi; özel rol yok, yalnızca
      Supabase varsayılanları
- [x] **Doğrulandı** — dosyalar dolu, tablo tablo sayıldı
- [x] `03-settings.md` — dump'ın yakalamadığı her şey
- [x] `04-env.txt` — mevcut `.env` kopyası (chmod 600)
- [ ] Storage dosyaları (~1 MB test fotoğrafı) — **taşınmayacak**, gerekirse indir

> **Yedek alırken çıkan bulgu:** `app_user_roles` boştu — canlıda hiç
> moderatör yoktu, dolayısıyla park doğrulaması dahil altı fonksiyon
> erişilemezdi. `karakif3@gmail.com` admin olarak eklendi ve doğrulandı
> (`03-settings.md`). **Yeni projede tekrarlanacak** — §5'te.

### 2. ⛔ GERİ DÖNÜŞSÜZ — eski projeyi sil

§1'in tamamı bitmeden buraya gelme. Silinen proje geri gelmiyor.

> **Sıra tuzağı — bu adımdan ÖNCE yapılacak.** Free plan kotası **kişi
> başına**, org başına değil: yeni proje açılırken Supabase o org'un *tüm*
> admin/owner üyelerini kendi 2 proje limitine karşı kontrol ediyor.
> `karakif3` bu org'da Owner'ken kendi kotası (tellora + slipbook) da
> denkleme giriyor ve create'i engelliyor — petmatch silinmiş olsa bile.
>
> - [x] **`karakif3`'ü Developer'a düşür** (Team → Manage access).
>       Developer sonraki tüm işler için yeterli: link, `db push`,
>       function deploy, `gen:types`.
> - [x] Yeni projeyi **`karakif2@gmail.com` olarak aç** — kotası petmatch
>       silinince boşalan tek hesap o.

- [x] Eski projeyi sil (dashboard → Settings → General → Delete project)
- [x] Slot'un boşaldığını teyit et (org sayfasında 1 proje görünmeli)

### 3. Yeni proje

- [x] Yeni proje: ad `petmatch`, bölge **eu-central-1**, org `karakif2`
- [x] Yeni **ref**: `ktlefybtankyywxuafvh`
- [x] Veritabanı şifresi kaydedildi (`05-db-password.txt`, chmod 600)

### 4. Şema

> **`.env`'i buradan ÖNCE güncelle (§6).** CLI proje dizinindeki `.env`'i
> okuyor: `link` doğru ref'i yazsa bile eski `SUPABASE_PROJECT_ID` dururken
> `db push` eski hosta bağlanmaya çalışır ve "no such host" verir.

- [x] `npx supabase link --project-ref ktlefybtankyywxuafvh`
- [x] `npx supabase db push --include-all` → 39 migration, hepsi temiz
      (tüm NOTICE'lar idempotent koruma satırlarından)
- [x] `npx supabase migration list --linked` → 39/39, fark yok
- [x] Doğrulama sorgusu → **`0 · 0 · 3 · 6`**, ayrıca 3 bucket
      ve realtime publication `public.messages` teyit edildi

```sql
select
  (select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace
   where n.nspname='public' and c.relkind='r' and not c.relrowsecurity) as rls_kapali,
  (select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and has_function_privilege('anon',p.oid,'execute')) as anon_fonksiyon,
  (select count(*) from regions) as bolge,
  (select count(*) from meetup_places) as yer;
```

  Beklenen: `0 · 0 · 3 · 6`

### 5. Migration'ların taşımadıkları

- [x] **Auth ayarları eskisiyle karşılaştırıldı** — birebir aynı:
      `mailer_autoconfirm=false` (Confirm email açık), yalnızca e-posta
      sağlayıcısı, Apple/Google kapalı, anonim kapalı, özel SMTP yok.
      Taşınacak sapma yoktu.
- [ ] **Auth → URL Configuration**: Site URL ve Redirect URL'ler.
      Yeni projede `site_url` varsayılan `http://localhost:3000`,
      `uri_allow_list` **boş**. [`auth-release-checklist.md`](auth-release-checklist.md)
      neyin gerektiğini söylüyor. **Taşımadan bağımsız, hâlâ açık bir yayın
      önkoşulu.**
- [x] **Edge Function deploy** — ikisi de ACTIVE, `verify_jwt: true`
      (eskisiyle aynı)
- [x] Secret gerekmiyor (`EXPO_ACCESS_TOKEN` opsiyonel ve set değil) — ama
      ileride eklenirse buraya da eklenmeli

> **Moderatör satırı buraya değil, §7'den SONRA.** `app_user_roles.user_id`
> → `auth.users(id)` FK'sı var ve yeni projede hiç kullanıcı yok; satır
> ancak duman testinde kayıt olduktan sonra girilebilir.

### 6. İstemci

- [x] `.env` güncellendi: `EXPO_PUBLIC_SUPABASE_URL`,
      `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_ID`
      → **§4'ten önce yapılmalı**, yukarıdaki nota bak
- [x] `npm run gen:types` → tek fark meta satırı
      (`PostgrestVersion: 14.5 → 14.15`); şema sapması yok
- [x] `npm run lint && npm run typecheck && npm test` → 5 dosya, 43 test yeşil

### 7. Duman testi — **atlanmamalı**

Buraya kadar her şey yeşil olsa bile uygulamanın gerçekten çalıştığını
görmeden devam etme. Yeni bir hesapla:

- [ ] Kayıt ol → **e-posta doğrulama adımı gelecek** (`Confirm email` açık,
      hem eski hem yeni projede varsayılan). Doğrulamadan giriş yapılamaz —
      bu bir arıza değil, beklenen davranış.
- [ ] Onboarding (bölge seçimi görünüyor mu?)
- [ ] Pet profili + fotoğraf yükle (storage politikaları çalışıyor mu?)
- [ ] Keşfet açılıyor mu
- [ ] İkinci hesapla karşılıklı beğeni → **eşleşme kutlaması** çıkıyor mu
- [ ] Sohbet aç, mesaj gönder, karşı taraf **anlık** görüyor mu (realtime)
- [ ] Şifre sıfırlama e-postası gelip deep link açılıyor mu (§5'in testi)

> **E-posta gelmezse önce bunu düşün:** özel SMTP yok, Supabase'in yerleşik
> göndericisi kullanılıyor ve onun saatlik gönderim limiti çok düşük. Arka
> arkaya birkaç deneme yaptıysan limit dolmuş olabilir — taşıma hatası
> sanma. Aynı kısıt eski projede de vardı.

### 8. Moderatör — **duman testinden sonra**

İlk kullanıcı kayıt olup e-postasını doğruladıktan sonra, dashboard SQL
editöründen (tablo yalnızca `service_role`'a açık):

```sql
insert into app_user_roles (user_id, role)
select id, 'admin' from auth.users where email = '<e-posta>'
on conflict (user_id) do update set role = 'admin';
```

- [ ] Satır girildi
- [ ] `select is_moderator();` → `true`
- [ ] `select * from list_meetup_place_candidates();` → 6 aday park

Bu satır girilene kadar `get_moderation_queue`, `review_moderation_item`,
`set_meetup_place_verification`, `list_meetup_place_candidates`,
`region_density` ve `security_surface_report` **herkese `42501` döner.**

### 9. Yedeği sakla

- [ ] Yedek klasörünü en az bir ay sakla — bir şey eksik çıkarsa tek kaynak o
- [ ] İçinde kullanıcı verisi var: git'e ekleme, paylaşma

### 10. Sonrası

- [x] [`launch.md`](launch.md) içindeki bölge/ref bilgisi güncellendi
- [x] Bu dosyanın başına "tamamlandı + tarih" notu düşüldü

---

## Neden bu sıra

Yol "sil sonra yarat" olduğu için geri dönüş yok; güvenlik **yedeğin
eksiksizliğinden** geliyor. O yüzden §1 tek başına bir kapı: yedek alınıp
**doğrulanmadan** §2'ye geçilmiyor.

İkinci kural: **her fazın sonunda doğrulama var.** Tek bir büyük "bitti mi?"
kontrolü yerine küçük kapılar — hangi adımın bozduğu belli olsun diye.

Üçüncüsü: §7 duman testi atlanmamalı. Şema ve ayarlar yeşil olsa bile
uygulamanın gerçekten çalıştığını görmeden "tamam" denmemeli.
