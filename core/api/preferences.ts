import { getAppLocale } from "../i18n";
import { getSupabaseClient } from "./supabase.client";

/** Keep server-originated notifications aligned with the app's released locale. */
export async function syncLanguagePreference(): Promise<void> {
  const sb = getSupabaseClient();
  if (!sb) return;
  const { error } = await sb.rpc("update_my_language", {
    p_language: getAppLocale(),
  });
  if (error) throw error;
}
