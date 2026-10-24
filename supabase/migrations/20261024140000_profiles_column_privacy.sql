-- A17 (G01 raporu): profiles satırı RLS ile görünür olsa bile hassas kolonlar
-- (birth_date, gender, last_active_at, region_slug, verification_status,
-- connection_tag, ...) başkasına kapalı. Yaş kovası ve tek yönlü cinsiyet
-- kuralı (0068) yalnız SECURITY DEFINER RPC'lerde uygulanıyordu; tablo yolu
-- bunu tamamen atlıyordu.
--
-- Kişi kendi tam satırını get_my_profile() ile okur. Keşif/beğeni/sohbet
-- RPC'leri definer olduğu için etkilenmez; service_role etkilenmez. Kolon
-- grant'ı yeni kolonlara yayılmaz: ileride eklenen her kolon kapalı doğar.

revoke select on table public.profiles from anon, authenticated;

grant select (
  id,
  display_name,
  avatar_url,
  bio,
  city,
  owner_visibility,
  owner_social_open,
  interests
) on table public.profiles to authenticated;

create or replace function public.get_my_profile()
returns setof public.profiles
language sql
stable
security definer
set search_path = public
as $$
  select p.*
  from public.profiles p
  where p.id = (select auth.uid());
$$;

revoke all on function public.get_my_profile() from public, anon;
grant execute on function public.get_my_profile() to authenticated;
