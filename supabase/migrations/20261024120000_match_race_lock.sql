-- Karşılıklı beğeni yarışı: iki kullanıcı aynı anda beğenirse iki
-- `handle_swipe` koşumu da karşı tarafın satırını (henüz commit edilmediği
-- için) görmüyor ve eşleşme hiç doğmuyordu. Çift başına transaction
-- kilidi: ikinci koşum, birincisi commit edene kadar bekler; READ COMMITTED
-- altında sonraki `select` yeni snapshot aldığı için karşılığı görür.
--
-- Gövdenin kalanı 0008_goal_model.sql:98-150 ile aynı.

create or replace function handle_swipe()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reciprocal boolean;
  v_from  pets%rowtype;
  v_to    pets%rowtype;
  v_goals match_goal[];
begin
  if new.direction <> 'like' then
    return new;
  end if;

  perform pg_advisory_xact_lock(
    hashtext(least(new.from_pet_id, new.to_pet_id)::text),
    hashtext(greatest(new.from_pet_id, new.to_pet_id)::text)
  );

  select exists (
    select 1 from swipes
    where from_pet_id = new.to_pet_id
      and to_pet_id = new.from_pet_id
      and direction = 'like'
  ) into v_reciprocal;

  if not v_reciprocal then
    return new;
  end if;

  select * into v_from from pets where id = new.from_pet_id;
  select * into v_to   from pets where id = new.to_pet_id;

  if is_blocked_between(v_from.owner_id, v_to.owner_id) then
    return new;
  end if;

  select coalesce(array_agg(g), '{}')
  into v_goals
  from unnest(v_from.goals) g
  where g = any (v_to.goals);

  if cardinality(v_goals) = 0 then
    return new;
  end if;

  insert into matches (pet_a_id, pet_b_id, matched_goals)
  values (
    least(new.from_pet_id, new.to_pet_id),
    greatest(new.from_pet_id, new.to_pet_id),
    v_goals
  )
  on conflict (pet_a_id, pet_b_id) do nothing;

  return new;
end;
$$;
