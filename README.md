# PetMatch

> **For pets. For their people.**
>
> **Petler tanıştırır. Bağınızı siz kurarsınız.**

PetMatch; oyun arkadaşlığından dostluğa veya romantik bir bağa uzanabilen,
pet-first sosyal tanışma ürünüdür. Kullanıcılar pet profili oluşturur, yakındaki
uyumlu petleri ve görünür olmayı seçen sahiplerini keşfeder, karşılıklı
beğeniyle eşleşir ve mesajlaşır. Sahip görünürlüğü ve tanışmaya açıklık
kullanıcının kontrolündedir.

| | |
|---|---|
| Platform | Expo (iOS · Android · web) |
| Backend | Supabase — Postgres + RLS + Storage + Auth |
| Durum | **Erken MVP** — ana akış, güvenlik işlemleri ve tam pet profil düzenleme hazır |

---

## Nereden başlanır

| Doküman | İçerik |
|---|---|
| [`docs/mvp-scope.md`](docs/mvp-scope.md) | MVP kapsamı, sahip görünürlüğü kararı, tek aktif pet kararı |
| [`docs/goal-model.md`](docs/goal-model.md) | **Tasarım önerisi** — hikâye petin etrafında, sahiplendirme, karşılıklı açıklama, satıcı caydırıcılığı, 18+ |
| [`docs/monetization.md`](docs/monetization.md) | Gelir modeli — faz sırası, kim beğendi / boost kuralları, asla satılmayacaklar |
| [`docs/architecture.md`](docs/architecture.md) | Katmanlar, web'e taşıma yolu, keşfetin neden RPC olduğu |
| [`docs/services.md`](docs/services.md) | Hangi servis gerekiyor, ne paylaşılıyor — **Supabase kotası burada** |
| [`docs/brand.md`](docs/brand.md) | Marka işareti, asset kullanımı ve resmi renk paleti |
| [`docs/pet-first-connection.md`](docs/pet-first-connection.md) | Pet-first sosyal/dating kararı, veri sınırları ve yayın kapıları |
| [`docs/i18n.md`](docs/i18n.md) | Çok dil katalogları, native metadata ve yeni dil yayın süreci |
| [`docs/backlog.md`](docs/backlog.md) | **Tek numaralı ürün backlog'u** — P0, P1 ve P2 sırası |
| [`docs/auth-release-checklist.md`](docs/auth-release-checklist.md) | Şifre reset deep link'i ve Supabase redirect URL yayın ayarı |
| [`docs/legal-release-checklist.md`](docs/legal-release-checklist.md) | Yasal bilgiler, mağaza veri beyanı ve yayın kontrolleri |
| [`docs/moderation-runbook.md`](docs/moderation-runbook.md) | Moderasyon kuyruğu, 24 saat SLA, push/crash/funnel operasyonu |

---

## Kurulum

```bash
npm install
cp .env.example .env   # Supabase URL + anon key doldur
npm start
```

Supabase bağlı değilken uygulama açılır ama giriş ekranı uyarı gösterir.

### Veritabanı

```bash
supabase link --project-ref <ref>
supabase db push
npm run gen:types
```

Migration'lar sırayla temel şemayı, RLS/storage katmanını, amaç ve konuşma
modelini, moderasyonu, sahiplendirmeyi ve dar RPC yazma yollarını kurar.

Push bildirim göndericisi ve hesap silme işlevi ayrıca Edge Function olarak
dağıtılır:

```bash
supabase functions deploy send-notification --use-api
supabase functions deploy delete-account --use-api
```

EAS projesi bağlıdır. Push bildirimleri Expo Go ve simülatör yerine
`eas.json` içindeki development/preview/production profillerinden üretilen
fiziksel cihaz build'i üzerinde denenir.

> Yerel geliştirme için `supabase init` ile `config.toml` üretmek gerekir;
> repoda henüz yok. Bu makinede başka bir projenin yerel yığını ayakta
> olabilir — portlar çakışırsa `config.toml` içinde değiştir.

---

## Yapı

```
app/          expo-router ekranları
core/
  domain/     saf TS — uyum skoru, mesafe, yaş, eleme (web'e taşınabilir)
  api/        Supabase client (platform bağlaması izole)
stores/       zustand — auth
supabase/
  migrations/ 0001 şema · 0002 eşleşme · 0003 RLS · 0004 storage
              0005 RLS sertleştirme · 0006 RLS performans
              0007 konum gizliliği · 0008 amaç modeli
              0009 konuşmalar + sahiplendirme · 0010 moderasyon + doğrulama
              0011 sahiplendirme ilanları · 0012 bütünlük + konuşma üyeliği
              0013 playdate keşfet + güvenli swipe · 0014 swipe uygunluğu
              0015 inbox + sohbet yaşam döngüsü · 0016 trigger sırası
              0017 inbox sahip gizliliği · 0018 opsiyonel sahip adı + profil
              0019 push tokenları + bildirim tercihleri
              0020 güvenlik işlemleri + tam pet profil yazma yolları
              0021–0024 sahip profili + sosyal keşfet + yaş kovası
              0025–0030 hukuk/onay + keşfet + moderasyon + gözlemlenebilirlik
              0031–0032 premium sohbet + doğrulama upload sertleştirmesi
              0033 sunucu bildirimleri için güvenli dil tercihi
  functions/  güvenli Expo Push göndericisi + hesap/storage silme
docs/
```

---

## Test

```bash
npm test
```

Eşleşme mantığı ve tarih kuralları testli — skorlama, eleme, çift yönlü
görünürlük zorunluluğu, geçerli tarih ve 18+ kontrolleri kapsanıyor.

---

## Sırada ne var

- [x] Supabase proje bağlantısı + migration'lar
- [x] Onboarding + pet profili oluşturma ekranı
- [x] Keşfet kart destesi (`discover_playdate_pets` RPC → `rankCandidates`)
- [x] Eşleşme listesi + Realtime sohbet ekranı
- [x] Konum izni + konum güncelleme
- [x] Şikâyet, engelleme, eşleşmeyi kaldırma ve hesap silme
- [x] Tam pet profil düzenleme + 1–6 fotoğraf ekleme/silme/sıralama
- [x] Sahip fotoğrafı/bio/yaş-cinsiyet paylaşımı + sosyal buluşma modu
- [x] Şeffaf pet-first sosyal tanışma metinleri + çok dil altyapısının ilk kataloğu
- [x] Sahip fotoğrafı, doğrulama ve karşılıklı yaş/cinsiyet keşfet filtreleri
- [x] Sahip + pet birlikte fotoğraf doğrulama başvurusu
- [x] Şifre kurtarma/deep link + e-posta doğrulama durumları
- [x] Uygulama içi yasal merkez + sürümlü KVKK/onay kayıtları
- [x] Pet türü/yaşı/mesafesi/sahip görünürlüğü keşfet filtreleri
- [x] Boş deste aksiyonları + filtre uyumlu yeni pet push bildirimi
- [x] Moderator kuyruğu + 24 saat SLA + push/hata/funnel görünürlüğü
- [ ] Bildirimler — istemci + Supabase + EAS hazır; fiziksel cihaz build/test bekliyor
- [x] Marka çalışması — PetMatch adı, palet, app/adaptive/splash icon ve favicon

### Önümüzdeki plan — öncelik sırası

Yetkili ve numaralı plan [`docs/backlog.md`](docs/backlog.md) dosyasındadır.
Tamamlananlar ve yayın kapıları için doğrudan backlog'daki güncel sırayı izle.
