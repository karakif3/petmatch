import Constants from "expo-constants";

import { getSupabaseClient } from "./supabase.client";

export type ProductEventName =
  | "onboarding_completed"
  | "discovery_viewed"
  | "swipe_like"
  | "swipe_pass"
  | "match_created"
  | "message_sent"
  | "report_submitted"
  | "verification_submitted"
  // Ürünün asıl başarı metriği: kaç konuşma gerçek buluşmaya döndü.
  // Uygulamada geçen süre değil bu ölçülüyor (bkz. docs/benchmark.md).
  | "meetup_feedback"
  | "discovery_segment_changed"
  | "adoption_surface_viewed"
  | "adoption_interest_sent"
  | "account_delete_requested";

export async function trackProductEvent(
  eventName: ProductEventName,
  properties: Record<string, string | number | boolean | null> = {},
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const { error } = await sb.rpc("track_product_event", {
    p_event_name: eventName,
    p_properties: properties,
  });
  if (error) console.warn("Ürün olayı kaydedilemedi:", error.message);
}

export async function captureClientError(
  error: unknown,
  route?: string,
): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const normalized = error instanceof Error ? error : new Error(String(error));
  const { error: captureError } = await sb.rpc("capture_client_error", {
    p_error_name: normalized.name || "Error",
    p_message: normalized.message.slice(0, 1000),
    p_stack: normalized.stack?.slice(0, 4000),
    p_route: route,
    p_app_version: Constants.expoConfig?.version ?? undefined,
  });
  if (captureError) console.warn("İstemci hatası kaydedilemedi:", captureError.message);
}
