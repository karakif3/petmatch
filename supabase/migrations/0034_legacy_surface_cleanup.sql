-- Eski yüzey temizliği
--
-- Denetimde iki bulgu çıktı:
--
--   1. `discover_pets` doğrudan istemciye açıktı. Bu fonksiyon ÖLÜ DEĞİL —
--      `discover_playdate_pets` onu sarmalayıp üstüne sahip fotoğrafı, sosyal
--      mod ve doğrulama filtrelerini uyguluyor. Sorun, ham katmanın da
--      çağrılabilir olması: istemci sarmalayıcıyı atlayıp `discover_pets`'i
--      doğrudan çağırarak bu filtrelerin hiçbirini uygulamayan bir aday
--      listesi alabilirdi. Anon key istemci paketinin içinde olduğu için bu
--      teorik bir risk değil.
--
--      Çözüm düşürmek değil (sarmalayıcı ona muhtaç), istemciye kapatmak.
--      `discover_playdate_pets` SECURITY DEFINER olduğu için çağıranın
--      yetkisine bakmadan iç katmanı kullanmaya devam eder.
--
--   2. 0002–0010 arası fonksiyonlar `anon` rolüne açık kalmış. `revoke ...
--      from public, anon, authenticated` deseni 0011'de öğrenildi ama geriye
--      taşınmadı. Supabase'de `revoke from public` tek başına yetmiyor: imaj,
--      public şemada oluşturulan fonksiyonlar için anon/authenticated/
--      service_role rollerine DEFAULT PRIVILEGE ile ayrıca execute veriyor.
--
-- Bu migration ikincisini tek tek kapatmak yerine yapısal olarak çözüyor:
-- uygulama oturumsuz hiçbir şey yapmıyor (anon'a bilerek verilmiş tek bir
-- yetki yok), dolayısıyla anon'un public şemada hiçbir fonksiyonu çağırmaması
-- doğru varsayılan.

-- ---------------------------------------------------------------------------
-- 1. Ham keşfet katmanını istemciye kapat
--
-- Tek geçerli giriş `discover_playdate_pets`. Ham katman yalnızca onun
-- içinden, definer bağlamında çağrılır.
-- ---------------------------------------------------------------------------

revoke all on function discover_pets(uuid, text[], integer, integer, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. anon'un mevcut fonksiyon yüzeyini kapat
--
-- RLS politikaları çağıran kullanıcı olarak değerlendirilir; bu yüzden
-- politikaların içinde geçen yardımcılardan `authenticated` ÇEKİLMEZ
-- (owns_pet, my_pet_ids, my_match_ids, matched_owner_ids, visible_pet_ids,
-- is_match_participant, shares_active_match_with). Yalnızca anon kapatılıyor.
-- ---------------------------------------------------------------------------

-- DİKKAT: yalnızca `from anon` revoke etmek İŞE YARAMAZ. Postgres yeni
-- fonksiyonlara varsayılan olarak PUBLIC'e execute verir; anon o yetkiyi
-- PUBLIC üyeliği üzerinden alır. Doğrudan grant'ı olmadığı için ondan revoke
-- etmek hiçbir şeyi değiştirmez — PUBLIC'ten de almak gerekir.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and has_function_privilege('anon', p.oid, 'execute')
  loop
    execute format('revoke all on function %s from public, anon', fn.signature);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Tekrarı önle — asıl düzeltme bu
--
-- Tek tek revoke etmek bugünü temizler, yarını temizlemez: bundan sonra
-- yazılan her fonksiyon yine default privilege ile anon'a açılırdı.
-- Varsayılanı kaynağında değiştiriyoruz.
-- ---------------------------------------------------------------------------

-- Aynı sebeple varsayılanı PUBLIC'ten de almak gerekiyor. Bundan sonra
-- yazılan her fonksiyon "kapalı doğar"; erişim açıkça grant edilmeden
-- çalışmaz. İstenen hata modu bu: unutulan grant sessiz bir açık değil,
-- ilk çağrıda görünen bir hata üretir.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- ---------------------------------------------------------------------------
-- 4. Politikada geçmeyen, bilgi sızdıran iki yardımcıyı authenticated'dan da al
--
-- İkisi de yalnızca SECURITY DEFINER fonksiyonların İÇİNDEN çağrılıyor;
-- definer bağlamında çalıştıkları için çağıranın yetkisine ihtiyaç yok.
--
--   is_blocked_between(a, b) → iki kullanıcı arasında engelleme var mı
--   owner_response_rate(id)  → herhangi bir sahibin yanıt oranı
-- ---------------------------------------------------------------------------

revoke all on function is_blocked_between(uuid, uuid) from authenticated;
revoke all on function owner_response_rate(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- 5. Denetimi tekrarlanabilir kıl
--
-- Bulguları tek tek aramak yerine, bulunabilir hale getiriyoruz. Moderatör
-- bu raporu istediği an çalıştırır; boş dönmesi beklenen normaldir.
-- ---------------------------------------------------------------------------

create or replace function security_surface_report()
returns table (
  severity text,
  finding  text,
  object   text
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
  -- RLS kapalı tablo
  select 'high'::text, 'RLS kapali tablo'::text, c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity

  union all
  -- anon'a açık fonksiyon
  select 'high'::text, 'anon calistirabiliyor'::text, p.oid::regprocedure::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')

  union all
  -- SECURITY DEFINER + search_path ayarsız
  select 'high'::text, 'security definer, search_path ayarsiz'::text, p.oid::regprocedure::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef
    and not exists (
      select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%'
    )

  union all
  -- sarmalanmamış auth.uid() (performans)
  select 'medium'::text, 'sarmalanmamis auth.uid()'::text, (pol.tablename || '.' || pol.policyname)::text
  from pg_policies pol
  where pol.schemaname = 'public'
    and (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) ~* 'auth[.]uid'
    and (coalesce(pol.qual, '') || ' ' || coalesce(pol.with_check, '')) !~* 'select auth[.]uid'

  union all
  -- RLS açık ama politikasız (kasıtlı olabilir; grant'ları da kapalı olmalı)
  select 'low'::text, 'RLS acik, politika yok'::text, c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
    and not exists (
      select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
    );
end;
$$;

-- Erişim `authenticated`'a açık ama fonksiyon içeride is_moderator() arıyor;
-- moderatör olmayan çağıran 42501 alır.
revoke all on function security_surface_report() from public, anon;
grant execute on function security_surface_report() to authenticated;
