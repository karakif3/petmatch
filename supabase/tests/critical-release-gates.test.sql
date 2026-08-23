-- Sahip fotoğrafı karşılıklılığı ve doğrulama karar/itiraz zinciri.

begin;

select tests.seed_user('11111111-1111-1111-1111-111111111111');
select tests.seed_user('22222222-2222-2222-2222-222222222222');
select tests.seed_pet(
  'aaaa1111-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111'
);

update profiles
set avatar_url = null, owner_visibility = 'hidden'
where id = '11111111-1111-1111-1111-111111111111';

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');

select tests.assert_raises(
  'select update_owner_discovery_filters(true, false, false)',
  'kendi açık fotoğrafı olmayan kullanıcı fotoğraf filtresini açamıyor'
);

reset role;
update profiles
set
  avatar_url = '11111111-1111-1111-1111-111111111111/avatar.jpg',
  owner_visibility = 'public'
where id = '11111111-1111-1111-1111-111111111111';

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select update_owner_discovery_filters(true, false, false);
select tests.assert(
  (select require_owner_photo from discovery_preferences
   where user_id = '11111111-1111-1111-1111-111111111111'),
  'açık sahip fotoğrafı bulunan kullanıcı filtreyi açabiliyor'
);

update profiles set owner_visibility = 'hidden'
where id = '11111111-1111-1111-1111-111111111111';
select tests.assert(
  not (select require_owner_photo from discovery_preferences
       where user_id = '11111111-1111-1111-1111-111111111111'),
  'profil gizlenince fotoğraf filtresi otomatik kapanıyor'
);

reset role;
insert into storage.objects (bucket_id, name, owner)
values (
  'verification-photos',
  '11111111-1111-1111-1111-111111111111/aaaa1111-0000-0000-0000-000000000001/proof.jpg',
  '11111111-1111-1111-1111-111111111111'
);

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select submit_verification(
  'aaaa1111-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111/aaaa1111-0000-0000-0000-000000000001/proof.jpg'
) as verification_id \gset
reset role;

insert into app_user_roles (user_id, role)
values ('22222222-2222-2222-2222-222222222222', 'moderator');

set local role authenticated;
select tests.act_as('22222222-2222-2222-2222-222222222222');
select review_moderation_item(
  :'verification_id',
  'rejected',
  'Pet fotoğrafta yeterince net görünmüyor.',
  'pet_not_visible'
);
reset role;

select tests.assert(
  (select rejection_reason_code = 'pet_not_visible'
   from moderation_items where id = :'verification_id'),
  'yapılandırılmış ret nedeni kararla saklanıyor'
);

set local role authenticated;
select tests.act_as('11111111-1111-1111-1111-111111111111');
select submit_verification_appeal(
  :'verification_id',
  'Petim karede görünüyor; kararın yeniden incelenmesini rica ediyorum.'
);

select tests.assert(
  (select appealed_at is not null and appeal_text is not null
   from moderation_items where id = :'verification_id'),
  'kullanıcı ret kararına bir kez itiraz edebiliyor'
);

select tests.assert_raises(
  format(
    'select submit_verification_appeal(%L, %L)',
    :'verification_id',
    'Aynı karara ikinci bir itiraz gönderilemez.'
  ),
  'aynı karara ikinci itiraz reddediliyor'
);

reset role;
rollback;
