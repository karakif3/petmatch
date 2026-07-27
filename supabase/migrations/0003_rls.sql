-- Row Level Security
--
-- İlke: hiçbir tabloda "herkes her satırı okur" yok. Keşfet listesi
-- yalnızca discover_pets() RPC'sinden gelir; ham pets satırları (ve içindeki
-- lat/lng) sadece sahibine ve eşleşilen tarafa açıktır.

alter table profiles              enable row level security;
alter table pets                  enable row level security;
alter table pet_photos            enable row level security;
alter table discovery_preferences enable row level security;
alter table swipes                enable row level security;
alter table matches               enable row level security;
alter table messages              enable row level security;
alter table blocks                enable row level security;
alter table reports               enable row level security;
alter table push_tokens           enable row level security;

-- ---------------------------------------------------------------------------
-- Yardımcı: iki kullanıcı aktif bir eşleşmede karşı karşıya mı?
-- ---------------------------------------------------------------------------

create or replace function shares_active_match_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from matches m
    join pets mine  on mine.id  in (m.pet_a_id, m.pet_b_id) and mine.owner_id  = auth.uid()
    join pets other on other.id in (m.pet_a_id, m.pet_b_id) and other.owner_id = p_user_id
    where m.is_active and mine.id <> other.id
  );
$$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

create policy profiles_select_self on profiles
  for select using (id = auth.uid());

-- 'public' seçen kullanıcı profilini herkese açmış demektir.
create policy profiles_select_public on profiles
  for select using (owner_visibility = 'public');

-- 'after_match' seçenler yalnızca eşleştikleri kişiye görünür.
create policy profiles_select_matched on profiles
  for select using (
    owner_visibility = 'after_match' and shares_active_match_with(id)
  );

create policy profiles_update_self on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- pets — keşfet RPC üzerinden; doğrudan SELECT sadece kendi + eşleşilen
-- ---------------------------------------------------------------------------

create policy pets_select_own on pets
  for select using (owner_id = auth.uid());

create policy pets_select_matched on pets
  for select using (shares_active_match_with(owner_id));

create policy pets_insert_own on pets
  for insert with check (owner_id = auth.uid());

create policy pets_update_own on pets
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy pets_delete_own on pets
  for delete using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- pet_photos — petin görülebildiği yerde fotoğrafı da görülebilir
-- ---------------------------------------------------------------------------

create policy pet_photos_select on pet_photos
  for select using (
    exists (
      select 1 from pets p
      where p.id = pet_photos.pet_id
        and (p.owner_id = auth.uid() or shares_active_match_with(p.owner_id))
    )
  );

create policy pet_photos_write_own on pet_photos
  for all using (
    exists (select 1 from pets p where p.id = pet_photos.pet_id and p.owner_id = auth.uid())
  ) with check (
    exists (select 1 from pets p where p.id = pet_photos.pet_id and p.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- discovery_preferences
-- ---------------------------------------------------------------------------

create policy discovery_preferences_own on discovery_preferences
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- swipes — kendi swipe'ını yazar, karşı tarafınkini göremez
-- ---------------------------------------------------------------------------

create policy swipes_select_own on swipes
  for select using (actor_id = auth.uid());

create policy swipes_insert_own on swipes
  for insert with check (
    actor_id = auth.uid()
    and owns_pet(from_pet_id)
    and not owns_pet(to_pet_id)
  );

-- ---------------------------------------------------------------------------
-- matches — taraf olduğun eşleşmeler
-- ---------------------------------------------------------------------------

create policy matches_select_participant on matches
  for select using (owns_pet(pet_a_id) or owns_pet(pet_b_id));

-- Eşleşmeyi bozma: is_active=false. Yeni eşleşme yalnızca trigger'dan doğar.
create policy matches_update_participant on matches
  for update using (owns_pet(pet_a_id) or owns_pet(pet_b_id))
  with check (owns_pet(pet_a_id) or owns_pet(pet_b_id));

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

create policy messages_select_participant on messages
  for select using (is_match_participant(match_id));

create policy messages_insert_participant on messages
  for insert with check (
    sender_id = auth.uid()
    and is_match_participant(match_id)
    and exists (select 1 from matches m where m.id = match_id and m.is_active)
  );

-- Sadece okundu bilgisi güncellenebilsin diye alıcı tarafa update hakkı.
create policy messages_update_participant on messages
  for update using (is_match_participant(match_id))
  with check (is_match_participant(match_id));

-- ---------------------------------------------------------------------------
-- blocks / reports — yaz-ve-unut, kullanıcı kendi kayıtlarını görür
-- ---------------------------------------------------------------------------

create policy blocks_own on blocks
  for all using (blocker_id = auth.uid()) with check (blocker_id = auth.uid());

create policy reports_insert_own on reports
  for insert with check (reporter_id = auth.uid());

create policy reports_select_own on reports
  for select using (reporter_id = auth.uid());

-- ---------------------------------------------------------------------------
-- push_tokens
-- ---------------------------------------------------------------------------

create policy push_tokens_own on push_tokens
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
