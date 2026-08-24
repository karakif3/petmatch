-- Match kutlamasından ilk mesaja kadar olan dönüşümü ölçülebilir kıl.
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
    'account_delete_requested'
  )
);
