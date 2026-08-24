import type { RealtimeChannel } from "@supabase/supabase-js";

import { requireSupabaseClient } from "./supabase.client";
import { trackProductEvent } from "./observability";

export type MeetupStatus = "proposed" | "accepted" | "declined" | "cancelled";

export type ConversationMeetup = {
  id: string;
  placeId: string;
  placeName: string;
  placeNote: string | null;
  verificationMethod: "official_source" | "field" | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceCheckedAt: string | null;
  amenities: string[];
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
    verificationMethod: row.verification_method as ConversationMeetup["verificationMethod"],
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    sourceCheckedAt: row.source_checked_at,
    amenities: row.amenities ?? [],
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

/**
 * Sohbetteki buluşma satırı değiştiğinde (öneri/onay/ret/iptal) haber verir.
 * `messages` için `subscribeToConversation`'daki desenin aynısı — 0045'te
 * `meetups` de `supabase_realtime` publication'ına eklendi.
 */
export function subscribeToMeetup(
  conversationId: string,
  onChange: () => void,
): () => void {
  const sb = requireSupabaseClient();
  const channel: RealtimeChannel = sb
    .channel(`conversation:${conversationId}:meetup`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "meetups",
        filter: `conversation_id=eq.${conversationId}`,
      },
      onChange,
    )
    .subscribe();

  return () => {
    void sb.removeChannel(channel);
  };
}
