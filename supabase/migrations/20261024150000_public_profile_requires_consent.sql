-- A18 (G02 raporu): sahip profili ancak geçerli açık rızayla public olur.
-- Geçerli rıza = kullanıcının EN SON public_profile_consent kaydı accepted.
-- Yeni kayıt public doğmaz; rıza geri çekilince public → after_match.
-- Sürüm koşul değil: sürüm değişimi herkesten yeniden onay demektir.

-- 1. Yeni kayıt public doğmaz (0001:28'deki özgün varsayılana dönüş).
alter table profiles alter column owner_visibility set default 'after_match';

-- 2. Rıza yardımcısı (istemciye kapalı; yalnız tetikleyicilerden).
create or replace function has_public_profile_consent(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select la.accepted
    from legal_acceptances la
    where la.user_id = p_user_id
      and la.document_type = 'public_profile_consent'
    order by la.created_at desc, la.id desc
    limit 1
  ), false);
$$;
revoke all on function has_public_profile_consent(uuid) from public, anon, authenticated;

-- 3. Değişmez: public ⇒ geçerli rıza. Tüm yazma yolları (doğrudan UPDATE,
--    update_my_owner_details, update_my_profile, ileride eklenecekler).
create or replace function profiles_enforce_public_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_visibility = 'public'
     and not has_public_profile_consent(new.id) then
    raise exception 'public owner profile requires consent' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function profiles_enforce_public_consent() from public, anon, authenticated;

drop trigger if exists profiles_enforce_public_consent on profiles;
create trigger profiles_enforce_public_consent
  before insert or update of owner_visibility on profiles
  for each row execute function profiles_enforce_public_consent();

-- 4. Rıza geri çekilince public → after_match. (hidden değil: eşleşmiş
--    kişilerle mevcut sohbeti bozmaz; 0054 tetikleyicisi require_owner_photo
--    filtresini kendiliğinden kapatır.)
create or replace function legal_acceptances_withdraw_public_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.document_type = 'public_profile_consent' and not new.accepted then
    update profiles
    set owner_visibility = 'after_match'
    where id = new.user_id
      and owner_visibility = 'public';
  end if;
  return new;
end;
$$;
revoke all on function legal_acceptances_withdraw_public_profile() from public, anon, authenticated;

drop trigger if exists legal_acceptances_withdraw_public_profile on legal_acceptances;
create trigger legal_acceptances_withdraw_public_profile
  after insert on legal_acceptances
  for each row execute function legal_acceptances_withdraw_public_profile();

-- 5. Geçiş (G-a): bugüne kadarki rıza kayıtları zorunlu yasal kutuyla
--    paketli ya da görünürlüğe dokunmayan kayıtlarda yazıldı; hiçbiri
--    etkin bir seçim değil. Yayın öncesi: herkes after_match'e döner,
--    kullanıcı profil ekranından yeniden seçer.
update profiles set owner_visibility = 'after_match' where owner_visibility = 'public';
