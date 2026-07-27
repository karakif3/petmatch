-- Tam keşfet filtresi yazma yolu ve boş deste bildirim tercihi.

alter table discovery_preferences
  add column notify_on_new_candidates boolean not null default false;

create or replace function update_my_discovery_filters(
  p_species species[],
  p_max_distance_km integer,
  p_min_age_years numeric,
  p_max_age_years numeric,
  p_require_visible_owner boolean,
  p_require_owner_photo boolean,
  p_require_owner_social boolean,
  p_require_verified_owner boolean,
  p_notify_on_new_candidates boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_species species[] := coalesce(p_species, '{}');
  v_profile profiles%rowtype;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  if cardinality(v_species) = 0
     or cardinality(v_species) <> (
       select count(distinct item) from unnest(v_species) item
     ) then
    raise exception 'at least one unique species is required'
      using errcode = '22023';
  end if;
  if p_max_distance_km not between 1 and 500 then
    raise exception 'distance must be between 1 and 500 km'
      using errcode = '22023';
  end if;
  if p_min_age_years is not null
     and (p_min_age_years < 0 or p_min_age_years > 40) then
    raise exception 'invalid minimum pet age' using errcode = '22023';
  end if;
  if p_max_age_years is not null
     and (p_max_age_years < 0 or p_max_age_years > 40) then
    raise exception 'invalid maximum pet age' using errcode = '22023';
  end if;
  if p_min_age_years is not null and p_max_age_years is not null
     and p_min_age_years > p_max_age_years then
    raise exception 'minimum pet age cannot exceed maximum'
      using errcode = '22023';
  end if;

  select p.* into v_profile from profiles p where p.id = auth.uid();
  if p_require_owner_social and not v_profile.owner_social_open then
    raise exception 'owner social filter requires social mode'
      using errcode = '23514';
  end if;

  update discovery_preferences
  set
    species = v_species,
    max_distance_km = p_max_distance_km,
    min_age_years = p_min_age_years,
    max_age_years = p_max_age_years,
    require_owner_photo = coalesce(p_require_owner_photo, false),
    require_owner_social = coalesce(p_require_owner_social, false),
    require_verified_owner = coalesce(p_require_verified_owner, false),
    notify_on_new_candidates = coalesce(p_notify_on_new_candidates, false),
    updated_at = now()
  where user_id = auth.uid();

  update profiles
  set require_visible_owner = coalesce(p_require_visible_owner, false)
  where id = auth.uid();
end;
$$;

revoke all on function update_my_discovery_filters(
  species[], integer, numeric, numeric, boolean, boolean, boolean, boolean, boolean
) from public, anon, authenticated;
grant execute on function update_my_discovery_filters(
  species[], integer, numeric, numeric, boolean, boolean, boolean, boolean, boolean
) to authenticated;
