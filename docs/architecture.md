# Mimari

## Katmanlar

```
app/          expo-router ekranları — platforma bağlı
components/   RN bileşenleri — platforma bağlı
stores/       zustand — RN'e hafif bağlı (expo-linking)
hooks/        TanStack Query sarmalayıcıları
core/
  domain/     ← saf TypeScript. RN/Expo importu YOK. Web'e olduğu gibi taşınır.
  api/        ← Supabase erişimi; platform farkı tek dosyada izole
supabase/     migration'lar + edge functions
```

## Web'e taşıma yolu

Bugün mobil-öncelikli, ama web tarafı sonradan eklenirken kod tekrarı olmasın
diye üç karar baştan verildi:

1. **`core/domain/` saf tutulur.** Uyum skoru, mesafe, yaş, eleme kuralları
   hiçbir React Native tipine dokunmaz. Next.js app'i bu klasörü doğrudan
   import eder.

2. **Supabase client fabrikası platformdan ayrı.**
   `core/api/client-factory.ts` storage adaptörünü ve `detectSessionInUrl`
   değerini parametre alır. Mobil bağlaması `core/api/supabase.client.ts`
   (AsyncStorage). Web bağlaması `localStorage` + `detectSessionInUrl: true`
   ile aynı fabrikayı çağırır — domain kodu değişmez.

3. **Env okuması iki ön eki de tanır.** `core/api/config.ts` hem
   `EXPO_PUBLIC_*` hem `NEXT_PUBLIC_*` okur.

Ayrıca `app.json` içinde `web.bundler: metro` + `output: static` açık —
`npm run web` ile bugün de tarayıcıda çalışır. Web login aynı Supabase Auth
oturumunu kullanır, ayrı bir kimlik sistemi yok.

## Neden keşfet bir RPC

`pets` tablosunda ham `latitude`/`longitude` var ve **hiçbir istemciye SELECT
ettirilmiyor** — RLS yalnızca kendi petlerine ve eşleştiklerine izin verir.
Keşfet listesi `discover_pets()` (SECURITY DEFINER) üzerinden gelir; mesafe
sunucuda hesaplanıp yalnızca `distance_km` olarak döner. Böylece kimsenin tam
konumu ağa çıkmaz.

RPC önce bounding-box ile eler (`pets_discovery_idx`), sonra kalanlarda
haversine çalıştırır. PostGIS'e bağımlılık yok — taşınabilirlik için bilinçli.

## Eşleşme neden trigger

Karşılıklı beğeni kontrolü istemcide yapılsaydı iki taraf aynı anda beğendiğinde
yarış durumu oluşurdu. `on_swipe_created` trigger'ı beğeniyi yazarken karşı
kaydı kontrol eder ve `matches` satırını `on conflict do nothing` ile açar.
`pet_a_id < pet_b_id` kısıtı aynı çiftin iki kez yazılmasını unique index
düzeyinde imkânsız kılar.

## Taşınabilirlik

Repoda hiçbir Supabase proje ref'i, hesap kimliği veya sabit URL yok.
Başka bir hesaba geçiş:

```bash
supabase link --project-ref <yeni-ref>
supabase db push          # 4 migration sırayla uygulanır
# .env içindeki URL + anon key + SUPABASE_PROJECT_ID güncelle
npm run gen:types
```
