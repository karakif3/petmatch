-- Tür/cinsiyet 6 ay kotası (`0067`).
--
-- Ad serbest kalır. Tür değişimi taze pette reddedilir; damga 6 aydan eskiyse
-- kabul edilir. İstemci damgayı geriye çekerek kotayı aşamaz.

begin;

\echo '  pets: tür/cinsiyet 6 ay kilidi'

select tests.seed_user('11111111-1111-1111-1111-111111111111');
select tests.assign_region('11111111-1111-1111-1111-111111111111', 'kadikoy');
select tests.seed_pet(
  'aaaa1111-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Luna'
);

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

-- Ad değişir, tür aynı kalır.
select update_my_pet_profile(
  p_pet_id => 'aaaa1111-0000-0000-0000-000000000001',
  p_name => 'Lunaş', p_species => 'dog', p_gender => 'male',
  p_breed => null, p_birth_date => null, p_size => 'medium',
  p_energy_level => 3::smallint, p_is_neutered => true,
  p_temperaments => '{}', p_good_with_cats => null,
  p_good_with_dogs => null, p_good_with_kids => null, p_bio => null
);

select tests.assert(
  (select name from pets where id = 'aaaa1111-0000-0000-0000-000000000001') = 'Lunaş',
  'ad kota dışında — taze pette de değişir'
);

select tests.assert_raises(
  $$select update_my_pet_profile(
    p_pet_id => 'aaaa1111-0000-0000-0000-000000000001',
    p_name => 'Lunaş', p_species => 'cat', p_gender => 'male',
    p_breed => null, p_birth_date => null, p_size => 'medium',
    p_energy_level => 3::smallint, p_is_neutered => true,
    p_temperaments => '{}', p_good_with_cats => null,
    p_good_with_dogs => null, p_good_with_kids => null, p_bio => null
  )$$,
  'taze pette tür değişimi reddedilir'
);

-- İstemci damgayı geriye alamasın.
update pets
set species_gender_changed_at = now() - interval '1 year'
where id = 'aaaa1111-0000-0000-0000-000000000001';

select tests.assert(
  (select species_gender_changed_at from pets
   where id = 'aaaa1111-0000-0000-0000-000000000001') > now() - interval '1 hour',
  'authenticated damgayı geriye çekemez'
);

reset role;
select set_config('request.jwt.claim.sub', '', true);

update pets
set species_gender_changed_at = now() - interval '6 months 1 day'
where id = 'aaaa1111-0000-0000-0000-000000000001';

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select update_my_pet_profile(
  p_pet_id => 'aaaa1111-0000-0000-0000-000000000001',
  p_name => 'Lunaş', p_species => 'cat', p_gender => 'female',
  p_breed => null, p_birth_date => null, p_size => 'small',
  p_energy_level => 3::smallint, p_is_neutered => true,
  p_temperaments => '{}', p_good_with_cats => null,
  p_good_with_dogs => null, p_good_with_kids => null, p_bio => null
);

select tests.assert(
  (select species from pets where id = 'aaaa1111-0000-0000-0000-000000000001') = 'cat',
  '6 ay dolunca tür değişir'
);

select tests.assert(
  (select gender from pets where id = 'aaaa1111-0000-0000-0000-000000000001') = 'female',
  '6 ay dolunca cinsiyet değişir'
);

select tests.assert_raises(
  $$select update_my_pet_profile(
    p_pet_id => 'aaaa1111-0000-0000-0000-000000000001',
    p_name => 'Lunaş', p_species => 'dog', p_gender => 'female',
    p_breed => null, p_birth_date => null, p_size => 'medium',
    p_energy_level => 3::smallint, p_is_neutered => true,
    p_temperaments => '{}', p_good_with_cats => null,
    p_good_with_dogs => null, p_good_with_kids => null, p_bio => null
  )$$,
  'ikinci tür değişimi 6 ay dolmadan reddedilir'
);

reset role;
rollback;
