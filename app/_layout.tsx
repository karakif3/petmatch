import "react-native-url-polyfill/auto";
import "../global.css";

import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import { useAuthStore } from "../stores/auth";

SplashScreen.preventAutoHideAsync().catch(() => undefined);

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

/** Oturum durumuna göre (auth) ↔ (app) yönlendirmesi. */
function useAuthGate() {
  const router = useRouter();
  const segments = useSegments();
  const user = useAuthStore((s) => s.user);
  const onboarded = useAuthStore((s) => s.onboarded);
  const loading = useAuthStore((s) => s.loading);

  useEffect(() => {
    if (loading || (user && onboarded === null)) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";

    if (!user && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (user && !onboarded && !inOnboarding) {
      router.replace("/onboarding");
    } else if (user && onboarded && (inAuthGroup || inOnboarding)) {
      router.replace("/(app)");
    }
  }, [loading, onboarded, router, segments, user]);
}

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    init();
  }, [init]);

  useAuthGate();

  useEffect(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => undefined);
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#FFFBF7" },
          }}
        >
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="(app)" />
          <Stack.Screen name="chat/[conversationId]" />
        </Stack>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
