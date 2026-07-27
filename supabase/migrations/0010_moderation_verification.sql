-- Moderasyon ve doğrulama — tek hat
--
-- "Sahibiyle doğrulanmış" rozeti ile App Store 1.2'nin zorunlu kıldığı
-- şikâyet/inceleme mekanizması AYNI altyapı. İkisini ayrı kurmak iki kez
-- iş yapmak olurdu.
--
-- created_at → reviewed_at farkı 24 saatlik SLA'nın ölçülebilir hali.

create type moderation_kind   as enum ('report', 'verification', 'photo');
create type moderation_status as enum ('pending', 'approved', 'rejected');

create table moderation_items (
  id              uuid primary key default gen_random_uuid(),
  kind            moderation_kind not null,
  status          moderation_status not null default 'pending',
  created_by      uuid references profiles (id) on delete set null,
  subject_user_id uuid references profiles (id) on delete cascade,
  subject_pet_id  uuid references pets (id) on delete cascade,
  reason          report_reason,
  payload         jsonb not null default '{}',
  note            text check (char_length(note) <= 1000),
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid,
  check (subject_user_id is not null or subject_pet_id is not null)
);

-- Kuyruk sıralaması: bekleyenler, en eski önce.
create index moderation_pending_idx on moderation_items (created_at)
  where status = 'pending';
create index moderation_created_by_idx on moderation_items (created_by);

-- reports tablosu moderation_items ile birleşti.
drop table reports;

-- ---------------------------------------------------------------------------
-- Doğrulama durumu profilde özetlenir
-- ---------------------------------------------------------------------------

alter table profiles
  add column verification_status moderation_status,
  add column verified_at timestamptz;

-- ---------------------------------------------------------------------------
-- Şikâyet
--
-- Kural: ŞİKÂYET SAYISI ASLA OTOMATİK BAN TETİKLEMEZ. Organize toplu şikâyet
-- (brigading) aksi halde silah olur; sayı yalnızca kuyruk sıralamasını etkiler.
-- ---------------------------------------------------------------------------

create or replace function report_content(
  p_reason          report_reason,
  p_subject_user_id uuid default null,
  p_subject_pet_id  uuid default null,
  p_note            text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if p_subject_user_id is null and p_subject_pet_id is null then
    raise exception 'a subject is required' using errcode = '22023';
  end if;
  if p_subject_user_id = auth.uid() then
    raise exception 'cannot report yourself' using errcode = '22023';
  end if;

  insert into moderation_items (kind, created_by, subject_user_id, subject_pet_id, reason, note)
  values ('report', auth.uid(), p_subject_user_id, p_subject_pet_id, p_reason, p_note)
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Doğrulama başvurusu — sahip + pet birlikte fotoğraf
-- ---------------------------------------------------------------------------

create or replace function submit_verification(p_pet_id uuid, p_photo_path text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not owns_pet(p_pet_id) then
    raise exception 'not your pet' using errcode = '42501';
  end if;

  insert into moderation_items (kind, created_by, subject_user_id, subject_pet_id, payload)
  values ('verification', auth.uid(), auth.uid(), p_pet_id,
          jsonb_build_object('photo_path', p_photo_path))
  returning id into v_id;

  update profiles set verification_status = 'pending' where id = auth.uid();

  return v_id;
end;
$$;

revoke all on function report_content(report_reason, uuid, uuid, text) from public;
revoke all on function submit_verification(uuid, text) from public;
grant execute on function report_content(report_reason, uuid, uuid, text) to authenticated;
grant execute on function submit_verification(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Sahiplendirme ilanı doğrulanmış hesap ister
--
-- Hayvan sahiplendirme dolandırıcılığına karşı en ucuz ve etkili sürtünme.
-- ---------------------------------------------------------------------------

create or replace function enforce_adoption_requires_verification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if 'adoption' = any (new.goals) then
    if not exists (
      select 1 from profiles
      where id = new.owner_id and verification_status = 'approved'
    ) then
      raise exception 'adoption listings require a verified owner'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

create trigger pets_adoption_requires_verification
  before insert or update of goals on pets
  for each row execute function enforce_adoption_requires_verification();

-- ---------------------------------------------------------------------------
-- RLS — kullanıcı yalnızca kendi açtığı kaydı görür
--
-- Şikâyet edilen, şikâyet edildiğini göremez. İnceleme service_role ile
-- yapılır (moderasyon arayüzü ayrı).
-- ---------------------------------------------------------------------------

alter table moderation_items enable row level security;

create policy moderation_select_own on moderation_items
  for select to authenticated
  using (created_by = (select auth.uid()));

-- INSERT yalnızca yukarıdaki RPC'ler üzerinden; doğrudan yazma politikası yok.
