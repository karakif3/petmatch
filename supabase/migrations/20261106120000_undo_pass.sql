-- Kaydırmayı geri al (backlog: "Kaydırmayı geri al").
--
-- Yalnız GEÇ, yalnız kendi kararı, yalnız taze: istemci düğmeyi 10 sn
-- gösteriyor; sunucu ağ gecikmesi payıyla 30 sn kabul ediyor. Beğeni geri
-- alınmaz — karşı tarafa bildirim/eşleşme doğurmuş olabilir.
--
-- Geri alma swipe satırını SİLER: kart desteye döner, karşı taraf beni
-- beğenmişse "Beğeniler"deki bekleyen kayıt da geri gelir. Hız sınırı
-- (`swipes_rate_limit`) satır saydığı için geç+geri al döngüsü bir şey
-- kazandırmaz.

create function undo_pass(p_from_pet_id uuid, p_to_pet_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  delete from swipes
  where from_pet_id = p_from_pet_id
    and to_pet_id = p_to_pet_id
    and actor_id = auth.uid()
    and direction = 'pass'
    and created_at >= now() - interval '30 seconds';

  if not found then
    raise exception 'undo_expired' using errcode = 'P0001';
  end if;
end;
$$;

revoke all on function undo_pass(uuid, uuid) from public, anon, authenticated;
grant execute on function undo_pass(uuid, uuid) to authenticated;

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
    'swipe_undone'
  )
);
