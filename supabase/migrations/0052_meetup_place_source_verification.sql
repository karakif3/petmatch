-- Buluşma noktalarında doğrulamanın kaynağını görünür ve denetlenebilir yap.
--
-- `is_verified` kullanıcı kapısı olarak kalıyor. Yeni alanlar bu kararın resmi
-- internet kaynağına mı, daha güçlü bir saha kontrolüne mi dayandığını ayırıyor.

alter table meetup_places
  add column verification_method text,
  add column source_name text,
  add column source_url text,
  add column source_checked_at date,
  add column amenities text[] not null default '{}';

alter table meetup_places
  add constraint meetup_places_verification_method_check
  check (verification_method is null or verification_method in ('official_source', 'field')),
  add constraint meetup_places_source_url_check
  check (source_url is null or source_url ~ '^https://');

-- Resmi kaynakta doğrudan pet alanı/olanağı belirtilen noktalar.
update meetup_places
set is_verified = true,
    verified_at = now(),
    verification_method = 'official_source',
    source_name = 'Kadıköy Belediyesi',
    source_url = 'https://kadikoy.bel.tr/tr/haber-detay/yogurtcu-parki-yenilenen-haliyle-hizmete-acildi-5649',
    source_checked_at = current_date,
    amenities = array['pet_park', 'walking_track'],
    note = 'Evcil hayvan parkı ve yürüyüş parkuru bulunan yenilenmiş yeşil alan.'
where region_slug = 'kadikoy' and name = 'Yoğurtçu Parkı';

update meetup_places
set is_verified = true,
    verified_at = now(),
    verification_method = 'official_source',
    source_name = 'Kadıköy Belediyesi 2023 Faaliyet Raporu',
    source_url = 'https://kadikoyapi.kadikoy.bel.tr/2f0f441bd04c46d0a31249fd08d76947.pdf',
    source_checked_at = current_date,
    amenities = array['dog_walking_area'],
    note = 'Belediye faaliyet raporuna göre köpek gezdirme alanı bulunuyor.'
where region_slug = 'kadikoy' and name = 'Özgürlük Parkı';

update meetup_places
set name = 'Moda Parkı',
    is_verified = true,
    verified_at = now(),
    verification_method = 'official_source',
    source_name = 'Kadıköy Belediyesi 2023 Faaliyet Raporu',
    source_url = 'https://kadikoyapi.kadikoy.bel.tr/2f0f441bd04c46d0a31249fd08d76947.pdf',
    source_checked_at = current_date,
    amenities = array['dog_walking_area'],
    note = 'Belediye faaliyet raporuna göre köpek gezdirme alanı bulunuyor.'
where region_slug = 'kadikoy' and name = 'Moda Sahili';

update meetup_places
set is_verified = true,
    verified_at = now(),
    verification_method = 'official_source',
    source_name = 'İBB Veteriner Hizmetleri Müdürlüğü',
    source_url = 'https://tarim.ibb.istanbul/tr/haberler/4543/ibb-veteriner-hizmetleri-mudurlugu-duspet-hizmetini-yayginlastiriyor.html',
    source_checked_at = current_date,
    amenities = array['duspet', 'walking_paths'],
    note = 'İBB kaynağında DuşPet noktası belirtilen geniş, halka açık park.'
where region_slug = 'nisantasi' and name = 'Maçka Demokrasi Parkı';

drop function list_meetup_places();

create function list_meetup_places()
returns table (
  id                  uuid,
  name                text,
  note                text,
  verification_method text,
  source_name         text,
  source_url          text,
  source_checked_at   date,
  amenities           text[]
)
language sql
stable
security definer
set search_path = public
as $$
  select mp.id, mp.name, mp.note, mp.verification_method, mp.source_name,
         mp.source_url, mp.source_checked_at, mp.amenities
  from meetup_places mp
  join profiles me on me.id = auth.uid()
  where mp.region_slug = me.region_slug
    and mp.is_verified
    and mp.is_active
  order by mp.sort_order, mp.name;
$$;

revoke all on function list_meetup_places() from public, anon;
grant execute on function list_meetup_places() to authenticated;

drop function conversation_meetup(uuid);

create function conversation_meetup(p_conversation_id uuid)
returns table (
  id                  uuid,
  place_id            uuid,
  place_name          text,
  place_note          text,
  verification_method text,
  source_name         text,
  source_url          text,
  source_checked_at   date,
  amenities           text[],
  scheduled_at        timestamptz,
  status              meetup_status,
  proposed_by         uuid,
  mine                boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select m.id, m.place_id, mp.name, mp.note, mp.verification_method,
         mp.source_name, mp.source_url, mp.source_checked_at, mp.amenities,
         m.scheduled_at, m.status, m.proposed_by, m.proposed_by = auth.uid()
  from meetups m
  join meetup_places mp on mp.id = m.place_id
  where m.conversation_id = p_conversation_id
    and exists (
      select 1 from conversation_participants cp
      where cp.conversation_id = m.conversation_id
        and cp.user_id = auth.uid()
    )
    and m.status in ('proposed', 'accepted')
  order by m.created_at desc
  limit 1;
$$;

revoke all on function conversation_meetup(uuid) from public, anon;
grant execute on function conversation_meetup(uuid) to authenticated;

-- Moderatörün sahada doğrulaması internet kaynağından daha güçlüdür.
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
      verification_method = case when p_verified then 'field' else null end,
      note = coalesce(p_note, note)
  where id = p_place_id;

  if not found then
    raise exception 'meetup place % not found', p_place_id using errcode = '22023';
  end if;
end;
$$;
