-- Push izni hunisi ve bildirime dokunma ölçümü.
--
-- 2026-10-24 incelemesi: izin tipik kullanıcıdan hiç istenmiyordu ve
-- bunun fark edilmesi aylar sürdü, çünkü ne izin sonucu ne de bildirime
-- dokunup gelen oturum ölçülüyordu. İki olay ekleniyor:
--   push_permission_result {status, source}  — ön ekran sonucu
--   notification_opened    {type}            — push'tan açılan oturum
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
    'notification_opened'
  )
);
