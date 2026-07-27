/**
 * Platformdan bağımsız Supabase client fabrikası.
 *
 * Mobil ve web arasındaki tek fark oturumun nerede saklandığı ve OAuth
 * dönüşünün URL'den mi okunacağıdır. İkisi de parametre — bu dosya
 * React Native'e de Next.js'e de bağımlı değil.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { SupabaseConfig } from "./config";
import type { Database } from "../../types/database";

/** `@supabase/supabase-js`'in beklediği minimal storage arayüzü. */
export type SessionStorage = {
  getItem: (key: string) => Promise<string | null> | string | null;
  setItem: (key: string, value: string) => Promise<void> | void;
  removeItem: (key: string) => Promise<void> | void;
};

export type ClientOptions = {
  config: SupabaseConfig;
  storage: SessionStorage;
  /** Web'de OAuth dönüşü URL fragment'ından okunur; mobilde deep link ile gelir. */
  detectSessionInUrl: boolean;
};

export function createSupabaseClient({
  config,
  storage,
  detectSessionInUrl,
}: ClientOptions): SupabaseClient<Database> {
  return createClient<Database>(config.url, config.anonKey, {
    auth: {
      storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl,
    },
  });
}
