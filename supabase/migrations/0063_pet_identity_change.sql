-- Pet kimliği değiştirilebilir hale geliyor: tür, cinsiyet ve ad
--
-- ---------------------------------------------------------------------------
-- NEDEN
--
-- Pet düzenleme ekranı ad, ırk, yaş, boyut, enerji, mizaç, uyumluluk, bio ve
-- fotoğrafları zaten değiştirebiliyordu; **tür ve cinsiyet salt okunurdu.**
-- Yani köpeği ölüp kedi sahiplenen kullanıcının mevcut kaydını dönüştürme
-- yolu yoktu.
--
-- Kilidi açarken çözülmesi gereken asıl mesele veri değil GÜVEN: pet adı
-- `list_my_conversations` tarafından CANLI okunuyor. Luna'yı Kömür yapan
-- kullanıcının eşleştiği herkes, bir sabah aynı sohbette başka bir ad görür.
-- Değişimin kendisi sorun değil — insanlar "Luna'yı kaybettik" diyebilir —
-- sorun **sessiz** olması. Karşı tarafın ilk düşüneceği şey kandırıldığı olur.
--
-- Bu yüzden kilit açılırken iki şey birlikte geliyor:
--   1. Kimlik değişimi KAYDEDİLİYOR (`identity_changed_at`, `previous_name`)
--   2. Sohbet, değişimi o konuşma başladıktan sonra olduysa gösterebiliyor
--
-- Eşleşmeler SIFIRLANMIYOR, bilerek. Eşleşme kurulduğu an ilişki petler
-- arasında değil insanlar arasında devam ediyor; peti öldü diye birinin
-- arkadaşlığını silmek veri modeli detayı yüzünden gerçek bir ilişkiyi
-- kesmek olurdu. Temizlemek isteyenin aracı zaten var ve simetrik:
-- `unmatch_conversation` iki tarafta birden kapatıyor.
-- ---------------------------------------------------------------------------

alter table pets
  add column identity_changed_at timestamptz,
  add column previous_name       text;

comment on column pets.identity_changed_at is
  'Ad/tür/cinsiyet en son ne zaman değişti. Sohbet, değişim konuşmadan SONRA olduysa karşı tarafa not gösterir.';

-- ---------------------------------------------------------------------------
-- 1. Tür ve cinsiyet artık düzenlenebilir
-- ---------------------------------------------------------------------------

drop function if exists update_my_pet_profile(
  uuid, text, text, date, pet_size, smallint, boolean, text[],
  boolean, boolean, boolean, text
);

