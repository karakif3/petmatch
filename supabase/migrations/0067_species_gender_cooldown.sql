-- Tür ve cinsiyet: kayıtta kilit, 6 ayda bir istisna
--
-- ---------------------------------------------------------------------------
-- NEDEN
--
-- 0063 tür/cinsiyeti yerinde açtı çünkü roster kapalıyken "hayvanım değişti"
-- için başka kapı yoktu. Açık kalınca destede Luna bir sabah kedi olabiliyor
-- — eşleşme sıfırlanmasa da karşı taraf kandırıldığını düşünür.
--
-- Kilit kayıt anından başlar (`species_gender_changed_at = now()` insert'te).
-- Pet öldü / yeni hayvan geldi: 6 ayda bir kez tür veya cinsiyet
-- güncellenebilir. Ad bu kotalın DIŞINDA; o hâlâ 0063'ün sohbet notuyla
-- değişir.
--
-- Neden trigger, yalnız RPC değil: `pets_update_own` doğrudan UPDATE'e izin
-- veriyor. RPC'ye koyulan kota istemciden atlanırdı. Trigger hem RPC'yi hem
-- tablo yazmasını bağlar; damgayı da istemcinin geriye çekmesini engeller.
-- ---------------------------------------------------------------------------

alter table pets
  add column species_gender_changed_at timestamptz not null default now();

comment on column pets.species_gender_changed_at is
  'Tür veya cinsiyet en son ne zaman yazıldı. Insert = kayıt anı. 6 ay dolmadan yeniden değişmez.';

update pets
set species_gender_changed_at = created_at
where species_gender_changed_at is distinct from created_at;

create function pets_protect_species_gender()
returns trigger
language plpgsql
as $$
begin
  -- JWT yoksa (migration, test, admin psql) damga serbest. RPC ve
  -- authenticated tablo yazması auth.uid() taşıdığı için kota uygulanır.
  -- session_user kullanılamaz: `SET ROLE authenticated` session_user'ı
  -- postgres bırakır, kota her testte atlanırdı.
  if auth.uid() is null then
    return new;
  end if;

  if new.species is distinct from old.species
     or new.gender is distinct from old.gender then
    if old.species_gender_changed_at > now() - interval '6 months' then
      raise exception 'species and gender can change at most once every 6 months'
        using errcode = 'P0001';
    end if;
    new.species_gender_changed_at := now();
  else
    new.species_gender_changed_at := old.species_gender_changed_at;
  end if;
  return new;
end;
$$;

create trigger pets_protect_species_gender
  before update on pets
  for each row
  execute function pets_protect_species_gender();

revoke all on function pets_protect_species_gender() from public, anon, authenticated;
