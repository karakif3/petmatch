-- Cihaz/uygulama dilini push ve sunucu kaynaklı metinler için güvenli biçimde
-- kaydet. İstemci discovery_preferences tablosunu doğrudan güncelleyemez.

create or replace function update_my_language(p_language text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_language text := lower(nullif(trim(p_language), ''));
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_language is null
     or char_length(v_language) > 35
     or v_language !~ '^[a-z]{2,3}(-[a-z0-9]{2,8})*$' then
    raise exception 'invalid language tag' using errcode = '22023';
  end if;

  update discovery_preferences
  set language = v_language
  where user_id = auth.uid();
end;
$$;

revoke all on function update_my_language(text)
  from public, anon, authenticated;
grant execute on function update_my_language(text)
  to authenticated;
