-- Huni analitiği (backlog: "Huni analitiği kayıt tarafında kör").
--
-- İki parça:
--
-- 1) Uygulama içi yeni olaylar. `track_product_event` oturum istiyor; bu
--    yüzden kayıt ÖNCESİ adımlar (kayıt formu, e-posta onayı) istemciden
--    ölçülemez — onlar aşağıdaki kohort hunisinde auth.users'tan geliyor.
--      onboarding_step_completed {step}        — 1..3 (4. adım = onboarding_completed)
--      waitlist_joined           {notify}      — pilot dışı bölge talebi
--      app_opened                {}            — oturum (30 dk aralıkla)
--      message_sent              {is_first, is_reply}  — artık özellikli
--      user_blocked              {source}
--      match_unmatched           {}
--      filter_applied            {active_count}
--      empty_deck_seen           {}
--
-- 2) `get_signup_funnel(p_days)`: son N günde kaydolanların kohort hunisi,
--    olaylardan değil TABLOLARDAN. Olaylar sürüm/ağ kaybıyla eksik
--    kalabilir; tablolar gerçeğin kaynağı. Yoğunluk ve P0-6 kararları
--    (docs/launch.md) bu sayılarla veriliyor.

alter table product_events drop constraint product_events_event_name_check;
alter table product_events add constraint product_events_event_name_check check (
  event_name in (
    'onboarding_completed',
    'discovery_viewed',
    'swipe_like',
    'swipe_pass',
    'swipe_super_like',
    'match_created',
    'match_celebration_viewed',
    'match_chat_opened',
    'match_celebration_dismissed',
    'match_conversation_failed',
    'message_sent',
    'report_submitted',
    'verification_submitted',
    'meetup_proposed',
    'meetup_accepted',
    'meetup_declined',
    'meetup_cancelled',
    'meetup_feedback',
    'discovery_segment_changed',
    'adoption_surface_viewed',
    'adoption_interest_sent',
    'account_delete_requested',
    'push_permission_result',
    'notification_opened',
    'onboarding_step_completed',
    'waitlist_joined',
    'app_opened',
    'user_blocked',
    'match_unmatched',
    'filter_applied',
    'empty_deck_seen'
  )
);

create function get_signup_funnel(p_days integer default 30)
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
  if p_days is null or p_days < 1 or p_days > 365 then
    raise exception 'p_days must be between 1 and 365' using errcode = '22023';
  end if;

  -- `confirmed_at` (= e-posta/telefon onayının ilki): canlıda üretilmiş
  -- kolon, test imajının eski auth şemasında da var; email_confirmed_at yok.
  with cohort as (
    select u.id, u.confirmed_at as email_confirmed_at
    from auth.users u
    where u.created_at >= now() - make_interval(days => p_days)
  ),
  steps as (
    select
      c.id,
      c.email_confirmed_at is not null as email_confirmed,
      p.onboarded_at is not null as onboarded,
      exists (select 1 from swipes s where s.actor_id = c.id) as swiped,
      exists (
        select 1 from matches m
        join pets pt on pt.id in (m.pet_a_id, m.pet_b_id)
        where pt.owner_id = c.id
      ) as matched,
      exists (select 1 from messages ms where ms.sender_id = c.id) as messaged,
      exists (
        select 1 from messages mine
        join messages theirs
          on theirs.conversation_id = mine.conversation_id
         and theirs.sender_id <> c.id
        where mine.sender_id = c.id
      ) as two_way,
      exists (
        select 1 from meetups mt
        where mt.conversation_id in (
          select ms.conversation_id from messages ms where ms.sender_id = c.id
        )
      ) as meetup_proposed,
      exists (
        select 1 from meetups mt
        where mt.status = 'accepted'
          and mt.conversation_id in (
            select ms.conversation_id from messages ms where ms.sender_id = c.id
          )
      ) as meetup_accepted
    from cohort c
    left join profiles p on p.id = c.id
  )
  select jsonb_build_object(
    'days', p_days,
    'steps', jsonb_build_array(
      jsonb_build_object('key', 'signed_up', 'count', count(*)),
      jsonb_build_object('key', 'email_confirmed', 'count', count(*) filter (where email_confirmed)),
      jsonb_build_object('key', 'onboarded', 'count', count(*) filter (where onboarded)),
      jsonb_build_object('key', 'swiped', 'count', count(*) filter (where swiped)),
      jsonb_build_object('key', 'matched', 'count', count(*) filter (where matched)),
      jsonb_build_object('key', 'messaged', 'count', count(*) filter (where messaged)),
      jsonb_build_object('key', 'two_way', 'count', count(*) filter (where two_way)),
      jsonb_build_object('key', 'meetup_proposed', 'count', count(*) filter (where meetup_proposed)),
      jsonb_build_object('key', 'meetup_accepted', 'count', count(*) filter (where meetup_accepted))
    )
  )
  into v_result
  from steps;

  return v_result;
end;
$$;

revoke all on function get_signup_funnel(integer) from public, anon, authenticated;
grant execute on function get_signup_funnel(integer) to authenticated;
