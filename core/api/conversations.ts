import type { RealtimeChannel } from "@supabase/supabase-js";

import type { Database } from "../../types/database";
import { requestNotificationDelivery } from "./notifications";
import { requireSupabaseClient } from "./supabase.client";

type ConversationRow =
  Database["public"]["Functions"]["list_my_conversations"]["Returns"][number];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export type ConversationSummary = {
  id: string;
  kind: "match" | "adoption";
  isActive: boolean;
  counterpartUserId: string | null;
  counterpartDisplayName: string | null;
  petId: string | null;
  petName: string | null;
  petPhotoUrl: string | null;
  lastMessage: string | null;
  lastMessageAt: string | null;
  unreadCount: number;
};

export type ChatMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};

function publicPhotoUrl(path: string | null): string | null {
  if (!path) return null;
  return requireSupabaseClient().storage.from("pet-photos").getPublicUrl(path).data.publicUrl;
}

function mapConversation(row: ConversationRow): ConversationSummary {
  return {
    id: row.conversation_id,
    kind: row.conversation_kind === "adoption" ? "adoption" : "match",
    isActive: row.is_active,
    counterpartUserId: row.counterpart_user_id || null,
    counterpartDisplayName: row.counterpart_display_name || null,
    petId: row.pet_id || null,
    petName: row.pet_name || null,
    petPhotoUrl: publicPhotoUrl(row.pet_photo_path || null),
    lastMessage: row.last_message || null,
    lastMessageAt: row.last_message_at || null,
    unreadCount: Number(row.unread_count ?? 0),
  };
}

function mapMessage(row: MessageRow): ChatMessage {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
    readAt: row.read_at,
  };
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const { data, error } = await requireSupabaseClient().rpc("list_my_conversations");
  if (error) throw error;
  return (data ?? []).map(mapConversation);
}

export async function loadConversation(conversationId: string): Promise<ConversationSummary> {
  const conversations = await listConversations();
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) throw new Error("Konuşma bulunamadı.");
  return conversation;
}

export async function loadMessages(conversationId: string): Promise<ChatMessage[]> {
  const { data, error } = await requireSupabaseClient()
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapMessage);
}

export async function sendMessage(input: {
  conversationId: string;
  senderId: string;
  body: string;
}): Promise<ChatMessage> {
  const body = input.body.trim();
  if (!body) throw new Error("Mesaj boş olamaz.");

  const { data, error } = await requireSupabaseClient()
    .from("messages")
    .insert({
      conversation_id: input.conversationId,
      sender_id: input.senderId,
      body,
    })
    .select()
    .single();
  if (error) throw error;
  const message = mapMessage(data);
  void requestNotificationDelivery({ type: "message", messageId: message.id }).catch(
    (notificationError) => {
      console.error("Mesaj bildirimi gönderilemedi:", notificationError);
    },
  );
  return message;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("mark_messages_read", {
    p_conversation_id: conversationId,
  });
  if (error) throw error;
}

export function subscribeToConversation(
  conversationId: string,
  onChange: () => void,
): () => void {
  const sb = requireSupabaseClient();
  const channel: RealtimeChannel = sb
    .channel(`conversation:${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`,
      },
      onChange,
    )
    .subscribe();

  return () => {
    void sb.removeChannel(channel);
  };
}
