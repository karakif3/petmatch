-- Pet kimliği değişimi (`0063`).
--
-- Üç iddia grubu:
--   1. Tür/cinsiyet artık değiştirilebiliyor ve değişim KAYDEDİLİYOR.
--   2. Sohbet notu yalnızca değişim konuşmadan SONRA olduysa çıkıyor.
--   3. "Desteyi sıfırla" yalnızca kendi "geç" kayıtlarını siliyor —
--      eşleşmelere ve başkasının kararına dokunmuyor.

begin;

\echo '  pets: kimlik değişimi ve sohbet notu'

select tests.seed_user('11111111-1111-1111-1111-111111111111');
select tests.seed_user('22222222-2222-2222-2222-222222222222');
select tests.assign_region('11111111-1111-1111-1111-111111111111', 'kadikoy');
select tests.assign_region('22222222-2222-2222-2222-222222222222', 'kadikoy');
select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luna');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Maya');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

-- Yalnızca ırk değişiyor: kimlik notu TETİKLENMEMELİ.
select update_my_pet_profile(
  p_pet_id => 'aaaa1111-0000-0000-0000-000000000001',
  p_name => 'Luna', p_species => 'dog', p_gender => 'male',
  p_breed => 'Golden', p_birth_date => null, p_size => 'medium',
  p_energy_level => 3::smallint, p_is_neutered => true,
  p_temperaments => '{playful}', p_good_with_cats => null,
  p_good_with_dogs => null, p_good_with_kids => null, p_bio => null
);

select tests.assert(
  (select identity_changed_at from pets where id = 'aaaa1111-0000-0000-0000-000000000001') is null,
  'yalnızca ırk değişince kimlik notu tetiklenmiyor'
);

-- 0067: tür kotası taze pette kilitler. Sohbet-notu iddiası için 6 ayı
-- geçmiş gibi damgala (yalnızca postgres; trigger authenticated'ı bağlar).
reset role;
select set_config('request.jwt.claim.sub', '', true);
update pets
set species_gender_changed_at = now() - interval '6 months 1 day'
where id = 'aaaa1111-0000-0000-0000-000000000001';
set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

-- Tür ve ad değişiyor.
select update_my_pet_profile(
  p_pet_id => 'aaaa1111-0000-0000-0000-000000000001',
  p_name => 'Kömür', p_species => 'cat', p_gender => 'male',
  p_breed => null, p_birth_date => null, p_size => 'small',
  p_energy_level => 3::smallint, p_is_neutered => true,
  p_temperaments => '{}', p_good_with_cats => null,
  p_good_with_dogs => null, p_good_with_kids => null, p_bio => null
);

select tests.assert(
  (select species from pets where id = 'aaaa1111-0000-0000-0000-000000000001') = 'cat',
  'tür değiştirilebiliyor — köpekten kediye'
);

select tests.assert(
  (select identity_changed_at from pets where id = 'aaaa1111-0000-0000-0000-000000000001') is not null,
  'kimlik değişimi kaydedildi'
);

select tests.assert(
  (select previous_name from pets where id = 'aaaa1111-0000-0000-0000-000000000001') = 'Luna',
  'önceki ad saklandı'
);

reset role;

-- ---------------------------------------------------------------------------
-- Sohbet notu: değişim konuşmadan SONRA olduysa görünür
-- ---------------------------------------------------------------------------

select tests.seed_match('aaaa1111-0000-0000-0000-000000000001',
                        'bbbb2222-0000-0000-0000-000000000002');

-- Aynı transaction içinde now() sabit olduğu için damgalar elle ayrılıyor:
-- önce konuşma DEĞİŞİMDEN SONRA açılmış gibi yapılıyor.
update conversations set created_at = now() + interval '1 hour';

set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');

select tests.assert(
  not (select pet_identity_changed from list_my_conversations() limit 1),
  'değişim konuşmadan ÖNCEyse not çıkmıyor — karşı taraf zaten yeni kimlikle tanıştı'
);

reset role;
update conversations set created_at = now() - interval '1 hour';
set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');

select tests.assert(
  (select pet_identity_changed from list_my_conversations() limit 1),
  'değişim konuşmadan SONRAysa not çıkıyor'
);

select tests.assert(
  (select pet_previous_name from list_my_conversations() limit 1) = 'Luna',
  'notta önceki ad görünüyor'
);

reset role;

-- ---------------------------------------------------------------------------
-- Desteyi sıfırla: yalnızca kendi "geç" kayıtları
-- ---------------------------------------------------------------------------

select tests.seed_user('33333333-3333-3333-3333-333333333333');
select tests.assign_region('33333333-3333-3333-3333-333333333333', 'kadikoy');
select tests.seed_pet('cccc3333-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333333', 'Geçilen');

insert into swipes (from_pet_id, to_pet_id, actor_id, direction)
values
  -- kendi geçtiğim: silinmeli
  ('aaaa1111-0000-0000-0000-000000000001', 'cccc3333-0000-0000-0000-000000000003',
   '11111111-1111-1111-1111-111111111111', 'pass'),
  -- bana verilmiş geçme: BAŞKASININ kararı, dokunulmamalı
  ('cccc3333-0000-0000-0000-000000000003', 'aaaa1111-0000-0000-0000-000000000001',
   '33333333-3333-3333-3333-333333333333', 'pass');

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select reset_my_pet_passes('aaaa1111-0000-0000-0000-000000000001') as deleted \gset

select tests.assert(:deleted = 1, 'yalnızca bir kayıt silindi');

select tests.assert(
  not exists (
    select 1 from swipes
    where from_pet_id = 'aaaa1111-0000-0000-0000-000000000001' and direction = 'pass'
  ),
  'kendi geçme kayıtlarım silindi'
);

select tests.assert(
  exists (select 1 from matches where is_active),
  'eşleşme sıfırlamadan etkilenmedi'
);

-- Bu iddia SUPERUSER olarak kontrol ediliyor: `swipes_select_own` yalnızca
-- kendi kayıtlarını gösterdiği için `authenticated` rolüyle sorgulamak
-- "silinmiş" ile "görünmüyor"u ayırt edemezdi.
reset role;
select tests.assert(
  exists (
    select 1 from swipes
    where from_pet_id = 'cccc3333-0000-0000-0000-000000000003' and direction = 'pass'
  ),
  'bana verilmiş geçme kaydı DURUYOR — başkasının açık kararı'
);
set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert_raises(
  $$select reset_my_pet_passes('cccc3333-0000-0000-0000-000000000003')$$,
  'başkasının petinin destesi sıfırlanamıyor'
);

reset role;

rollback;
