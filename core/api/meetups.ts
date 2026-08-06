import { requireSupabaseClient } from "./supabase.client";
import { trackProductEvent } from "./observability";

export type MeetupStatus = "proposed" | "accepted" | "declined" | "cancelled";

export type ConversationMeetup = {
  id: string;
  placeId: string;
  placeName: string;
  placeNote: string | null;
  scheduledAt: string;
  status: MeetupStatus;
  /** Öneriyi ben mi yaptım — yanıt düğmelerini kime göstereceğimizi belirler. */
  mine: boolean;
};

/**
 * Sohbetin canlı buluşması (öneri ya da onaylanmış). Yoksa null.
 *
 * Yazma yollarının hepsi `SECURITY DEFINER` RPC; istemci `meetups` tablosuna
 * hiç yazmıyor. Kurallar (yalnızca doğrulanmış yer, yanıtı karşı taraf verir,
 * sohbette tek canlı buluşma) 0043'te ve `supabase/tests/meetups.test.sql`
 * içinde kilitli.
 */
export async function loadConversationMeetup(
  conversationId: string,
): Promise<ConversationMeetup | null> {
  const { data, error } = await requireSupabaseClient().rpc("conversation_meetup", {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return {
    id: row.id,
    placeId: row.place_id,
    placeName: row.place_name,
    placeNote: row.place_note,
    scheduledAt: row.scheduled_at,
    status: row.status as MeetupStatus,
    mine: row.mine,
  };
}

export async function proposeMeetup(input: {
  conversationId: string;
  placeId: string;
  scheduledAt: Date;
}): Promise<string> {
  const { data, error } = await requireSupabaseClient().rpc("propose_meetup", {
    p_conversation_id: input.conversationId,
    p_place_id: input.placeId,
    p_scheduled_at: input.scheduledAt.toISOString(),
  });
  if (error) throw error;
  void trackProductEvent("meetup_proposed");
  return data as string;
}

export async function respondToMeetup(
  meetupId: string,
  accept: boolean,
): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("respond_to_meetup", {
    p_meetup_id: meetupId,
    p_accept: accept,
  });
  if (error) throw error;
  void trackProductEvent(accept ? "meetup_accepted" : "meetup_declined");
}

export async function cancelMeetup(meetupId: string): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("cancel_meetup", {
    p_meetup_id: meetupId,
  });
  if (error) throw error;
  void trackProductEvent("meetup_cancelled");
}
