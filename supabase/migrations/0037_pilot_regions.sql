-- Pilot bölgeler
--
-- `profiles.city` ve `pets.city` serbest metin: "İstanbul", "istanbul",
-- "Kadıköy/İstanbul" aynı sorguda toplanmıyor. Pilotun tüm amacı iki mahalleyi
-- KARŞILAŞTIRMAK olduğuna göre (bkz. docs/launch.md), serbest metinle bunu
-- ölçmek mümkün değil.
--
-- Serbest metin kaldırılmıyor — şehir hâlâ görünen bilgi. Yanına ölçülebilir
-- bir bölge anahtarı ekleniyor.
--
-- Neden enum değil tablo: bölge eklemek zamanla olacak bir şey ve enum'a değer
-- eklemek her seferinde migration + tip üretimi demek. Tablo, bölgeyi veri
-- olarak tutuyor; "Diğer" de gerçek bir satır çünkü onu SEÇENLERİN SAYISI
-- bir sonraki bölgeyi veriyle seçmenin tek yolu.

create table regions (
  slug       text primary key,
  name       text not null,
  /** 'other' için null — "başka bir yer" bir şehre bağlı değil. */
  city       text,
  is_pilot   boolean not null default false,
  is_active  boolean not null default true,
  sort_order integer not null default 0
);

insert into regions (slug, name, city, is_pilot, sort_order) values
  ('kadikoy',   'Kadıköy',   'İstanbul', true,  1),
  ('nisantasi', 'Nişantaşı', 'İstanbul', true,  2),
  ('other',     'Diğer',     null,       false, 99);

alter table regions enable row level security;

-- Bölge listesi herkese açık bir arama tablosu; yazma yolu yok (migration).
create policy regions_select_all on regions
  for select to authenticated
  using (is_active);

-- ---------------------------------------------------------------------------
-- Profil bölgesi
--
-- null = henüz seçmedi. 'other' = seçti ama pilot bölgede değil. İkisi ayrı:
-- onboarding'i tamamlamamış kullanıcıyla "başka yerdeyim" diyeni aynı kovaya
-- koymak, pilot ölçümünü bozar.
-- ---------------------------------------------------------------------------

alter table profiles
  add column region_slug text references regions (slug) on delete set null;

create index profiles_region_idx on profiles (region_slug);

/** Bölge seçimi — dar yazma yolu. */
create or replace function set_my_region(p_region_slug text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from regions where slug = p_region_slug and is_active
  ) then
    raise exception 'unknown region %', p_region_slug using errcode = '22023';
  end if;

  update profiles set region_slug = p_region_slug where id = auth.uid();
end;
$$;

revoke all on function set_my_region(text) from public, anon;
grant execute on function set_my_region(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Yoğunluk ölçümü
--
-- Pilot kararlarının (segmenti açmak, üçüncü bölgeyi seçmek, yarıçapı
-- daraltmak) dayanacağı sayı. Moderatöre açık: bölge başına kullanıcı sayısı
-- tek tek kullanıcıya gösterilecek bir bilgi değil.
-- ---------------------------------------------------------------------------

create or replace function region_density()
returns table (
  slug           text,
  name           text,
  is_pilot       boolean,
  onboarded      bigint,
  with_active_pet bigint
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
  select
    r.slug,
    r.name,
    r.is_pilot,
    count(p.id) filter (where p.onboarded_at is not null),
    count(distinct pet.owner_id)
  from regions r
  left join profiles p on p.region_slug = r.slug
  left join pets pet on pet.owner_id = p.id and pet.is_active
  where r.is_active
  group by r.slug, r.name, r.is_pilot, r.sort_order
  order by r.sort_order;
end;
$$;

revoke all on function region_density() from public, anon;
grant execute on function region_density() to authenticated;
