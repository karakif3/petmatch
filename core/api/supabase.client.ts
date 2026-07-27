/**
 * Expo/React Native bağlaması. Web app'i eklendiğinde aynı fabrika
 * `localStorage` + `detectSessionInUrl: true` ile çağrılır — domain kodu değişmez.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../types/database";
import { createSupabaseClient } from "./client-factory";
import { getSupabaseConfig } from "./config";

let cachedClient: SupabaseClient<Database> | null | undefined;

/** Env eksikse `null` döner — çağıran taraf bunu ele almalı. */
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (cachedClient !== undefined) return cachedClient;

  const config = getSupabaseConfig();
  if (!config) {
    cachedClient = null;
    return null;
  }

  cachedClient = createSupabaseClient({
    config,
    storage: AsyncStorage,
    // expo-router web build'inde de OAuth dönüşü URL'den okunmalı.
    detectSessionInUrl: Platform.OS === "web",
  });

  return cachedClient;
}

export function requireSupabaseClient(): SupabaseClient<Database> {
  const client = getSupabaseClient();
  if (!client) {
    throw new Error(
      "Supabase yapılandırılmamış. .env dosyasına EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY ekle.",
    );
  }
  return client;
}
