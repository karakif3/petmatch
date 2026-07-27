import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import * as Linking from "expo-linking";

import { getSupabaseClient, requireSupabaseClient } from "../core/api/supabase.client";

type AuthState = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** Supabase env'i tanımlı değilse false — giriş ekranı bunu uyarı olarak gösterir. */
  configured: boolean;
  init: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  configured: true,

  init: async () => {
    const sb = getSupabaseClient();
    if (!sb) {
      set({ loading: false, configured: false });
      return;
    }

    const { data } = await sb.auth.getSession();
    set({
      session: data.session,
      user: data.session?.user ?? null,
      loading: false,
      configured: true,
    });

    sb.auth.onAuthStateChange((_event, session) => {
      set({ session, user: session?.user ?? null });
    });
  },

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
    await sb?.auth.signOut();
    set({ session: null, user: null });
  },
}));
