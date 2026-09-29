/**
 * Uygulama ön/arka plan geçişlerini Supabase Auth ve TanStack Query'ye bağlar.
 *
 * - Supabase RN için `startAutoRefresh`/`stopAutoRefresh`'i AppState'e
 *   bağlamayı öneriyor: arka planda zamanlayıcılar donuyor, uzun süre sonra
 *   öne gelen uygulamanın ilk istekleri süresi geçmiş JWT ile gidiyordu.
 * - `refetchOnWindowFocus` React Native'de kendiliğinden hiçbir şey yapmaz;
 *   `focusManager` AppState ile beslenmezse öne gelen ekran bayat kalır.
 *
 * Web'de ikisi de tarayıcının kendi olaylarıyla çalışıyor; bağlama yapılmaz.
 */
import { AppState, Platform, type AppStateStatus } from "react-native";
import { focusManager } from "@tanstack/react-query";

import { getSupabaseClient } from "./supabase.client";

export function bindAppLifecycle(): () => void {
  if (Platform.OS === "web") return () => undefined;

  const apply = (state: AppStateStatus) => {
    const active = state === "active";
    focusManager.setFocused(active);
    const auth = getSupabaseClient()?.auth;
    if (!auth) return;
    if (active) void auth.startAutoRefresh();
    else void auth.stopAutoRefresh();
  };

  apply(AppState.currentState);
  const subscription = AppState.addEventListener("change", apply);
  return () => subscription.remove();
}
