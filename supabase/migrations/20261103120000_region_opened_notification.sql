-- "Bölgem açıldığında haber ver" vaadi.
--
-- 0053 tercihi kaydediyordu ama hiçbir kod bildirimi göndermiyordu
-- (2026-10-24 incelemesi): pilot dışı her kayıt kayıp kullanıcıydı.
--
-- Akış: bölge migration'la pilot'a çekilir (bugünkü gibi) → moderatör
-- Operasyon merkezinde "Haber ver"e basar → Edge Function
-- (`send-notification`, `region_opened`) alıcıları BU RPC'den alır ve
-- her birine push atar. Tekilleştirme `notification_deliveries`'in
-- (event_type, event_id, recipient_id) anahtarıyla: event_id bölgenin
-- `opened_event_id`'si — bir bölge için her kullanıcıya en fazla bir kez.
--
-- Alıcı eşlemesi: talep serbest metin ("Beşiktaş", "besiktas",
-- "Beşiktaş/İstanbul"); Türkçe harfleri katlayıp bölge adı YA DA şehri
-- geçenler alınır. Şehir eşleşmesi bilerek geniş: "İstanbul" yazan biri
-- için Beşiktaş'ın açılması haber değeri taşır.

alter table regions
  add column opened_event_id uuid not null default gen_random_uuid();

comment on column regions.opened_event_id is
  'region_opened bildiriminin notification_deliveries.event_id anahtarı; bölge başına sabit.';

alter table notification_deliveries
  drop constraint notification_deliveries_event_type_check;
alter table notification_deliveries
  add constraint notification_deliveries_event_type_check
  check (event_type in (
    'match', 'message', 'new_candidate', 'super_like', 'verification', 'region_opened'
  ));

/**
 * Türkçe harfleri katlayıp küçültür: "Beşiktaş " → "besiktas".
 * Büyük harfler lower()'dan ÖNCE katlanır: lower('İ') birçok locale'de
 * "i + birleşik nokta" üretiyor, C locale'de ise ASCII dışını hiç
 * küçültmüyor — ikisi de eşlemeyi bozar.
 */
create function normalize_location(p_text text)
returns text
language sql
immutable
strict
as $$
  select lower(translate(trim(p_text), 'ÇĞİIÖŞÜÂÎÛçğıöşüâîû', 'CGIIOSUAIUcgiosuaiu'));
$$;

revoke all on function normalize_location(text) from public, anon;
grant execute on function normalize_location(text) to authenticated;

create function region_opening_recipients(p_region_slug text)
returns table (
  user_id uuid,
  requested_location text,
  already_notified boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_region regions%rowtype;
begin
  if not is_moderator() then
    raise exception 'moderator role required' using errcode = '42501';
  end if;

  select * into v_region from regions r where r.slug = p_region_slug;
  if not found or not v_region.is_pilot or not v_region.is_active then
    raise exception 'region % is not an open pilot', p_region_slug using errcode = '22023';
  end if;

  return query
  select
    rw.user_id,
    rw.requested_location,
    exists (
      select 1 from notification_deliveries nd
      where nd.event_type = 'region_opened'
        and nd.event_id = v_region.opened_event_id
        and nd.recipient_id = rw.user_id
    )
  from region_waitlist rw
  where rw.notify_when_open
    and (
      normalize_location(rw.requested_location) like '%' || normalize_location(v_region.name) || '%'
      or (
        v_region.city is not null
        and normalize_location(rw.requested_location) like '%' || normalize_location(v_region.city) || '%'
      )
    )
  order by rw.updated_at;
end;
$$;

revoke all on function region_opening_recipients(text) from public, anon;
grant execute on function region_opening_recipients(text) to authenticated;