create function update_my_pet_profile(
  p_pet_id          uuid,
  p_name            text,
  p_species         species,
  p_gender          pet_gender,
  p_breed           text,
  p_birth_date      date,
  p_size            pet_size,
  p_energy_level    smallint,
  p_is_neutered     boolean,
  p_temperaments    text[],
  p_good_with_cats  boolean,
  p_good_with_dogs  boolean,
  p_good_with_kids  boolean,
  p_bio             text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name         text := nullif(trim(p_name), '');
  v_breed        text := nullif(trim(p_breed), '');
  v_bio          text := nullif(trim(p_bio), '');
  v_temperaments text[] := coalesce(p_temperaments, '{}');
  v_current      pets%rowtype;
  v_identity_changed boolean;
  v_pet_id       uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if v_name is null or char_length(v_name) > 40 then
    raise exception 'pet name must be between 1 and 40 characters'
      using errcode = '22023';
  end if;
  if v_breed is not null and char_length(v_breed) > 80 then
    raise exception 'breed is too long' using errcode = '22023';
  end if;
  if p_birth_date is not null and p_birth_date > current_date then
    raise exception 'birth date cannot be in the future' using errcode = '22023';
  end if;
  if p_energy_level not between 1 and 5 then
    raise exception 'energy level must be between 1 and 5' using errcode = '22023';
  end if;
  if v_bio is not null and char_length(v_bio) > 500 then
    raise exception 'bio is too long' using errcode = '22023';
  end if;
  if exists (
    select 1
    from unnest(v_temperaments) value
    where value <> all (array[
      'playful', 'calm', 'shy', 'curious', 'protective',
      'affectionate', 'independent'
    ])
  ) then
    raise exception 'invalid temperament' using errcode = '22023';
  end if;
  if cardinality(v_temperaments) <> (
    select count(distinct value) from unnest(v_temperaments) value
  ) then
    raise exception 'duplicate temperament' using errcode = '22023';
  end if;

  select * into v_current
  from pets
  where id = p_pet_id and owner_id = auth.uid() and is_active;

  if v_current.id is null then
    raise exception 'active pet not found' using errcode = 'P0002';
  end if;

  -- Kimlik değişimi = karşı tarafın GÖRDÜĞÜ şeyin değişmesi. Irk, enerji,
  -- mizaç gibi alanlar profili zenginleştiriyor; ad/tür/cinsiyet ise
  -- "bu kim" sorusunun cevabını değiştiriyor. Not yalnızca bunlar için.
  v_identity_changed :=
    v_current.name <> v_name
    or v_current.species <> p_species
    or v_current.gender <> p_gender;

  update pets
  set
    name = v_name,
    species = p_species,
    gender = p_gender,
    breed = v_breed,
    birth_date = p_birth_date,
    size = p_size,
    energy_level = p_energy_level,
    is_neutered = p_is_neutered,
    temperaments = v_temperaments,
    good_with_cats = p_good_with_cats,
    good_with_dogs = p_good_with_dogs,
    good_with_kids = p_good_with_kids,
    bio = v_bio,
    identity_changed_at = case
      when v_identity_changed then now() else identity_changed_at
    end,
    previous_name = case
      when v_identity_changed and v_current.name <> v_name
      then v_current.name
      else previous_name
    end
  where id = p_pet_id
  returning id into v_pet_id;

  return v_pet_id;
end;
$$;

revoke all on function update_my_pet_profile(
  uuid, text, species, pet_gender, text, date, pet_size, smallint, boolean,
  text[], boolean, boolean, boolean, text
) from public, anon, authenticated;
grant execute on function update_my_pet_profile(
  uuid, text, species, pet_gender, text, date, pet_size, smallint, boolean,
  text[], boolean, boolean, boolean, text
) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Desteyi sıfırla — swipe geçmişi, eşleşmeler DEĞİL
--
-- Tür değiştiğinde asıl sessiz kayıp burada: `swipes` pet id'sine bağlı
-- olduğu için yeni kimlik, eskisinin bütün geçmişini miras alıyor. Bunu iki
-- taraf da fark edemez, çünkü artık birbirlerini hiç görmüyorlar.
--
-- YALNIZCA KENDİ "geç" kayıtların siliniyor:
--   - Beğeniler durur: bir beğeniyi silmek eşleşmeyi bozmaz ama kaydı
--     tutmanın da zararı yok; niyet erişimi geri kazanmak, geçmişi silmek
--     değil.
--   - SANA verilmiş geçme kayıtlarına dokunulmuyor: onlar başkalarının açık
--     kararı. Silmek kötüye kullanıma açık olurdu (tür değiştirip geri alarak
--     herkesin kararını sıfırlamak). `0060`'ın yeniden dolaşımı o kayıtları
--     zaten 7 gün sonra kendiliğinden geri getiriyor.
-- ---------------------------------------------------------------------------

create or replace function reset_my_pet_passes(p_pet_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_deleted integer;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from pets where id = p_pet_id and owner_id = auth.uid()
  ) then
    raise exception 'pet not found' using errcode = '42501';
  end if;

  delete from swipes
  where from_pet_id = p_pet_id and direction = 'pass';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function reset_my_pet_passes(uuid) from public, anon, authenticated;
grant execute on function reset_my_pet_passes(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Sohbet, kimlik değişimini görebiliyor
--
-- `list_my_conversations` pet adını CANLI okuyor; `0063` tür/cinsiyet/ad
-- değişimini serbest bıraktığı için karşı tarafın sohbet başlığı bir sabah
-- değişebilir. Değişimin kendisi meşru — sorun sessiz olması.
--
-- Kural tek yerde: değişim konuşma başladıktan SONRA olduysa gösterilir.
-- Önce olduysa gösterilecek bir şey yok, kullanıcı zaten yeni kimlikle
-- tanışmış.
-- ---------------------------------------------------------------------------

-- RETURNS TABLE'a kolon eklemek dönüş tipini değiştiriyor; `create or
-- replace` bunu kabul etmiyor.
drop function if exists list_my_conversations();

create function list_my_conversations()
returns table (
  conversation_id          uuid,
  conversation_kind        text,
  is_active                boolean,
  counterpart_user_id      uuid,
  counterpart_display_name text,
  pet_id                   uuid,
  pet_name                 text,
  pet_photo_path           text,
  last_message             text,
  last_message_at          timestamptz,
  unread_count             bigint,
  awaiting_my_reply        boolean,
  ask_meetup_feedback      boolean,
  -- Kayıttan gelen soruda yeri/tarihi adıyla anmak için. Sezgiden gelen
  -- sorularda ikisi de null kalır.
  meetup_place_name        text,
  meetup_scheduled_at      timestamptz,
  -- Karşı tarafın peti bu konuşma BAŞLADIKTAN SONRA kimlik değiştirdi mi.
  pet_identity_changed     boolean,
  pet_previous_name        text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.kind,
    c.is_active,
    other_participant.user_id,
    case
      when other_profile.owner_visibility = 'hidden' then null
      else other_profile.display_name
    end,
    coalesce(match_pet.id, adoption_pet.id),
    coalesce(match_pet.name, adoption_pet.name),
    first_photo.storage_path,
    latest_message.body,
    latest_message.created_at,
    coalesce(unread.total, 0),
    -- Sıra sende: son sözü karşı taraf söyledi.
    coalesce(latest_message.sender_id <> auth.uid(), false),
    -- Buluşma sorusu: kayıtlı ve zamanı geçmiş onaylı buluşma varsa kesin,
    -- yoksa eski sezgiye (iki yönlü, olgunlaşmış, cevapsız konuşma) düş.
    (
      c.is_active
      and not exists (
        select 1 from meetup_feedback mf
        where mf.conversation_id = c.id and mf.user_id = auth.uid()
      )
      and (
        confirmed_meetup.id is not null
        or (
          stats.total_messages >= 4
          and stats.distinct_senders >= 2
          and stats.first_message_at < now() - interval '3 days'
        )
      )
    ),
    confirmed_meetup.place_name,
    confirmed_meetup.scheduled_at,
    /*
     * Kimlik değişimi notu KARŞILAŞTIRMA sunucuda yapılıyor: değişim
     * konuşmadan önce olduysa gösterilecek bir şey yok (kullanıcı zaten
     * yeni kimlikle tanıştı), sonra olduysa karşı tarafın bunu bilmeye
     * hakkı var. İstemciye iki tarih verip kıyaslamayı ona bırakmak,
     * kuralın ikinci bir kopyasını üretmek olurdu.
     */
    coalesce(
      coalesce(match_pet.identity_changed_at, adoption_pet.identity_changed_at)
        > c.created_at,
      false
    ),
    case
      when coalesce(match_pet.identity_changed_at, adoption_pet.identity_changed_at)
             > c.created_at
      then coalesce(match_pet.previous_name, adoption_pet.previous_name)
    end
  from conversation_participants mine
  join conversations c on c.id = mine.conversation_id
  left join lateral (
    select cp.user_id
    from conversation_participants cp
    where cp.conversation_id = c.id
      and cp.user_id <> auth.uid()
    order by cp.joined_at
    limit 1
  ) other_participant on true
  left join profiles other_profile
    on other_profile.id = other_participant.user_id
  left join matches m
    on m.conversation_id = c.id
  left join lateral (
    select p.id, p.name, p.identity_changed_at, p.previous_name
    from pets p
    where p.id in (m.pet_a_id, m.pet_b_id)
      and p.owner_id = other_participant.user_id
    limit 1
  ) match_pet on true
  left join adoption_interests ai
    on ai.conversation_id = c.id
  left join pets adoption_pet
    on adoption_pet.id = ai.pet_id
  left join lateral (
    select ph.storage_path
    from pet_photos ph
    where ph.pet_id = coalesce(match_pet.id, adoption_pet.id)
    order by ph.position
    limit 1
  ) first_photo on true
  left join lateral (
    select msg.body, msg.created_at, msg.sender_id
    from messages msg
    where msg.conversation_id = c.id
    -- `id` ikincil anahtar: aynı damgaya düşen iki mesajda "son mesaj" aksi
    -- halde belirsiz kalıyor ve sıra göstergesi yanlış tarafa dönebiliyor.
    -- Sayfalamadaki keyset ile aynı gerekçe.
    order by msg.created_at desc, msg.id desc
    limit 1
  ) latest_message on true
  left join lateral (
    select count(*) as total
    from messages msg
    where msg.conversation_id = c.id
      and msg.sender_id <> auth.uid()
      and msg.read_at is null
  ) unread on true
  left join lateral (
    select
      count(*) as total_messages,
      count(distinct msg.sender_id) as distinct_senders,
      min(msg.created_at) as first_message_at
    from messages msg
    where msg.conversation_id = c.id
  ) stats on true
  left join lateral (
    select mt.id, mp.name as place_name, mt.scheduled_at
    from meetups mt
    join meetup_places mp on mp.id = mt.place_id
    where mt.conversation_id = c.id
      and mt.status = 'accepted'
      and mt.scheduled_at < now()
    order by mt.scheduled_at desc
    limit 1
  ) confirmed_meetup on true
  where mine.user_id = auth.uid()
  -- Sırası sende olanlar üste. Hinge'in göstergesini etkili kılan şey
  -- rozetin kendisi değil, konuşmayı görünür yere taşıması.
  order by
    coalesce(latest_message.sender_id <> auth.uid(), false) desc,
    coalesce(latest_message.created_at, c.created_at) desc;
$$;

revoke all on function list_my_conversations() from public, anon, authenticated;
grant execute on function list_my_conversations() to authenticated;
