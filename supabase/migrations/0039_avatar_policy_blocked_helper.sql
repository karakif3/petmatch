-- Sahip avatarı politikası çağıramadığı bir fonksiyona bağlıydı
--
-- Belirti: onboarding'i tamamlarken
-- `permission denied for function is_blocked_between`.
--
-- Kök neden 0034'te yazılmış bir varsayımın yanlış olması. O migration
-- şunu iddia ediyordu:
--
--   "İkisi de yalnızca SECURITY DEFINER fonksiyonların İÇİNDEN çağrılıyor;
--    definer bağlamında çalıştıkları için çağıranın yetkisine ihtiyaç yok."
--
-- `is_blocked_between` için bu doğru değildi. 0021'de kurulan
-- `owner_avatars_read_visible` politikası da onu çağırıyor ve **RLS
-- politikaları çağıran rolün bağlamında değerlendirilir.** Dolayısıyla
-- `authenticated` bir kullanıcı `owner-avatars` bucket'ından okuma
-- denediği anda 42501 alıyordu.
--
-- Neden 0034'te fark edilmedi: aramalar `public` şemasıyla sınırlıydı,
-- bu politika ise `storage.objects` üzerinde. Şema sınırı bulguyu gizledi.
--
-- 0035'te `blocked_user_ids()` için birebir aynı hata çıkmıştı; orada
-- fonksiyona execute geri verilmişti çünkü parametresiz ve yalnızca
-- çağıranın kendi listesini döndürüyor. Burada aynı yolu SEÇMİYORUZ:
-- `is_blocked_between(a, b)` iki serbest parametre alıyor, yani execute
-- geri verilirse herhangi bir kullanıcı "şu iki kişi birbirini engellemiş
-- mi" sorusunu sorabilir hale gelir. 0034'ün kapattığı sızıntı buydu.
--
-- Bunun yerine politika, zaten `authenticated`'a açık olan ve yalnızca
-- çağıranın kendi engelleme listesini döndüren `blocked_user_ids()`
-- üzerine taşınıyor. İkisi anlamca denk: `blocked_user_ids()` hem
-- engelleyen hem engellenen yönünü topluyor, `is_blocked_between` de
-- çift yönlü bakıyordu.
--
-- `auth.uid()` çağrısı 0006'daki initPlan desenine uyacak şekilde
-- `(select auth.uid())` biçiminde yazıldı; davranış aynı, satır başına
-- yeniden değerlendirme ortadan kalkıyor.

drop policy if exists owner_avatars_read_visible on storage.objects;

create policy owner_avatars_read_visible on storage.objects
  for select to authenticated
  using (
    bucket_id = 'owner-avatars'
    and exists (
      select 1
      from profiles p
      where p.id::text = (storage.foldername(name))[1]
        and p.id <> all ((select blocked_user_ids())::uuid[])
        and (
          p.id = (select auth.uid())
          or p.owner_visibility = 'public'
          or (
            p.owner_visibility = 'after_match'
            and shares_active_match_with(p.id)
          )
        )
    )
  );
