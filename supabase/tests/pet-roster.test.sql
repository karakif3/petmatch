-- Petlerim (`0062`): ikinci pet ekleme ve aktif peti değiştirme.
--
-- En kritik iddia sondaki: kullanıcı hiçbir adımda "aktif peti olmayan"
-- duruma düşmemeli. Keşfet, swipe ve profil tamamlama o duruma dayanamaz.

begin;

\echo '  pets: ikinci pet ve aktif pet değişimi'

select tests.seed_user('11111111-1111-1111-1111-111111111111');
select tests.assign_region('11111111-1111-1111-1111-111111111111', 'kadikoy');
select tests.seed_pet('aaaa1111-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Luna');

insert into pet_photos (pet_id, storage_path, position)
values ('aaaa1111-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111/aaaa1111-0000-0000-0000-000000000001/1.jpg', 0);

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select create_my_pet('Kömür', 'cat', 'male') as new_pet \gset

select tests.assert(
  (select count(*) from pets where owner_id = '11111111-1111-1111-1111-111111111111') = 2,
  'ikinci pet eklendi'
);

select tests.assert(
  not (select is_active from pets where id = :'new_pet'),
  'yeni pet PASİF doğuyor — fotoğrafsız kart desteye çıkmasın'
);

select tests.assert(
  (select is_active from pets where id = 'aaaa1111-0000-0000-0000-000000000001'),
  'mevcut aktif pet dokunulmadan kaldı'
);

-- Fotoğrafsız pet aktif edilemez.
select tests.assert_raises(
  format('select set_active_pet(%L)', :'new_pet'),
  'fotoğrafsız pet aktif edilemiyor'
);

reset role;
insert into pet_photos (pet_id, storage_path, position)
values (:'new_pet',
        '11111111-1111-1111-1111-111111111111/' || :'new_pet' || '/1.jpg', 0);
set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select set_active_pet(:'new_pet');

select tests.assert(
  (select count(*) from pets
   where owner_id = '11111111-1111-1111-1111-111111111111' and is_active) = 1,
  'değişimden sonra TAM OLARAK bir aktif pet var'
);

select tests.assert(
  (select is_active from pets where id = :'new_pet'),
  'yeni pet aktif oldu'
);

select tests.assert(
  not (select is_active from pets where id = 'aaaa1111-0000-0000-0000-000000000001'),
  'eski pet arşive düştü — SİLİNMEDİ, geçmişi duruyor'
);

-- Başkasının petini aktif edemezsin.
reset role;
select tests.seed_user('22222222-2222-2222-2222-222222222222');
select tests.seed_pet('bbbb2222-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222222', 'Yabancı');
set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert_raises(
  $$select set_active_pet('bbbb2222-0000-0000-0000-000000000002')$$,
  'başkasının peti aktif edilemiyor'
);

reset role;

rollback;
