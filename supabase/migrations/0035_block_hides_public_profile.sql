-- Engelleme public profili de gizler
--
-- Bulgu, yeni veritabanı test koşumunun ilk tam çalışmasından çıktı:
-- `profiles_select_public` yalnızca `owner_visibility = 'public'` koşuluna
-- bakıyordu, engellemeye bakmıyordu.
--
-- Sonuç: birini engelleyen kullanıcının profili, engellenen kişiye açık
-- kalıyordu. Engellenen taraf eşleşemiyor ve mesaj yazamıyordu (0005/0015 o
-- yolları kapatmıştı) ama profil id'sini bildiği için adı, bio'yu, avatar
-- yolunu ve şehri okumaya devam edebiliyordu. Taciz senaryosunda engellemenin
-- vaadi "seni bulamasın" değil "sana erişemesin".
--
-- Diğer okuma yüzeyleri zaten korumalıydı: keşfet ve sahiplendirme listesi
-- `blocked_user_ids()` ile eliyor, `profiles_select_matched` aktif eşleşme
-- şartı koşuyor ve engelleme eşleşmeyi kapatıyor.

-- `blocked_user_ids()` artık bir POLİTİKANIN içinden çağrılıyor. RLS
-- politikaları çağıran kullanıcı bağlamında değerlendirildiği için execute
-- yetkisi gerekiyor; 0034 onu authenticated'dan almıştı çünkü o an yalnızca
-- SECURITY DEFINER fonksiyonların içinden çağrılıyordu.
--
-- Bilgi sızıntısı yok: fonksiyon parametre almıyor ve yalnızca çağıranın
-- kendi engelleme listesini döndürüyor.
grant execute on function blocked_user_ids() to authenticated;

drop policy if exists profiles_select_public on profiles;

create policy profiles_select_public on profiles
  for select to authenticated
  using (
    owner_visibility = 'public'
    and id <> all ((select blocked_user_ids())::uuid[])
  );
