-- Test yardımcıları. Migration'lardan SONRA, test dosyalarından ÖNCE yüklenir.

create schema if not exists tests;

/** Koşul doğruysa satır yazar, yanlışsa koşumu düşürür. */
create or replace function tests.assert(p_condition boolean, p_label text)
returns void
language plpgsql
as $$
begin
  if p_condition is true then
    raise notice '    ok   %', p_label;
  else
    raise exception 'FAIL: %', p_label;
  end if;
end;
$$;

/**
 * Verilen SQL'in hata vermesi beklenir.
 *
 * NOT: fonksiyon ÇAĞRI YETKİSİ testleri için kullanma. supabase/postgres
 * imajında yetkisiz bir fonksiyon çağrısı backend'i segfault ettiriyor
 * (eklenti kaynaklı, bizim SQL'imizle ilgisi yok). Yetki kontrolü için
 * `has_function_privilege` ile doğrudan iddia et.
 */
create or replace function tests.assert_raises(p_sql text, p_label text)
returns void
language plpgsql
as $$
begin
  begin
    execute p_sql;
  exception
    when others then
      raise notice '    ok   % [%]', p_label, sqlerrm;
      return;
  end;
  raise exception 'FAIL: % — beklenen hata oluşmadı', p_label;
end;
$$;

/** Oturumdaki kullanıcıyı ayarlar (auth.uid() bunu okur). */
create or replace function tests.act_as(p_user_id uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_user_id::text, true);
end;
$$;

/** Onboarding'i tamamlamış, 18+ bir kullanıcı ve profili. */
create or replace function tests.seed_user(
  p_id uuid,
  p_gender text default null,
  p_visibility owner_visibility default 'public'
)
returns uuid
language plpgsql
as $$
begin
  insert into auth.users (id, email) values (p_id, p_id::text || '@test.local');

  update profiles
  set birth_date       = '1995-01-01',
      onboarded_at     = now(),
      city             = 'Istanbul',
      display_name     = 'Test ' || left(p_id::text, 4),
      owner_visibility = p_visibility,
      gender           = p_gender,
      -- profiles_avatar_owned_path: yol kullanıcının kendi klasörüyle başlamalı
      avatar_url       = p_id::text || '/avatar.jpg'
  where id = p_id;

  insert into owner_photos (owner_id, storage_path, position)
  values (p_id, p_id::text || '/avatar.jpg', 0)
  on conflict (owner_id, position) do update
    set storage_path = excluded.storage_path;

  return p_id;
end;
$$;

/** Test kullanıcısını bir pilot (veya `other`) bölgeye koyar. */
create or replace function tests.assign_region(p_user uuid, p_slug text)
returns void
language plpgsql
as $$
begin
  update profiles set region_slug = p_slug where id = p_user;
end;
$$;

/** Aktif, konumu olan bir pet. */
create or replace function tests.seed_pet(
  p_id uuid,
  p_owner uuid,
  p_name text default 'Test Pet',
  p_goals match_goal[] default '{playdate}'
)
returns uuid
language plpgsql
as $$
begin
  insert into pets (id, owner_id, name, species, gender, latitude, longitude, city, goals)
  values (p_id, p_owner, p_name, 'dog', 'male', 41.01, 29.01, 'Istanbul', p_goals);
  return p_id;
end;
$$;

/** Karşılıklı beğeni — eşleşmeyi ve konuşmasını doğurur. */
create or replace function tests.seed_match(p_pet_a uuid, p_pet_b uuid)
returns uuid
language plpgsql
as $$
declare
  v_owner_a uuid;
  v_owner_b uuid;
  v_conversation uuid;
begin
  select owner_id into v_owner_a from pets where id = p_pet_a;
  select owner_id into v_owner_b from pets where id = p_pet_b;

  insert into swipes (from_pet_id, to_pet_id, actor_id, direction)
  values (p_pet_a, p_pet_b, v_owner_a, 'like'), (p_pet_b, p_pet_a, v_owner_b, 'like');

  select m.conversation_id into v_conversation
  from matches m
  where (m.pet_a_id = p_pet_a and m.pet_b_id = p_pet_b)
     or (m.pet_a_id = p_pet_b and m.pet_b_id = p_pet_a);

  return v_conversation;
end;
$$;

-- Testler `authenticated` rolüne geçtiğinde tablolara erişebilsin diye.
-- Üretimde bu grant'lar Supabase'in default privilege'larıyla gelir.
grant usage on schema public to authenticated, anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage on schema tests to authenticated;
grant execute on all functions in schema tests to authenticated;
