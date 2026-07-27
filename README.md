# PetMatch

> Kedin veya köpeğin için yakınında oyun arkadaşı bul.

Kullanıcılar evcil hayvanlarının profilini oluşturur, yakındaki uyumlu petleri
keşfeder, karşılıklı beğeniyle eşleşir ve mesajlaşır. Sahibin profilinin
görünürlüğü kullanıcının kontrolündedir — dilerse karşı taraf için de zorunlu
kılabilir.

| | |
|---|---|
| Platform | Expo (iOS · Android · web) |
| Backend | Supabase — Postgres + RLS + Storage + Auth |
| Durum | **İskelet** — şema ve eşleşme mantığı hazır, ekranlar yer tutucu |

---

## Nereden başlanır

| Doküman | İçerik |
|---|---|
| [`docs/mvp-scope.md`](docs/mvp-scope.md) | MVP kapsamı, sahip görünürlüğü kararı, tek aktif pet kararı |
| [`docs/goal-model.md`](docs/goal-model.md) | **Tasarım önerisi** — hikâye petin etrafında, sahiplendirme, karşılıklı açıklama, satıcı caydırıcılığı, 18+ |
| [`docs/monetization.md`](docs/monetization.md) | Gelir modeli — faz sırası, kim beğendi / boost kuralları, asla satılmayacaklar |
| [`docs/architecture.md`](docs/architecture.md) | Katmanlar, web'e taşıma yolu, keşfetin neden RPC olduğu |
| [`docs/services.md`](docs/services.md) | Hangi servis gerekiyor, ne paylaşılıyor — **Supabase kotası burada** |

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

Migration'lar sırayla: şema → eşleşme mantığı → RLS → storage →
RLS sertleştirme → RLS performans.

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
              0011 sahiplendirme ilanları
docs/
```

---

## Test

```bash
npm test
```

Eşleşme mantığı (`core/domain/matching.test.ts`) testli — skorlama, eleme
kuralları ve çift yönlü görünürlük zorunluluğu kapsanıyor.

---

## Sırada ne var

- [ ] Supabase projesi kararı ([`docs/services.md`](docs/services.md))
- [ ] Onboarding + pet profili oluşturma ekranı
- [ ] Keşfet kart destesi (`discover_pets` RPC → `rankCandidates`)
- [ ] Eşleşme listesi + sohbet ekranı
- [ ] Konum izni + konum güncelleme
- [ ] Bildirimler
- [ ] Marka çalışması (isim, palet, ikon) — palet şu an yer tutucu
