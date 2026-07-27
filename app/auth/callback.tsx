/**
 * OAuth deep link dönüşü. Supabase client `detectSessionInUrl` ile web'de
 * kendi halleder; mobilde token'lar URL fragment'ında gelir ve burada kurulur.
 */
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { getSupabaseClient } from "../../core/api/supabase.client";
import { useAuthStore } from "../../stores/auth";

export default function AuthCallback() {
  const params = useLocalSearchParams<{
    access_token?: string;
    refresh_token?: string;
    code?: string;
    type?: string;
    next?: string;
    error_description?: string;
  }>();
  const setRecoveryMode = useAuthStore((state) => state.setRecoveryMode);

  useEffect(() => {
    const sb = getSupabaseClient();
    if (!sb) {
      router.replace("/(auth)/sign-in");
      return;
    }

    const { access_token, refresh_token, code, type, next, error_description } = params;
    const isRecovery = type === "recovery" || next === "reset-password";

    const complete = async () => {
      try {
        if (error_description) throw new Error(error_description);
        if (isRecovery) setRecoveryMode(true);

        if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (access_token && refresh_token) {
          const { error } = await sb.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
        } else {
          const { data } = await sb.auth.getSession();
          if (!data.session) throw new Error("Callback oturumu bulunamadı.");
        }

        router.replace(
          isRecovery ? "/(auth)/reset-password" : "/(app)",
        );
      } catch (error) {
        console.error("Auth callback tamamlanamadı:", error);
        setRecoveryMode(false);
        router.replace({
          pathname: "/(auth)/sign-in",
          params: { authError: "Bağlantı geçersiz veya süresi dolmuş." },
        });
      }
    };

    void complete();
  }, [params, setRecoveryMode]);

  return (
    <View className="flex-1 bg-bg-primary items-center justify-center">
      <ActivityIndicator color="#F97362" />
    </View>
  );
}
