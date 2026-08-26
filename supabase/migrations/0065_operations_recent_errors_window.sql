-- `client_error_samples`, sayaçla ("İstemci hatası · 24s") aynı pencereyi
-- konuşmuyordu: sayaç son 24 saati sayarken liste zaman sınırı olmadan son
-- 10 kaydı çekiyordu. Sonuç: sayaç "0" derken panel günler öncesinden kalma,
-- çoktan koda düzeltilmiş hataları hâlâ gösteriyordu — moderatör aktif bir
-- sorun var sanabilirdi.

create or replace function get_operations_metrics()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not is_moderator() then
    raise exception 'moderator role required' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'moderation_pending', (
      select count(*) from moderation_items where status = 'pending'
    ),
    'moderation_sla_breached', (
      select count(*) from moderation_items
      where status = 'pending' and created_at < now() - interval '24 hours'
    ),
    'notification_failed_24h', (
      select count(*) from notification_deliveries
      where status = 'failed' and attempted_at >= now() - interval '24 hours'
    ),
    'client_errors_24h', (
      select count(*) from client_errors
      where created_at >= now() - interval '24 hours'
    ),
    'funnel_7d', (
      select coalesce(jsonb_object_agg(event_name, total), '{}')
      from (
        select event_name, count(*) total
        from product_events
        where created_at >= now() - interval '7 days'
        group by event_name
      ) events
    ),
    'notification_failures', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'event_type', failures.event_type,
        'message', failures.last_error,
        'created_at', failures.attempted_at
      )), '[]')
      from (
        select event_type, last_error, attempted_at
        from notification_deliveries
        where status = 'failed' and attempted_at >= now() - interval '24 hours'
        order by attempted_at desc
        limit 10
      ) failures
    ),
    'client_error_samples', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'name', samples.error_name,
        'message', samples.message,
        'route', samples.route,
        'created_at', samples.created_at
      )), '[]')
      from (
        select error_name, message, route, created_at
        from client_errors
        where created_at >= now() - interval '24 hours'
        order by created_at desc
        limit 10
      ) samples
    )
  ) into v_result;
  return v_result;
end;
$$;

revoke all on function get_operations_metrics()
  from public, anon, authenticated;
grant execute on function get_operations_metrics() to authenticated;
