-- "Hayır" ile "henüz cevaplanmadı" aynı boolean false değerinde tutuluyordu.
-- Uyumluluk sinyali artık üç durumlu: true, false, null (bilmiyorum).

alter table pets
  alter column good_with_cats drop not null,
  alter column good_with_cats drop default,
  alter column good_with_dogs drop not null,
  alter column good_with_dogs drop default,
  alter column good_with_kids drop not null,
  alter column good_with_kids drop default;

-- Ayrıntı formunu hiç tamamlamayan petlerde eski false değerleri kullanıcı
-- kararı değildi; tablo varsayılanıydı. Tamamlanmış profiller korunur.
update pets
set
  good_with_cats = null,
  good_with_dogs = null,
  good_with_kids = null
where details_completed_at is null;

create or replace function update_my_pet_profile(
  p_pet_id          uuid,
  p_name            text,
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

  update pets
  set
    name = v_name,
    breed = v_breed,
    birth_date = p_birth_date,
    size = p_size,
    energy_level = p_energy_level,
    is_neutered = p_is_neutered,
    temperaments = v_temperaments,
    good_with_cats = p_good_with_cats,
    good_with_dogs = p_good_with_dogs,
    good_with_kids = p_good_with_kids,
    bio = v_bio
  where id = p_pet_id
    and owner_id = auth.uid()
    and is_active
  returning id into v_pet_id;

  if v_pet_id is null then
    raise exception 'active pet not found' using errcode = 'P0002';
  end if;
  return v_pet_id;
end;
$$;

revoke all on function update_my_pet_profile(
  uuid, text, text, date, pet_size, smallint, boolean, text[],
  boolean, boolean, boolean, text
) from public, anon, authenticated;
grant execute on function update_my_pet_profile(
  uuid, text, text, date, pet_size, smallint, boolean, text[],
  boolean, boolean, boolean, text
) to authenticated;
