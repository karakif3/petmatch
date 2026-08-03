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

**Vazgeçme kriteri:** Aşağıdaki §7'ye (geri dönüşsüz adım) gelmeden önce
herhangi bir doğrulama düşerse dur. Eski proje o ana kadar ayakta ve
çalışıyor; `.env`'i geri almak tek adım.

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
| **`app_user_roles` satırları (moderatör)** | ❌ hayır | §1'de sayılacak | Moderasyon kuyruğuna kimse erişemez |
| **`.env` üç değeri** | ❌ hayır | eski ref | Uygulama hiçbir şeye bağlanamaz |

> EAS yapılandırması Supabase'e referans vermiyor; değerler `.env` üzerinden
> geliyor. Kontrol edildi.

## Engel: Free plan org başına 2 proje

`karakif2` org'unda zaten petmatch + doktorumla var. Üçüncüyü açmak için:

- **(a) Pro'ya çık** — geçici de olsa; taşıma bitince geri düşülebilir.
  Eski proje ayakta kalırken yenisi kurulur, **geri dönüş korunur.**
- **(b) Önce petmatch'i sil** — ücretsiz kalır ama **geri dönüş yok.**
- **(c) Yeni projeyi başka bir org'da aç** — karakif3 hesabındaki boş
  `karakif2` org'u (`vnabmyfwgwmokcneshsr`) kullanılabilir. Limit org başına
  mı hesap başına mı, panelden teyit edilmeli.

**Öneri: (a) veya (c).** (b) ancak diğer ikisi mümkün değilse — çünkü bu
runbook'un tüm güvenliği "eski proje §7'ye kadar ayakta" varsayımına dayanıyor.

---

## Adımlar

### 1. Ön hazırlık — geri dönüşü var

- [ ] `npm run test:db` yeşil (39 migration + 7 test dosyası)
- [ ] `npx supabase migration list --linked` → bekleyen yok, repoda olmayan yok
- [ ] Moderatör atamalarını **not al**: SQL editöründe
      `select user_id, role from app_user_roles;` → çıktıyı bir yere kaydet
- [ ] Mevcut `.env`'in bir kopyasını al (geri dönüş için)
- [ ] Free plan engeli için (a)/(b)/(c) kararı verilmiş olsun

### 2. Yeni proje — geri dönüşü var

- [ ] Yeni proje: ad `petmatch`, bölge **eu-central-1**, org kararlaştırılan
- [ ] Yeni **ref** bir yere yazıldı
- [ ] Veritabanı şifresi güvenli bir yere kaydedildi (parola yöneticisi)

### 3. Şema — geri dönüşü var

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

### 4. Migration'ların taşımadıkları — geri dönüşü var

- [ ] **Auth → URL Configuration**: Site URL ve Redirect URL'ler.
      Bugün boş; [`auth-release-checklist.md`](auth-release-checklist.md)
      neyin gerektiğini söylüyor. **Bu adım zaten yapılmamış bir yayın
      önkoşulu — taşımayı fırsat bil.**
- [ ] **Edge Function deploy**:
      `npx supabase functions deploy send-notification --use-api`
      `npx supabase functions deploy delete-account --use-api`
- [ ] `npx supabase functions list` → ikisi de ACTIVE
- [ ] **Moderatör atamaları**: §1'de not alınanları yeni projede yeniden gir
- [ ] Secret gerekmiyor (`EXPO_ACCESS_TOKEN` opsiyonel ve set değil) — ama
      ileride eklenirse buraya da eklenmeli

### 5. İstemci — geri dönüşü var

- [ ] `.env` güncelle: `EXPO_PUBLIC_SUPABASE_URL`,
      `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_PROJECT_ID`
- [ ] `npm run gen:types` → `git diff types/database.ts` yalnızca meta satırı
      göstermeli; şema farkı çıkarsa **dur ve incele**
- [ ] `npm run lint && npm run typecheck && npm test` yeşil

### 6. Duman testi — geri dönüşü var, **atlanmamalı**

Buraya kadar her şey yeşil olsa bile uygulamanın gerçekten çalıştığını
görmeden devam etme. Yeni bir hesapla:

- [ ] Kayıt ol → onboarding (bölge seçimi görünüyor mu?)
- [ ] Pet profili + fotoğraf yükle (storage politikaları çalışıyor mu?)
- [ ] Keşfet açılıyor mu
- [ ] İkinci hesapla karşılıklı beğeni → **eşleşme kutlaması** çıkıyor mu
- [ ] Sohbet aç, mesaj gönder, karşı taraf **anlık** görüyor mu (realtime)
- [ ] Şifre sıfırlama e-postası gelip deep link açılıyor mu (§4'ün testi)

### 7. ⛔ GERİ DÖNÜŞSÜZ — eski projeyi kapat

Buraya yalnızca §6'nın tamamı yeşilse gel.

- [ ] Eski projeyi **önce duraklat** (sil değil), 24–48 saat bekle
- [ ] Bu süre içinde sorun çıkmazsa sil
- [ ] Pro'ya çıkıldıysa plan geri düşürülebilir

### 8. Sonrası

- [ ] [`services.md`](services.md) ve [`launch.md`](launch.md) içindeki
      bölge/ref bilgilerini güncelle
- [ ] Bu dosyanın başına "tamamlandı + tarih" not düş

---

## Neden bu sıra

Tek kural var: **geri dönüşsüz adım en sonda ve tek başına.** Şema, ayarlar
ve istemci geçişinin tamamı eski proje ayaktayken yapılıyor; bir şey
tutmazsa `.env`'i geri almak yeterli.

İkinci kural: **her fazın sonunda doğrulama var.** Tek bir büyük "bitti mi?"
kontrolü yerine dört küçük kapı — hangi adımın bozduğu belli olsun diye.
