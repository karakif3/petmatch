-- pet-photos okuma politikaları
--
-- ⚠️ BU DOSYA UZAKTAN İNDİRİLDİ (`supabase migration fetch`).
--
-- Canlı projeye dashboard SQL editöründen uygulanmış ve repoya girmemişti;
-- `supabase migration list` yalnızca uzakta görünen bir sürüm olarak ortaya
-- çıkardı. Şema kaynağı repo olduğu için buraya alındı. Dosya adı uzaktaki
-- sürüm numarasıyla birebir aynı bırakıldı — değiştirilirse yerel ve uzak
-- geçmişler ayrışır ve `db push` bunu yeni bir migration sanar.
--
-- İçeriği tasarımla tutarlı: `pet-photos` bucket'ı `0004`'te bilerek public
-- tanımlanmıştı. Keşfet destesi henüz eşleşmemiş kullanıcılara da fotoğraf
-- gösterdiği için kart başına signed URL üretmek gereksiz maliyet olurdu;
-- yollar uuid tabanlı ve tahmin edilemez. Bu migration o kararın storage
-- politikası karşılığını kuruyor.
--
-- Ders: şema değişikliği dashboard'dan yapılırsa repo ile canlı ayrışıyor.
-- Değişiklikler migration olarak yazılmalı.

drop policy if exists pet_photos_select_own on storage.objects;
create policy pet_photos_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists pet_photos_select_public on storage.objects;
create policy pet_photos_select_public on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'pet-photos');

drop policy if exists pet_photos_update_own on storage.objects;
create policy pet_photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
