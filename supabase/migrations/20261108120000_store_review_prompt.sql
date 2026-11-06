-- Mağaza puanı istemi (backlog: "Mağaza puanı istemi").
--
-- store_review_requested: "Buluştunuz mu?" → "Buluştuk" cevabından sonra
-- sistem puan penceresi İSTENDİ (gösterilip gösterilmediğini sistem
-- söylemiyor; iOS yılda 3 ile sınırlıyor).
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
    'empty_deck_seen',
    'swipe_undone',
    'invite_shared',
    'store_review_requested'
  )
);
