-- Ücretsiz plan duraklatmasına karşı yazma tabanlı keep-alive.
--
-- Supabase "yeterli kullanıcı veritabanı aktivitesi" görmeyen Free projeyi
-- 7 günde duraklatıyor. İki günde bir anon okuma (2026-10-03 keep-alive'ı)
-- yetmedi: 2026-10-10'da çalışan ping'e rağmen duraklatma uyarısı geldi.
-- Bu fonksiyon her çağrıda gerçek bir INSERT + DELETE yapar.
--
-- Repo public olduğu için anon'a açık bir yazma ucu açılmıyor: çağrı
-- GitHub secret'ındaki token'ı ister; ops_settings'te yalnız SHA-256 özeti
-- durur. Token değişirse yalnız o satır güncellenir.
-- Tablo en son 50 kalpatışını tutar; boyutu sabit.

create table ops_keepalive (
  id       bigint generated always as identity primary key,
  beat_at  timestamptz not null default now(),
  source   text not null check (char_length(source) <= 40)
);

alter table ops_keepalive enable row level security;
revoke all on ops_keepalive from anon, authenticated;

comment on table ops_keepalive is
  'Free plan duraklatmasına karşı dış zamanlayıcının yazdığı kalpatışları. Yalnız keep_alive() yazar.';

create table ops_settings (
  key   text primary key,
  value text not null
);

alter table ops_settings enable row level security;
revoke all on ops_settings from anon, authenticated;

insert into ops_settings (key, value)
values ('keepalive_token_sha256', '45438ba81e890acdfe8c245856aa8687a41661a6ac1895bd9294ca54745172ba');

create function keep_alive(p_token text, p_source text default 'github-actions')
returns table (beats integer, last_beat_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_token is null
     or encode(sha256(convert_to(p_token, 'UTF8')), 'hex') is distinct from
        (select value from ops_settings where key = 'keepalive_token_sha256') then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  insert into ops_keepalive (source) values (left(coalesce(p_source, 'unknown'), 40));

  delete from ops_keepalive
  where id <= (select id from ops_keepalive order by id desc offset 50 limit 1);

  return query
  select count(*)::integer, max(k.beat_at) from ops_keepalive k;
end;
$$;

revoke all on function keep_alive(text, text) from public, anon, authenticated;
grant execute on function keep_alive(text, text) to anon;
