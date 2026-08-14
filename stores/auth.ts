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
  onboardingStatusError: boolean;
  loading: boolean;
  /** Şifre kurtarma deep link'i işlenirken auth gate reset ekranını açık tutar. */
  recoveryMode: boolean;
  /** Supabase env'i tanımlı değilse false — giriş ekranı bunu uyarı olarak gösterir. */
  configured: boolean;
  init: () => Promise<void>;
  retryOnboardingStatus: () => Promise<void>;
  setOnboarded: (value: boolean) => void;
  setRecoveryMode: (value: boolean) => void;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resendSignupConfirmation: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  onboarded: null,
  onboardingStatusError: false,
  loading: true,
  configured: true,
  recoveryMode: false,

  init: async () => {
    const sb = getSupabaseClient();
    if (!sb) {
      set({ loading: false, configured: false });
      return;
    }

    const { data, error: sessionError } = await sb.auth.getSession();
    if (sessionError) {
      console.error("Oturum okunamadı:", sessionError);
      set({ loading: false, configured: true, onboarded: null, onboardingStatusError: true });
      return;
    }

    const user = data.session?.user ?? null;
    let onboarded: boolean | null = null;

    if (user) {
      try {
        onboarded = await readOnboardingStatus(user.id);
      } catch (error) {
        console.error("Onboarding durumu okunamadı:", error);
        onboarded = null;
      }
    }

    set({
      session: data.session,
      user,
      onboarded,
      loading: false,
      configured: true,
      onboardingStatusError: Boolean(user && onboarded === null),
    });

    sb.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      set({
        session,
        user: nextUser,
        onboarded: nextUser ? null : false,
        onboardingStatusError: false,
      });

      if (nextUser) {
        // Supabase, auth callback'i içinde başka Supabase çağrılarının await
        // edilmemesini önerir. Bir sonraki event-loop turuna ertelemek ayrıca
        // hızlı sign-out/sign-in yarışında eski kullanıcının sonucunu engeller.
        setTimeout(() => {
          void readOnboardingStatus(nextUser.id)
            .then((value) => {
              if (get().user?.id === nextUser.id) {
                set({ onboarded: value, onboardingStatusError: false });
              }
            })
            .catch((error) => {
              console.error("Onboarding durumu okunamadı:", error);
              if (get().user?.id === nextUser.id) {
                set({ onboarded: null, onboardingStatusError: true });
              }
            });
        }, 0);
      }
    });
  },

  retryOnboardingStatus: async () => {
    const user = get().user;
    if (!user) return;
    set({ onboardingStatusError: false });
    try {
      const onboarded = await readOnboardingStatus(user.id);
      if (get().user?.id === user.id) set({ onboarded, onboardingStatusError: false });
    } catch (error) {
      console.error("Onboarding durumu okunamadı:", error);
      if (get().user?.id === user.id) set({ onboarded: null, onboardingStatusError: true });
    }
  },

  setOnboarded: (value) => set({ onboarded: value }),
  setRecoveryMode: (value) => set({ recoveryMode: value }),

  signInWithEmail: async (email, password) => {
    const sb = requireSupabaseClient();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },

  signUpWithEmail: async (email, password) => {
    const sb = requireSupabaseClient();
    const { error } = await sb.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: Linking.createURL("auth/callback") },
    });
    if (error) throw error;
  },

  requestPasswordReset: async (email) => {
    const sb = requireSupabaseClient();
    const redirectTo = Linking.createURL("auth/callback", {
      queryParams: { next: "reset-password" },
    });
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });
    if (error) throw error;
  },

  resendSignupConfirmation: async (email) => {
    const sb = requireSupabaseClient();
    const { error } = await sb.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: Linking.createURL("auth/callback") },
    });
    if (error) throw error;
  },

  updatePassword: async (password) => {
    const sb = requireSupabaseClient();
    const { error } = await sb.auth.updateUser({ password });
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
    set({
      session: null,
      user: null,
      onboarded: null,
      onboardingStatusError: false,
      recoveryMode: false,
    });
  },
}));
