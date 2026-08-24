-- Keşfet tek katmana indi + sahip yaş/cinsiyet filtresi `public` kapısına çekildi
--
-- İki ayrı bulgu ama tek yerde oturuyorlar, o yüzden tek migration.
--
-- ---------------------------------------------------------------------------
-- 1. FİLTRE, KESME İŞLEMİNDEN SONRA UYGULANIYORDU
--
-- `discover_playdate_pets` ham `discover_pets`'ten **sabit 100 satır** alıp
-- playdate / sahip fotoğrafı / sosyal mod / doğrulama filtrelerini onun
-- ÜSTÜNE uyguluyordu. İç katman mesafeye göre sıralayıp kestiği için, uygun
-- aday 100'üncü sıradan sonra kalırsa deste sessizce boşalıyordu.
--
-- Bugün ısırmıyor: `0057`'den beri havuz tek bölge ve hiçbir pilot bölge
-- 100 adayı geçmiyor. Ama bu bir tesadüf, kural değil — ve boşalma en çok
-- filtre kullanan kullanıcıyı, yani ürüne en çok emek vermiş olanı vurur.
--
-- Çözüm sarmalayıcıyı beslemek değil, kaldırmak. `discover_pets`'in tek
-- çağıranı zaten `discover_playdate_pets`'ti (`0034` onu istemciye kapatmış,
-- `0058` trigger yardımcılarıyla birlikte yetkisini bir kez daha teyit
-- etmişti). İki katman tek fonksiyonda birleşince `p_limit` gerçek limit
-- oluyor ve "önce kes sonra filtrele" hata sınıfı kökten gidiyor.
--
-- `p.goals && v_viewer.goals` koşulu kaldırıldı, yerine doğrudan
-- `'playdate' = any (p.goals)` kondu: giriş kapısı zaten bakanın aktif
-- playdate peti olmasını şart koştuğu için ikisi mantıken denk, ama ikincisi
-- bu yüzeyin gerçek kuralını söylüyor.
--
-- ---------------------------------------------------------------------------
-- 2. SAHİP YAŞ FİLTRESİ GÖRÜNÜRLÜK KAPISI TANIMIYORDU
--
-- `0047`'den beri sözleşme net: sahip alanları bu yüzeyde **yalnızca
-- `public`** iken dolu (`owner_profile_shown`, `discovery-owner-visibility`
-- testi bunu koruyor). Filtreler o sözleşmeye uymuyordu:
--
--   - Yaş filtresinde görünürlük kontrolü HİÇ yoktu.
--   - Cinsiyet filtresi yalnızca `<> 'hidden'` istiyordu.
--
-- Sonuç bir çıkarım sızıntısı: kartta gösterilmeyen bir bilgi, filtre
-- daraltılıp sonuç kümesindeki değişim okunarak öğrenilebiliyordu. `hidden`
-- bir sahibin yaşı aralık daraltılarak yıla kadar, `after_match` bir sahibin
-- cinsiyeti ise eşleşmeden önce çıkarılabilirdi. `0007`'de ham mesafeye karşı
-- alınan önlemle aynı tür açık: doğrudan okunamayan şeyin sorgu üzerinden
-- ölçülebilmesi.
--
-- Karar: **sahip filtresi = sahip katmanı.** Bir sahip filtresi açıkken
-- yalnızca `public` sahipli adaylar değerlendirilir; diğerleri destede hiç
-- çıkmaz. Bu, `require_owner_photo`'nun zaten uyguladığı semantiğin aynısı —
-- filtre daralttığında dürüst daraltıyor, muaf tutup yalan söylemiyor.
--
-- Aynı kapı sosyal mod ve doğrulama filtrelerine de eklendi. Pratikte
-- davranış değişmiyor (`update_my_profile` / `update_my_owner_details`
-- `public` olmayan profilde `owner_social_open`'ı zaten kapatıyor, rozet de
-- yalnızca `public` iken doluyor) ama kural artık tek yerde ve açıkça yazılı.
-- ---------------------------------------------------------------------------

drop function if exists discover_playdate_pets(uuid, text[], integer, integer, integer);

