-- Pet ayrıntılarının doldurulup doldurulmadığını ayırt edebilmek
--
-- Kayıt akışı sadeleşti: ırk, boyut, enerji ve kısırlaştırma artık kayıt
-- sırasında sorulmuyor, şemadaki varsayılanlarıyla yazılıyor
-- (`size='medium'`, `energy_level=3`, `is_neutered=false`).
--
-- Bu bir ölçüm sorunu doğuruyor: varsayılanla gelen bir satırla, kullanıcının
-- gerçekten "orta boy, enerji 3, kısırlaştırılmamış" diye seçtiği satır
-- birbirinden AYIRT EDİLEMİYOR. Ayırt edemeyince de profil tamamlama kartı
-- ya hiç sormuyor ya da doğru dolduran kullanıcıyı boşuna dürtüyor.
--
-- Çözüm olarak `size`/`energy_level` null'a çevrilebilirdi ama ikisi de
-- eşleşme skorunda kullanılıyor (`core/domain/matching.ts`); null yapmak
-- skorlamayı ve keşfet filtrelerini elden geçirmeyi gerektirirdi. Bunun
-- yerine tek bir işaretçi ekleniyor: alanlar dolu ve varsayılan davranış
-- bozulmuyor, yalnızca "kullanıcı bu adımı bilerek geçti mi" sorusunun
-- cevabı saklanıyor.
--
-- null = ayrıntılar henüz doldurulmadı (kart gösterilir)

alter table pets
  add column if not exists details_completed_at timestamptz;

comment on column pets.details_completed_at is
  'Kullanıcı ırk/boyut/enerji/kısırlaştırma adımını tamamladığında dolar. '
  'null ise profil tamamlama kartı bu adımı eksik gösterir. Varsayılanla '
  'gelen satırı bilerek seçilmiş satırdan ayırmak için var.';

-- ---------------------------------------------------------------------------
-- İşaretleme yolu
--
-- `pets` istemciye doğrudan yazmaya kapalı; tüm yazma dar RPC'lerden geçiyor.
-- Mevcut `update_my_pet_profile` gövdesini yeniden yazmak yerine tek işi olan
-- ayrı bir fonksiyon ekleniyor — büyük fonksiyonu kopyalayıp değiştirmek,
-- kopyalama hatası riskini boşuna alırdı.
--
-- Fonksiyon yalnızca ÇAĞIRANIN KENDİ petini işaretliyor: `owner_id` koşulu
-- gövdede, parametreden gelmiyor.
-- ---------------------------------------------------------------------------

create or replace function mark_pet_details_completed(p_pet_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update pets
     set details_completed_at = now()
   where id = p_pet_id
     and owner_id = (select auth.uid());
$$;

revoke all on function mark_pet_details_completed(uuid) from public, anon;
grant execute on function mark_pet_details_completed(uuid) to authenticated;
