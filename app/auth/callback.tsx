/**
 * OAuth deep link dönüşü. Supabase client `detectSessionInUrl` ile web'de
 * kendi halleder; mobilde token'lar URL fragment'ında gelir ve burada kurulur.
 */
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { getSupabaseClient } from "../../core/api/supabase.client";

export default function AuthCallback() {
  const params = useLocalSearchParams<{
    access_token?: string;
    refresh_token?: string;
  }>();

  useEffect(() => {
    const sb = getSupabaseClient();
    if (!sb) return;

    const { access_token, refresh_token } = params;

    if (access_token && refresh_token) {
      sb.auth
        .setSession({ access_token, refresh_token })
        .catch((error) => console.error("Oturum kurulamadı:", error))
        .finally(() => router.replace("/(app)"));
    } else {
      router.replace("/(auth)/sign-in");
    }
  }, [params]);

  return (
    <View className="flex-1 bg-bg-primary items-center justify-center">
      <ActivityIndicator color="#F97362" />
    </View>
  );
}
