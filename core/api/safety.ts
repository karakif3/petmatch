import type { Database } from "../../types/database";
import { requireSupabaseClient } from "./supabase.client";
import { trackProductEvent } from "./observability";

export type ReportReason = Database["public"]["Enums"]["report_reason"];

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: "spam", label: "Spam" },
  { value: "harassment", label: "Taciz veya zorbalık" },
  { value: "fake_profile", label: "Sahte profil" },
  { value: "animal_welfare", label: "Hayvan güvenliği endişesi" },
  { value: "commercial_sale", label: "Ticari satış" },
  { value: "other", label: "Diğer" },
];

export async function reportContent(input: {
  reason: ReportReason;
  subjectUserId?: string | null;
  subjectPetId?: string | null;
  note?: string;
}): Promise<string> {
  const note = input.note?.trim() || undefined;
  if (note && note.length > 1000) {
    throw new Error("Açıklama en fazla 1000 karakter olabilir.");
  }
  const { data, error } = await requireSupabaseClient().rpc("report_content", {
    p_reason: input.reason,
    p_subject_user_id: input.subjectUserId ?? undefined,
    p_subject_pet_id: input.subjectPetId ?? undefined,
    p_note: note,
  });
  if (error) throw error;
  void trackProductEvent("report_submitted", { reason: input.reason });
  return data;
}

export async function blockUser(userId: string): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("block_user", {
    p_blocked_id: userId,
  });
  if (error) throw error;
}

export async function unmatchConversation(conversationId: string): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("unmatch_conversation", {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

export async function deleteAccount(): Promise<void> {
  await trackProductEvent("account_delete_requested");
  const { error } = await requireSupabaseClient().functions.invoke("delete-account", {
    body: {},
  });
  if (error) throw error;
}
