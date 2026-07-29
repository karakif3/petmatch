-- Doğrulama fotoğrafları özel bucket'ta, sınırlı boyut ve image allow-list ile
-- tutulur. RPC'ye var olmayan bir Storage yolu yazılarak bozuk moderasyon
-- kaydı oluşturulması da engellenir.

update storage.buckets
set
  file_size_limit = 6 * 1024 * 1024,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp'
  ]
where id = 'verification-photos';

create or replace function validate_verification_photo_object()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_path text := nullif(trim(new.payload ->> 'photo_path'), '');
begin
  if new.kind <> 'verification' then
    return new;
  end if;

  if new.subject_user_id is null
     or v_path is null
     or v_path not like new.subject_user_id::text || '/%'
     or not exists (
       select 1
       from storage.objects o
       where o.bucket_id = 'verification-photos'
         and o.name = v_path
     ) then
    raise exception 'verification photo object not found'
      using errcode = '22023';
  end if;

  return new;
end;
$$;

revoke all on function validate_verification_photo_object()
  from public, anon, authenticated;

drop trigger if exists moderation_verification_photo_exists on moderation_items;
create trigger moderation_verification_photo_exists
  before insert on moderation_items
  for each row execute function validate_verification_photo_object();