create function discover_playdate_pets(
  p_pet_id          uuid,
  p_owner_genders   text[] default null,
  p_owner_min_age   integer default null,
  p_owner_max_age   integer default null,
  p_limit           integer default 50
)
returns table (
  id                   uuid,
  owner_id             uuid,
  name                 text,
  species              species,
  breed                text,
  birth_date           date,
  gender               pet_gender,
  is_neutered          boolean,
  size                 pet_size,
  energy_level         smallint,
  temperaments         text[],
  good_with_cats       boolean,
  good_with_dogs       boolean,
  good_with_kids       boolean,
  goals                match_goal[],
  bio                  text,
  city                 text,
  photo_paths          text[],
  distance_bucket      text,
  activity_bucket      text,
  -- Bu satırda sahip alanları gerçekten dolu mu (yalnızca `public`).
  owner_profile_shown  boolean,
  owner_display_name   text,
  owner_avatar_path    text,
  owner_bio            text,
  owner_gender         text,
  owner_age_bucket     text,
  owner_social_open    boolean,
  owner_verified       boolean,
  owner_interests      text[]
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_viewer  pets%rowtype;
  v_me      profiles%rowtype;
  v_prefs   discovery_preferences%rowtype;
  v_blocked uuid[];
  v_lat_pad double precision;
  v_lon_pad double precision;
begin
  select p.* into v_viewer
  from pets p
  where p.id = p_pet_id
    and p.owner_id = auth.uid()
    and p.is_active
    and 'playdate' = any (p.goals);

  if v_viewer.id is null then
    raise exception 'an active playdate pet is required' using errcode = '42501';
  end if;

  select p.* into v_me
  from profiles p
  where p.id = auth.uid();

  select dp.* into v_prefs
  from discovery_preferences dp
  where dp.user_id = auth.uid();

  -- Karşılıklı açıklama: kendi sahip profilini açmadan karşı tarafınkine
  -- göre filtre kuramazsın (`0021`).
  if p_owner_genders is not null and (
    v_me.gender is null or v_me.owner_visibility <> 'public'
  ) then
    raise exception 'gender filter requires a public disclosed owner profile'
      using errcode = '42501';
  end if;
  if (p_owner_min_age is not null or p_owner_max_age is not null)
     and (v_me.birth_date is null or v_me.owner_visibility <> 'public') then
    raise exception 'age filter requires a public disclosed owner profile'
      using errcode = '42501';
  end if;
  if v_prefs.require_owner_social and not v_me.owner_social_open then
    raise exception 'owner social filter requires social mode'
      using errcode = '42501';
  end if;

  -- Engellenenler bir kez toplanır; aksi halde her aday satırında
  -- is_blocked_between() çağrısı yapılırdı (`0007`).
  v_blocked := blocked_user_ids();

  -- Bounding box ön elemesi — haversine'i her satırda çalıştırmamak için.
  v_lat_pad := v_prefs.max_distance_km / 111.0;
  v_lon_pad := v_prefs.max_distance_km
    / greatest(1.0, 111.0 * cos(radians(coalesce(v_viewer.latitude, 0))));

  return query
  with candidates as (
    select
      p.*,
      prof.owner_visibility,
      prof.avatar_url,
      prof.last_active_at,
      prof.display_name        as prof_display_name,
      prof.bio                 as prof_bio,
      prof.gender              as prof_gender,
      prof.birth_date          as prof_birth_date,
      prof.owner_social_open   as prof_social_open,
      prof.verification_status as prof_verification_status,
      prof.interests           as prof_interests,
      case
        when v_viewer.latitude is null or p.latitude is null then null
        else haversine_km(
          v_viewer.latitude,
          v_viewer.longitude,
          p.latitude,
          p.longitude
        )
      end as km
    from pets p
    join profiles prof on prof.id = p.owner_id
    where p.is_active
      and p.owner_id <> v_viewer.owner_id
      -- Seçilen bölge = arama havuzu (`0057`).
      and shares_discover_region(v_viewer.owner_id, p.owner_id)
      -- Bu yüzey yalnızca playdate; sahiplendirme ayrı yüzeyde (`0008`).
      and 'playdate' = any (p.goals)
      and p.species = any (v_prefs.species)
      and not exists (
        select 1
        from swipes s
        where s.from_pet_id = p_pet_id and s.to_pet_id = p.id
      )
      and p.owner_id <> all (v_blocked)
      -- Pet yaş filtresi
      and (
        p.birth_date is null
        or (
          (
            v_prefs.min_age_years is null
            or p.birth_date
              <= current_date - (v_prefs.min_age_years * 365.25)::integer
          )
          and (
            v_prefs.max_age_years is null
            or p.birth_date
              >= current_date - (v_prefs.max_age_years * 365.25)::integer
          )
        )
      )
      -- Sahip görünürlüğü zorunluluğu — çift yönlü, tek kaynaktan.
      and (not v_me.require_visible_owner or prof.owner_visibility <> 'hidden')
      and (
        not prof.require_visible_owner
        or v_me.owner_visibility <> 'hidden'
      )
      -- Sahip katmanı filtreleri: hepsi `public` kapısından geçer.
      and (
        not v_prefs.require_owner_photo
        or (prof.avatar_url is not null and prof.owner_visibility = 'public')
      )
      and (
        not v_prefs.require_owner_social
        or (prof.owner_social_open and prof.owner_visibility = 'public')
      )
      and (
        not v_prefs.require_verified_owner
        or (
          prof.verification_status = 'approved'
          and prof.owner_visibility = 'public'
        )
      )
      and (
        p_owner_genders is null
        or (
          prof.owner_visibility = 'public'
          and prof.gender = any (p_owner_genders)
        )
      )
      and (
        p_owner_min_age is null
        or (
          prof.owner_visibility = 'public'
          and prof.birth_date is not null
          and prof.birth_date
            <= current_date - (p_owner_min_age || ' years')::interval
        )
      )
      and (
        p_owner_max_age is null
        or (
          prof.owner_visibility = 'public'
          and prof.birth_date is not null
          and prof.birth_date
            >= current_date - ((p_owner_max_age + 1) || ' years')::interval
        )
      )
      -- Mesafe: bölge içinde, önce bounding box sonra haversine. Konumu
      -- olmayan taraf bölge havuzunda kalır, mesafe etiketi almaz (`0057`).
      and (
        v_viewer.latitude is null
        or p.latitude is null
        or (
          p.latitude
            between v_viewer.latitude - v_lat_pad
            and v_viewer.latitude + v_lat_pad
          and p.longitude
            between v_viewer.longitude - v_lon_pad
            and v_viewer.longitude + v_lon_pad
          and haversine_km(
            v_viewer.latitude,
            v_viewer.longitude,
            p.latitude,
            p.longitude
          ) <= v_prefs.max_distance_km
        )
      )
  )
  select
    c.id,
    c.owner_id,
    c.name,
    c.species,
    c.breed,
    c.birth_date,
    c.gender,
    c.is_neutered,
    c.size,
    c.energy_level,
    c.temperaments,
    c.good_with_cats,
    c.good_with_dogs,
    c.good_with_kids,
    c.goals,
    c.bio,
    c.city,
    coalesce(
      (
        select array_agg(ph.storage_path order by ph.position)
        from pet_photos ph
        where ph.pet_id = c.id
      ),
      '{}'
    ),
    distance_bucket(c.km),
    activity_bucket(c.last_active_at),
    (c.owner_visibility = 'public'),
    case when c.owner_visibility = 'public' then c.prof_display_name end,
    case when c.owner_visibility = 'public' then c.avatar_url end,
    case when c.owner_visibility = 'public' then c.prof_bio end,
    case
      when c.owner_visibility = 'public'
       and v_me.owner_visibility = 'public'
       and v_me.gender is not null
      then c.prof_gender
    end,
    case
      when c.owner_visibility = 'public'
       and v_me.owner_visibility = 'public'
       and v_me.birth_date is not null
       and c.prof_birth_date is not null
      then owner_age_bucket(c.prof_birth_date)
    end,
    case when c.owner_visibility = 'public' then c.prof_social_open else false end,
    case
      when c.owner_visibility = 'public'
      then c.prof_verification_status = 'approved'
      else false
    end,
    case when c.owner_visibility = 'public' then c.prof_interests else '{}'::text[] end
  from candidates c
  order by c.km asc nulls last
  limit least(coalesce(p_limit, 50), 100);
end;
$$;

revoke all on function discover_playdate_pets(uuid, text[], integer, integer, integer)
  from public, anon, authenticated;
grant execute on function discover_playdate_pets(uuid, text[], integer, integer, integer)
  to authenticated;

-- Ham katman artık yok: tek çağıranı yukarıdaki fonksiyondu ve içeriği
-- oraya taşındı. Bırakılsaydı iki ayrı eleme kuralı yaşamaya devam eder,
-- er geç biri güncellenip diğeri unutulurdu.
drop function if exists discover_pets(uuid, text[], integer, integer, integer);
