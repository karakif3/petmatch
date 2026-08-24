-- Mevcut kullanıcı yeniden kabulünde isteğe bağlı rızaları değiştirme.

create function record_required_legal_acceptances(p_document_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_version text := nullif(trim(p_document_version), '');
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_version is null or char_length(v_version) > 40 then
    raise exception 'invalid document version' using errcode = '22023';
  end if;

  insert into legal_acceptances (user_id, document_type, document_version, accepted)
  values
    (auth.uid(), 'terms', v_version, true),
    (auth.uid(), 'privacy_notice', v_version, true),
    (auth.uid(), 'kvkk_notice', v_version, true);
end;
$$;

revoke all on function record_required_legal_acceptances(text) from public, anon;
grant execute on function record_required_legal_acceptances(text) to authenticated;
