import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";

import { unregisterCurrentPushToken } from "../core/api/notifications";
import { getSupabaseClient, requireSupabaseClient } from "../core/api/supabase.client";

async function readOnboardingStatus(userId: string): Promise<boolean> {
  const sb = requireSupabaseClient();
  const { data, error } = await sb
    .from("profiles")
    .select("onboarded_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data?.onboarded_at);
}

type AuthState = {
  user: User | null;
  session: Session | null;
  /** null = henüz okunmadı, false = onboarding gerekli. */
  onboarded: boolean | null;
  loading: boolean;
  /** Supabase env'i tanımlı değilse false — giriş ekranı bunu uyarı olarak gösterir. */
  configured: boolean;
  init: () => Promise<void>;
  setOnboarded: (value: boolean) => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  onboarded: null,
  loading: true,
  configured: true,

  init: async () => {
    const sb = getSupabaseClient();
    if (!sb) {
      set({ loading: false, configured: false });
      return;
    }

    const { data, error: sessionError } = await sb.auth.getSession();
    if (sessionError) {
      console.error("Oturum okunamadı:", sessionError);
      set({ loading: false, configured: true, onboarded: false });
      return;
    }

    const user = data.session?.user ?? null;
    let onboarded: boolean | null = null;

    if (user) {
      try {
        onboarded = await readOnboardingStatus(user.id);
      } catch (error) {
        // Ağ veya geçici API hatası splash ekranını sonsuza kadar kilitlemesin.
        console.error("Onboarding durumu okunamadı:", error);
        onboarded = false;
      }
    }

    set({
      session: data.session,
      user,
      onboarded,
      loading: false,
      configured: true,
    });

    sb.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      set({ session, user: nextUser, onboarded: nextUser ? null : false });

      if (nextUser) {
        // Supabase, auth callback'i içinde başka Supabase çağrılarının await
        // edilmemesini önerir. Bir sonraki event-loop turuna ertelemek ayrıca
        // hızlı sign-out/sign-in yarışında eski kullanıcının sonucunu engeller.
        setTimeout(() => {
          void readOnboardingStatus(nextUser.id)
            .then((value) => {
              if (get().user?.id === nextUser.id) set({ onboarded: value });
            })
            .catch((error) => {
              console.error("Onboarding durumu okunamadı:", error);
              if (get().user?.id === nextUser.id) set({ onboarded: false });
            });
        }, 0);
      }
    });
  },

  setOnboarded: (value) => set({ onboarded: value }),

  signInWithEmail: async (email, password) => {
    const sb = requireSupabaseClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUpWithEmail: async (email, password) => {
    const sb = requireSupabaseClient();
    const { error } = await sb.auth.signUp({ email, password });
    if (error) throw error;
  },

  signInWithGoogle: async () => {
    const sb = requireSupabaseClient();
    const redirectTo = Linking.createURL("auth/callback");

    const { data, error } = await sb.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (error) throw error;
    if (data?.url) await Linking.openURL(data.url);
  },

  signOut: async () => {
    const sb = getSupabaseClient();
    try {
      await unregisterCurrentPushToken();
    } catch (error) {
      // Oturum kapatma, token temizliği geçici olarak başarısız olsa bile
      // engellenmez. Sonraki girişte token yeni kullanıcıya yeniden atanır.
      console.error("Push tokenı kaldırılamadı:", error);
    }
    await sb?.auth.signOut();
    set({ session: null, user: null, onboarded: null });
  },
}));
