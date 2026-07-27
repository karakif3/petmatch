-- Yasal metin sürümü ve isteğe bağlı veri işleme rızaları için denetim izi.
-- Aydınlatma bildirimi ile açık rıza birbirinden ayrı olaylar olarak tutulur.

create table legal_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (
    document_type in (
      'terms',
      'privacy_notice',
      'kvkk_notice',
      'location_consent',
      'public_profile_consent'
    )
  ),
  document_version text not null check (char_length(document_version) between 1 and 40),
  accepted boolean not null,
  created_at timestamptz not null default now()
);

create index legal_acceptances_user_created_idx
  on legal_acceptances (user_id, created_at desc);

alter table legal_acceptances enable row level security;

create policy legal_acceptances_select_self
  on legal_acceptances for select
  using ((select auth.uid()) = user_id);

-- İstemci doğrudan insert edemez; sürüm ve zorunlu kayıtlar RPC'de doğrulanır.
revoke all on table legal_acceptances from public, anon, authenticated;
grant select on table legal_acceptances to authenticated;

create or replace function record_legal_acceptances(
  p_document_version text,
  p_terms_accepted boolean,
  p_privacy_notice_acknowledged boolean,
  p_location_consent boolean default false,
  p_public_profile_consent boolean default false
)
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
  if not coalesce(p_terms_accepted, false)
     or not coalesce(p_privacy_notice_acknowledged, false) then
    raise exception 'required legal documents are not accepted'
      using errcode = '22023';
  end if;

  insert into legal_acceptances (
    user_id, document_type, document_version, accepted
  )
  values
    (auth.uid(), 'terms', v_version, true),
    (auth.uid(), 'privacy_notice', v_version, true),
    (auth.uid(), 'kvkk_notice', v_version, true),
    (auth.uid(), 'location_consent', v_version, coalesce(p_location_consent, false)),
    (auth.uid(), 'public_profile_consent', v_version, coalesce(p_public_profile_consent, false));
end;
$$;

revoke all on function record_legal_acceptances(
  text, boolean, boolean, boolean, boolean
) from public, anon, authenticated;
grant execute on function record_legal_acceptances(
  text, boolean, boolean, boolean, boolean
) to authenticated;

create or replace function record_optional_legal_consent(
  p_consent_type text,
  p_document_version text,
  p_accepted boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if p_consent_type not in ('location_consent', 'public_profile_consent') then
    raise exception 'invalid optional consent type' using errcode = '22023';
  end if;
  if nullif(trim(p_document_version), '') is null
     or char_length(p_document_version) > 40 then
    raise exception 'invalid document version' using errcode = '22023';
  end if;
  insert into legal_acceptances (
    user_id, document_type, document_version, accepted
  )
  values (
    auth.uid(), p_consent_type, trim(p_document_version), coalesce(p_accepted, false)
  );
end;
$$;

revoke all on function record_optional_legal_consent(text, text, boolean)
  from public, anon, authenticated;
grant execute on function record_optional_legal_consent(text, text, boolean)
  to authenticated;
