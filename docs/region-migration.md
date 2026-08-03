# Bölge taşıması — eu-west-1 → eu-central-1

> **Durum:** planlandı, başlanmadı. Bu dosya işlem sırasında **satır satır
> takip edilmek** için yazıldı; okunup kapatılacak bir açıklama değil.

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
| **Ayarlar** | Elle not | **Dump'ta YOKTUR** |

Üçüncüsü en çok atlanan: **auth yapılandırması, redirect URL'ler, sağlayıcı
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
- [x] `02-data.sql` — 17 KB; `auth.users`, `auth.identities`,
      `storage.objects` dahil
- [x] **Doğrulandı** — dosyalar dolu ve okunuyor
- [x] `03-settings.md` — dump'ın yakalamadığı her şey
- [x] `04-env.txt` — mevcut `.env` kopyası (chmod 600)
- [ ] Storage dosyaları (~1 MB test fotoğrafı) — **taşınmayacak**, gerekirse indir

> **Yedek alırken çıkan bulgu:** `app_user_roles` boştu — canlıda hiç
> moderatör yoktu, dolayısıyla park doğrulaması dahil altı fonksiyon
> erişilemezdi. `karakif3@gmail.com` admin olarak eklendi ve doğrulandı
> (`03-settings.md`). **Yeni projede tekrarlanacak** — §5'te.

### 2. ⛔ GERİ DÖNÜŞSÜZ — eski projeyi sil

§1'in tamamı bitmeden buraya gelme. Silinen proje geri gelmiyor.

- [ ] Eski projeyi sil (dashboard → Settings → General → Delete project)
- [ ] Slot'un boşaldığını teyit et (org sayfasında 1 proje görünmeli)

### 3. Yeni proje

- [ ] Yeni proje: ad `petmatch`, bölge **eu-central-1**, org `karakif2`
- [ ] Yeni **ref** bir yere yazıldı
- [ ] Veritabanı şifresi parola yöneticisine kaydedildi

### 4. Şema

- [ ] `npx supabase link --project-ref <yeni-ref>`
- [ ] `npx supabase db push` → 39 migration
- [ ] `npx supabase migration list --linked` → 39/39, fark yok
- [ ] Doğrulama sorgusu (SQL editörü):

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

- [ ] **Auth → URL Configuration**: Site URL ve Redirect URL'ler.
      Bugün boş; [`auth-release-checklist.md`](auth-release-checklist.md)
      neyin gerektiğini söylüyor. **Bu adım zaten yapılmamış bir yayın
      önkoşulu — taşımayı fırsat bil.**
- [ ] **Edge Function deploy**:
      `npx supabase functions deploy send-notification --use-api`
      `npx supabase functions deploy delete-account --use-api`
- [ ] `npx supabase functions list` → ikisi de ACTIVE
- [ ] **Moderatör atamasını yeniden gir** — migration tabloyu getirir, satırı
      getirmez. `03-settings.md` içindeki SQL, dashboard SQL editöründen
      (tablo yalnızca `service_role`'a açık). Ardından `is_moderator()` ile
      doğrula.
- [ ] Secret gerekmiyor (`EXPO_ACCESS_TOKEN` opsiyonel ve set değil) — ama
      ileride eklenirse buraya da eklenmeli

### 6. İstemci

- [ ] `.env` güncelle: `EXPO_PUBLIC_SUPABASE_URL`,
      `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_ID`
- [ ] `npm run gen:types` → `git diff types/database.ts` yalnızca meta satırı
      göstermeli; şema farkı çıkarsa **dur ve incele**
- [ ] `npm run lint && npm run typecheck && npm test` yeşil

### 7. Duman testi — **atlanmamalı**

Buraya kadar her şey yeşil olsa bile uygulamanın gerçekten çalıştığını
görmeden devam etme. Yeni bir hesapla:

- [ ] Kayıt ol → onboarding (bölge seçimi görünüyor mu?)
- [ ] Pet profili + fotoğraf yükle (storage politikaları çalışıyor mu?)
- [ ] Keşfet açılıyor mu
- [ ] İkinci hesapla karşılıklı beğeni → **eşleşme kutlaması** çıkıyor mu
- [ ] Sohbet aç, mesaj gönder, karşı taraf **anlık** görüyor mu (realtime)
- [ ] Şifre sıfırlama e-postası gelip deep link açılıyor mu (§5'in testi)

### 8. Yedeği sakla

- [ ] Yedek klasörünü en az bir ay sakla — bir şey eksik çıkarsa tek kaynak o
- [ ] İçinde kullanıcı verisi var: git'e ekleme, paylaşma

### 9. Sonrası

- [ ] [`services.md`](services.md) ve [`launch.md`](launch.md) içindeki
      bölge/ref bilgilerini güncelle
- [ ] Bu dosyanın başına "tamamlandı + tarih" not düş

---

## Neden bu sıra

Yol "sil sonra yarat" olduğu için geri dönüş yok; güvenlik **yedeğin
eksiksizliğinden** geliyor. O yüzden §1 tek başına bir kapı: yedek alınıp
**doğrulanmadan** §2'ye geçilmiyor.

İkinci kural: **her fazın sonunda doğrulama var.** Tek bir büyük "bitti mi?"
kontrolü yerine küçük kapılar — hangi adımın bozduğu belli olsun diye.

Üçüncüsü: §7 duman testi atlanmamalı. Şema ve ayarlar yeşil olsa bile
uygulamanın gerçekten çalıştığını görmeden "tamam" denmemeli.
