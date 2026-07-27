-- Yeni aday bildirimleri de mevcut tekil teslimat günlüğünü kullanır.

alter table notification_deliveries
  drop constraint notification_deliveries_event_type_check;

alter table notification_deliveries
  add constraint notification_deliveries_event_type_check
  check (event_type in ('match', 'message', 'new_candidate'));
