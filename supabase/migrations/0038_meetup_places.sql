-- Buluşma yerleri
--
-- Dig'in sohbet içinde köpek dostu buluşma planlaması var (bkz.
-- docs/benchmark.md §3). Bizde bu aynı zamanda bir GÜVENLİK özelliği: ilk
-- buluşmanın halka açık bir parkta olmasını önermek, tanımadığı biriyle
-- buluşan kullanıcıyı koruyor.
--
-- Tasarımın can alıcı noktası doğrulama:
--
--   Doğrulanmamış yer verisiyle özellik göndermek, boş özellik göndermekten
--   DAHA KÖTÜ. Kullanıcıyı hayvan girişine kapalı bir parka yollamak,
--   güvenlik diye konumlandırdığımız şeyin tam tersi.
--
-- Bu yüzden `is_verified` varsayılan false ve kullanıcıya YALNIZCA doğrulanmış
-- yerler gösteriliyor. Aşağıdaki adaylar (docs/launch.md) önceden yükleniyor
-- ki saha teyidinden sonra veri girişi değil tek bir bayrak çevirmek gereksin.
--
-- Teyit edilecekler: hayvan girişi serbest mi · tasma kuralı · gündüz kalabalık
-- mı · su/gölge var mı · toplu taşımayla ulaşılabilir mi

create table meetup_places (
  id          uuid primary key default gen_random_uuid(),
  region_slug text not null references regions (slug) on delete cascade,
  name        text not null,
  /** Kullanıcıya gösterilen kısa bilgi: "tasmasız alan var", "sahil kenarı". */
  note        text,
  is_verified boolean not null default false,
  verified_at timestamptz,
  verified_by uuid references profiles (id) on delete set null,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (region_slug, name)
);

create index meetup_places_region_idx on meetup_places (region_slug, sort_order)
  where is_verified and is_active;

-- Aday listesi — HİÇBİRİ DOĞRULANMIŞ DEĞİL, dolayısıyla hiçbiri görünmüyor.
insert into meetup_places (region_slug, name, sort_order) values
  ('kadikoy',   'Yoğurtçu Parkı',        1),
  ('kadikoy',   'Özgürlük Parkı',        2),
  ('kadikoy',   'Fenerbahçe Parkı',      3),
  ('kadikoy',   'Moda Sahili',           4),
  ('nisantasi', 'Maçka Demokrasi Parkı', 1),
  ('nisantasi', 'Teşvikiye çevresi',     2);

alter table meetup_places enable row level security;

-- Doğrulanmamış yer hiçbir kullanıcıya görünmez.
create policy meetup_places_select_verified on meetup_places
  for select to authenticated
  using (is_verified and is_active);

-- ---------------------------------------------------------------------------
-- Kullanıcı tarafı
-- ---------------------------------------------------------------------------

/**
 * Oturumdaki kullanıcının bölgesindeki doğrulanmış buluşma yerleri.
 *
 * Bölgesi yoksa ya da 'other' ise boş dönüyor — o kullanıcı için küratörlü
 * liste henüz yok ve uydurma öneri vermek istemiyoruz.
 */
create or replace function list_meetup_places()
returns table (
  id   uuid,
  name text,
  note text
)
language sql
stable
security definer
set search_path = public
as $$
  select mp.id, mp.name, mp.note
  from meetup_places mp
  join profiles me on me.id = auth.uid()
  where mp.region_slug = me.region_slug
    and mp.is_verified
    and mp.is_active
  order by mp.sort_order, mp.name;
$$;

revoke all on function list_meetup_places() from public, anon;
grant execute on function list_meetup_places() to authenticated;

-- ---------------------------------------------------------------------------
-- Moderasyon tarafı
-- ---------------------------------------------------------------------------

/** Doğrulanmamışlar dahil tüm yerler — saha teyidi için çalışma listesi. */
create or replace function list_meetup_place_candidates()
returns table (
  id          uuid,
  region_slug text,
  region_name text,
  name        text,
  note        text,
  is_verified boolean,
  is_active   boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not is_moderator() then
    raise exception 'moderator role required' using errcode = '42501';
  end if;

  return query
  select mp.id, mp.region_slug, r.name, mp.name, mp.note, mp.is_verified, mp.is_active
  from meetup_places mp
  join regions r on r.slug = mp.region_slug
  order by r.sort_order, mp.sort_order, mp.name;
end;
$$;

/** Saha teyidinden sonra tek hamle: bayrağı çevir, isteğe bağlı not düş. */
create or replace function set_meetup_place_verification(
  p_place_id uuid,
  p_verified boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_moderator() then
    raise exception 'moderator role required' using errcode = '42501';
  end if;

  update meetup_places
  set is_verified = p_verified,
      verified_at = case when p_verified then now() else null end,
      verified_by = case when p_verified then auth.uid() else null end,
      note        = coalesce(p_note, note)
  where id = p_place_id;

  if not found then
    raise exception 'meetup place % not found', p_place_id using errcode = '22023';
  end if;
end;
$$;

revoke all on function list_meetup_place_candidates() from public, anon;
revoke all on function set_meetup_place_verification(uuid, boolean, text)
  from public, anon;
grant execute on function list_meetup_place_candidates() to authenticated;
grant execute on function set_meetup_place_verification(uuid, boolean, text) to authenticated;
