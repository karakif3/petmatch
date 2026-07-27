-- Doğrulama fotoğrafı yolu sahiplikle doğrulanır ve aynı anda tek başvuru olur.

create policy verification_photos_delete_moderator on storage.objects
  for delete to authenticated
  using (bucket_id = 'verification-photos' and is_moderator());

create or replace function submit_verification(p_pet_id uuid, p_photo_path text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_path text := nullif(trim(p_photo_path), '');
begin
  if auth.uid() is null or not owns_pet(p_pet_id) then
    raise exception 'not your pet' using errcode = '42501';
  end if;
  if v_path is null
     or v_path not like auth.uid()::text || '/' || p_pet_id::text || '/%' then
    raise exception 'invalid verification photo path' using errcode = '22023';
  end if;
  if exists (
    select 1 from moderation_items
    where created_by = auth.uid()
      and kind = 'verification'
      and status = 'pending'
  ) then
    raise exception 'a verification request is already pending'
      using errcode = '23505';
  end if;

  insert into moderation_items (
    kind, created_by, subject_user_id, subject_pet_id, payload
  )
  values (
    'verification', auth.uid(), auth.uid(), p_pet_id,
    jsonb_build_object('photo_path', v_path)
  )
  returning id into v_id;

  update profiles
  set verification_status = 'pending', verified_at = null
  where id = auth.uid();

  return v_id;
end;
$$;

revoke all on function submit_verification(uuid, text)
  from public, anon, authenticated;
grant execute on function submit_verification(uuid, text) to authenticated;
