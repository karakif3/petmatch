-- Storage bucket'ları
--
-- pet-photos  → public read. Keşfet ekranı henüz eşleşmemiş kullanıcılara da
--               fotoğraf gösterdiği için her kart için signed URL üretmek
--               gereksiz maliyet. Yollar uuid tabanlı, tahmin edilemez.
-- owner-avatars → private. Sahip fotoğrafı görünürlük tercihine tabi,
--               erişim signed URL ile verilir.

insert into storage.buckets (id, name, public)
values
  ('pet-photos', 'pet-photos', true),
  ('owner-avatars', 'owner-avatars', false)
on conflict (id) do nothing;

-- Her iki bucket'ta da yazma hakkı: dosya yolunun ilk klasörü kullanıcı id'si
-- olmak zorunda (ör. `<uid>/<pet_id>/0.jpg`).

create policy pet_photos_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy pet_photos_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy pet_photos_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'pet-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy owner_avatars_all_own on storage.objects
  for all to authenticated
  using (
    bucket_id = 'owner-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'owner-avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
