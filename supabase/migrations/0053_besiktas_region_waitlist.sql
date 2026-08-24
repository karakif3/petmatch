-- Beşiktaş pilotu ve pilot dışı bölge talep kuyruğu.

insert into regions (slug, name, city, is_pilot, is_active, sort_order)
values ('besiktas', 'Beşiktaş', 'İstanbul', true, true, 3)
on conflict (slug) do update set
  name = excluded.name,
  city = excluded.city,
  is_pilot = excluded.is_pilot,
  is_active = excluded.is_active,
  sort_order = excluded.sort_order;

update regions
set name = 'Bölgem listede yok'
where slug = 'other';

create table region_waitlist (
  user_id uuid primary key references profiles (id) on delete cascade,
  requested_location text not null check (
    char_length(trim(requested_location)) between 2 and 80
  ),
  notify_when_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table region_waitlist enable row level security;

create policy region_waitlist_select_self on region_waitlist
  for select to authenticated
  using (user_id = (select auth.uid()));

revoke all on table region_waitlist from public, anon, authenticated;
grant select on table region_waitlist to authenticated;

drop function if exists set_my_region(text);

create function set_my_region(
  p_region_slug text,
  p_requested_location text default null,
  p_notify_when_open boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_location text := nullif(trim(p_requested_location), '');
begin
  if not exists (
    select 1 from regions where slug = p_region_slug and is_active
  ) then
    raise exception 'unknown region %', p_region_slug using errcode = '22023';
  end if;

  if p_region_slug = 'other' and (
    v_location is null or char_length(v_location) not between 2 and 80
  ) then
    raise exception 'requested location must be 2-80 characters' using errcode = '22023';
  end if;

  update profiles set region_slug = p_region_slug where id = auth.uid();

  if p_region_slug = 'other' then
    insert into region_waitlist (user_id, requested_location, notify_when_open)
    values (auth.uid(), v_location, coalesce(p_notify_when_open, false))
    on conflict (user_id) do update set
      requested_location = excluded.requested_location,
      notify_when_open = excluded.notify_when_open,
      updated_at = now();
  else
    delete from region_waitlist where user_id = auth.uid();
  end if;
end;
$$;

revoke all on function set_my_region(text, text, boolean) from public, anon;
grant execute on function set_my_region(text, text, boolean) to authenticated;

create function region_demand()
returns table (
  requested_location text,
  interested bigint,
  wants_notification bigint,
  latest_request_at timestamptz
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
  select
    initcap(lower(trim(rw.requested_location))),
    count(*),
    count(*) filter (where rw.notify_when_open),
    max(rw.updated_at)
  from region_waitlist rw
  group by lower(trim(rw.requested_location))
  order by count(*) desc, max(rw.updated_at) desc;
end;
$$;

revoke all on function region_demand() from public, anon, authenticated;
grant execute on function region_demand() to authenticated;
