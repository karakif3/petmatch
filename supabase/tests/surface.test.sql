-- Güvenlik yüzeyi: yapısal iddialar.
--
-- Bunlar davranış değil ŞEMA testleri — yeni bir migration yanlışlıkla bir
-- tabloyu RLS'siz bırakırsa ya da bir fonksiyonu anon'a açarsa burada patlar.

begin;

\echo '  surface: güvenlik yüzeyi'

-- Her tablo RLS altında olmalı.
select tests.assert(
  (select count(*) from pg_class c
   join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity) = 0,
  'public şemadaki her tabloda RLS açık'
);

-- Uygulama oturumsuz hiçbir şey yapmıyor; anon'un fonksiyon yüzeyi olmamalı.
select tests.assert(
  (select count(*) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')) = 0,
  'anon hiçbir public fonksiyonu çalıştıramıyor'
);

-- SECURITY DEFINER + değişken search_path = klasik yetki yükseltme yolu.
select tests.assert(
  (select count(*) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef
     and not exists (
       select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%'
     )) = 0,
  'her SECURITY DEFINER fonksiyonda search_path sabitlenmiş'
);

-- 0006'da kurulan performans deseni korunuyor mu.
select tests.assert(
  (select count(*) from pg_policies
   where schemaname = 'public'
     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) ~* 'auth[.]uid'
     and (coalesce(qual, '') || ' ' || coalesce(with_check, '')) !~* 'select auth[.]uid') = 0,
  'politikalarda auth.uid() (select ...) ile sarmalanmış'
);

-- Ham keşfet katmanı yalnızca sarmalayıcının içinden çağrılabilir olmalı.
-- discover_playdate_pets sahip fotoğrafı, sosyal mod ve doğrulama filtrelerini
-- ham katmanın ÜSTÜNE uyguluyor; ham katman açık kalırsa istemci atlar.
select tests.assert(
  not has_function_privilege('authenticated', 'discover_pets(uuid,text[],integer,integer,integer)', 'execute'),
  'ham discover_pets istemciye kapalı'
);

select tests.assert(
  has_function_privilege('authenticated', 'discover_playdate_pets(uuid,text[],integer,integer,integer)', 'execute'),
  'keşfet sarmalayıcısı authenticated''a açık'
);

-- Moderasyon yüzeyi yalnızca sunucu tarafında yetkilenmeli.
select tests.assert(
  (select count(*) from pg_proc p
   join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'get_moderation_queue'
     and p.prosrc like '%is_moderator%') = 1,
  'moderasyon kuyruğu is_moderator() kontrolü içeriyor'
);

-- ---------------------------------------------------------------------------
-- Politikadan çağrılan her fonksiyon authenticated'a açık olmalı
--
-- Bu iddia iki kez elle kaçırıldı ve ikisinde de canlıda 42501 çıktı:
-- 0035 (`blocked_user_ids`, profiles politikası) ve 0039
-- (`is_blocked_between`, storage.objects politikası).
--
-- RLS politikaları ÇAĞIRAN rolün bağlamında değerlendirilir; içeride
-- çağrılan fonksiyon o role kapalıysa sorgu hata verir. Fonksiyonu
-- "yalnızca SECURITY DEFINER içinden çağrılıyor" diye revoke etmek,
-- politikalar taranmadan yapıldığında bu hatayı üretiyor.
--
-- 0039'un asıl dersi tarama sınırıydı: 0034 yalnızca `public` şemaya
-- baktığı için `storage.objects` üzerindeki politikayı görmedi. Bu yüzden
-- aşağıdaki tarama ŞEMA AYRIMI YAPMIYOR.
select tests.assert(
  (
    select count(*)
    from pg_policies pol
    join pg_proc p on true
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (
        coalesce(pol.qual, '') like '%' || p.proname || '(%'
        or coalesce(pol.with_check, '') like '%' || p.proname || '(%'
      )
      and not has_function_privilege('authenticated', p.oid, 'execute')
  ) = 0,
  'politikalardan çağrılan her fonksiyon authenticated''a açık'
);

rollback;
