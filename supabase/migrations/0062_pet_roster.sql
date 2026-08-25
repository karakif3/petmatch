-- Petlerim: yeni pet ekleme ve aktif peti değiştirme
--
-- ---------------------------------------------------------------------------
-- NEDEN
--
-- `0012` "kullanıcı başına tek aktif pet" kuralını `(owner_id) where is_active`
-- unique index'iyle veritabanına yazdı ve `mvp-scope.md` şöyle anlattı:
-- "Birden fazla pet kaydedilebilir ama keşfet ve eşleşme tek bir aktif pet
-- üzerinden yürür; kullanıcı aktif peti profil ekranından değiştirir."
--
-- **O ekran hiç yapılmamıştı.** Pet yalnızca onboarding'de yaratılıyordu;
-- uygulamada ikinci pet eklemenin ya da aktif peti değiştirmenin hiçbir yolu
-- yoktu. Yani doküman var olmayan bir yeteneği anlatıyordu ve pratikte kural
-- "tek hesap = sonsuza kadar tek pet"ti.
--
-- Bunun bedeli en çok bir yerde ağır: **petin ölmesi.** Bir pet ürününde bu
-- er geç yaşanır ve uygulamanın buna cevabı yoktu — kullanıcının tek çıkışı
-- hesabı silmekti, o da bütün eşleşmelerini ve sohbetlerini götürüyordu.
--
-- ---------------------------------------------------------------------------
-- NEDEN RPC
--
-- İkisi de ATOMİK olmak zorunda. Unique index aynı anda iki aktif pete izin
-- vermiyor; istemciden "eskiyi kapat, yeniyi aç" diye iki ayrı istek atmak,
-- arada bir hata olduğunda kullanıcıyı **hiç aktif peti olmayan** duruma
-- düşürür — ki o durumda Keşfet, swipe ve profil tamamlama hep birden kırılır.
-- Tek transaction içinde iki UPDATE bunu imkânsız kılıyor.
-- ---------------------------------------------------------------------------

create or replace function create_my_pet(
  p_name    text,
  p_species species,
  p_gender  pet_gender
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := nullif(trim(p_name), '');
  v_id   uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) > 40 then
    raise exception 'pet name must be between 1 and 40 characters'
      using errcode = '22023';
  end if;

  /*
   * Yeni pet PASİF doğuyor. İki sebep:
   *
   * 1. Fotoğrafsız aktif pet, destede boş bir kart demek. Onboarding zaten
   *    en az bir fotoğraf şart koşuyor; buradan girilen pet o kuralı
   *    atlayamamalı.
   * 2. Aktifleştirme ayrı ve bilinçli bir adım olmalı: kullanıcı yeni pet
   *    eklerken mevcut petinin destedeki yerini kaybettiğini görerek karar
   *    versin, yan etki olarak yaşamasın.
   */
  insert into pets (owner_id, name, species, gender, is_active)
  values (auth.uid(), v_name, p_species, p_gender, false)
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function create_my_pet(text, species, pet_gender)
  from public, anon, authenticated;
grant execute on function create_my_pet(text, species, pet_gender) to authenticated;

create or replace function set_active_pet(p_pet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from pets where id = p_pet_id and owner_id = auth.uid()
  ) then
    raise exception 'pet not found' using errcode = '42501';
  end if;

  -- Fotoğrafsız pet aktif edilemez: aktif pet destede kart demek, kartın da
  -- en az bir fotoğrafı olmalı (onboarding'deki kuralın aynısı).
  if not exists (select 1 from pet_photos where pet_id = p_pet_id) then
    raise exception 'pet needs at least one photo to become active'
      using errcode = '23514';
  end if;

  -- İKİ AYRI UPDATE, tek transaction. Tek ifadeyle
  -- `set is_active = (id = p_pet_id)` yazmak, satır sırasına göre geçici
  -- olarak iki aktif pet oluşturup unique index'i patlatabilirdi.
  update pets set is_active = false
  where owner_id = auth.uid() and is_active;

  update pets set is_active = true
  where id = p_pet_id;
end;
$$;

revoke all on function set_active_pet(uuid) from public, anon, authenticated;
grant execute on function set_active_pet(uuid) to authenticated;
