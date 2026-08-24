-- Sahip fotoğrafı filtresi karşılıklıdır: açıklık isteyen kullanıcı aynı
-- açıklığı kendi profilinde de sağlamalıdır.

create function enforce_owner_photo_reciprocity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile profiles%rowtype;
begin
  if new.require_owner_photo then
    select * into v_profile from profiles where id = new.user_id;
    if v_profile.avatar_url is null or v_profile.owner_visibility <> 'public' then
      raise exception 'owner photo filter requires a public owner photo'
        using errcode = '23514';
    end if;
  end if;
  return new;
end;
$$;

create trigger discovery_preferences_owner_photo_reciprocity
before insert or update of require_owner_photo on discovery_preferences
for each row execute function enforce_owner_photo_reciprocity();

create function clear_owner_photo_filter_when_private()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.avatar_url is null or new.owner_visibility <> 'public' then
    update discovery_preferences
    set require_owner_photo = false
    where user_id = new.id and require_owner_photo;
  end if;
  return new;
end;
$$;

create trigger profiles_clear_owner_photo_filter
after update of avatar_url, owner_visibility on profiles
for each row
when (
  old.avatar_url is distinct from new.avatar_url
  or old.owner_visibility is distinct from new.owner_visibility
)
execute function clear_owner_photo_filter_when_private();

-- Eski tutarsız kayıtları migration anında düzelt.
update discovery_preferences dp
set require_owner_photo = false
from profiles p
where p.id = dp.user_id
  and dp.require_owner_photo
  and (p.avatar_url is null or p.owner_visibility <> 'public');
