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
Keşfet listesi `discover_playdate_pets()` (SECURITY DEFINER) üzerinden gelir;
mesafe sunucuda hesaplanıp yalnızca kaba bir `distance_bucket` olarak döner.
Böylece ham koordinat veya üçgenlemeye elverişli kesin mesafe ağa çıkmaz.

RPC önce bounding-box ile eler (`pets_discovery_idx`), sonra kalanlarda
haversine çalıştırır. PostGIS'e bağımlılık yok — taşınabilirlik için bilinçli.

## Eşleşme neden trigger

Karşılıklı beğeni kontrolü istemcide yapılsaydı iki taraf aynı anda beğendiğinde
yarış durumu oluşurdu. `on_swipe_created` trigger'ı beğeniyi yazarken karşı
kaydı kontrol eder ve `matches` satırını `on conflict do nothing` ile açar.
`pet_a_id < pet_b_id` kısıtı aynı çiftin iki kez yazılmasını unique index
düzeyinde imkânsız kılar.

## Yazma yolları neden RPC

RLS "hangi satır" sorusunu yanıtlar, "hangi kolon" sorusunu değil. `matches` ve
`messages` üzerinde geniş bir UPDATE politikası olduğunda taraf olduğun satırın
*her* kolonunu değiştirebilirsin — eşleşme satırındaki karşı taraf id'sini
başka bir pete yönlendirmek ya da karşı tarafın mesaj metnini düzenlemek dahil.

Bu yüzden 0005'te ikisinin de UPDATE politikası kaldırıldı; yerine niyeti dar
iki SECURITY DEFINER fonksiyonu kondu:

- `unmatch(match_id)` → yalnızca `is_active = false`
- `mark_messages_read(conversation_id)` → yalnızca karşı tarafın okunmamış
  mesajlarında `read_at`
- `withdraw_adoption_interest(id)` → yalnızca pending başvuruyu geri çeker
- `swipe_pet(from, to, direction)` → aktif playdate petlerini doğrulayıp swipe yazar
- `mark_onboarding_complete()` → 18+, aktif pet ve fotoğraf şartını doğrular
- `update_my_profile()` → opsiyonel sahip adı, zorunlu pet adı, şehir,
  görünürlük ve yuvarlanmış konumu tek transaction'da günceller

Kural: **bir tabloda tek bir kolonun değişmesi bekleniyorsa UPDATE politikası
değil RPC yaz.**

Engelleme de aynı migration'da eşleşmeyi kapatır (`on_block_created`) —
`shares_active_match_with()` blocks'a bakmadığı için engellenen taraf aksi
halde profili görmeye ve mesaj atmaya devam ediyordu.

`0015` sonrasında unmatch ve engelleme hem `matches.is_active` hem
`conversations.is_active` alanını kapatır. Mesaj INSERT politikası conversation
durumuna baktığı için kapatılmış bir ilişkide yeni mesaj yazılamaz.

## Konuşma üyeliği neden ayrı tabloda

Konuşma üyeliği petin güncel `owner_id` değerinden türetilemez. Pet
sahiplendirildiğinde bu yöntem yeni sahibin eski mesajları okumasına, eski
sahibin ise kendi geçmişini kaybetmesine yol açar. `0012` bu yüzden
`conversation_participants` tablosunu ekler; eşleşme veya kabul edilen
sahiplendirme başvurusu konuşmayı açarken o andaki kullanıcılar kalıcı olarak
kaydedilir. Sahiplik değişse de konuşma geçmişinin erişim sınırı değişmez.

## RLS politikaları neden dizi karşılaştırıyor

Doğru bir RLS politikası yavaş olabilir. 0003'teki `shares_active_match_with(owner_id)`
argümanını satırdan aldığı için Postgres onu **her aday satırında** yeniden
çalıştırıyordu — üstelik içinde iki tablolu bir join var. `explain` çıktısında
fonksiyon doğrudan `Filter:` içinde görünüyordu.

0006 üç kuralı uyguluyor:

1. **`auth.uid()` → `(select auth.uid())`** — sarmalanan çağrı optimizer'a
   initPlan ürettirir, sorgu başına bir kez çalışır.
2. **Satır-bağımlı çağrı → dizi karşılaştırma.** `owns_pet(pet_a_id)`
   sarmalanamaz (sonucu satıra bağlı). Yerine `my_pet_ids()`, `my_match_ids()`,
   `matched_owner_ids()`, `visible_pet_ids()`, `blocked_user_ids()` yardımcıları
   bir kez dizi üretir; politika `= any((select …)::uuid[])` ile kıyaslar.
   Yardımcılar SECURITY DEFINER olduğu için kendi tablolarının politikasını
   tetiklemez — özyineleme yok.
3. **`to authenticated`** — oturumsuz istek politika değerlendirilmeden reddedilir.

Sonuç `explain (costs off) select * from pets` üzerinde görünür:

```
-- önce
Filter: ((owner_id = (NULLIF(current_setting('request.jwt.claim.sub'…)))::uuid)
         OR shares_active_match_with(owner_id))     ← satır başına join

-- sonra
Filter: ((owner_id = (InitPlan 1).col1) OR (owner_id = ANY ((InitPlan 2).col1)))
```

`(select …)` sarmalamasında dikkat: `= any((select f()))` yazılırsa Postgres
bunu alt sorgu sanıp `uuid = uuid[]` hatası verir. `::uuid[]` cast'i ifadeyi
dizi olarak parse ettirir — kalıp bu yüzden `any((select f())::uuid[])`.

Politikada filtre olarak kullanılan her kolon index'li olmalı; 0006
`swipes.actor_id`, `messages.sender_id`, `blocks.blocked_id`,
`reports.reporter_id` index'lerini ekliyor.

## Taşınabilirlik

Repoda hiçbir Supabase proje ref'i, hesap kimliği veya sabit URL yok.
Başka bir hesaba geçiş:

```bash
supabase link --project-ref <yeni-ref>
supabase db push          # 4 migration sırayla uygulanır
# .env içindeki URL + anon key + SUPABASE_PROJECT_ID güncelle
npm run gen:types
```
