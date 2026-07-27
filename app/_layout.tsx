import "react-native-url-polyfill/auto";
import "../global.css";

import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import type { NotificationResponse } from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
import {
  useFonts,
  Inter_400Regular,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import {
  configureForegroundNotifications,
  syncPushRegistration,
} from "../core/api/notifications";
import { useAuthStore } from "../stores/auth";

SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureForegroundNotifications();

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

function NotificationEffects() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const onboarded = useAuthStore((state) => state.onboarded);
  const handledResponseId = useRef<string | null>(null);

  useEffect(() => {
    if (!user || !onboarded) return;
    void syncPushRegistration().catch((error) => {
      console.error("Push tokenı yenilenemedi:", error);
    });
  }, [onboarded, user]);

  useEffect(() => {
    if (Platform.OS === "web" || !user || !onboarded) return;

    const openNotification = (response: NotificationResponse) => {
      const responseId = response.notification.request.identifier;
      if (handledResponseId.current === responseId) return;
      handledResponseId.current = responseId;

      const data = response.notification.request.content.data;
      const conversationId =
        typeof data.conversationId === "string" ? data.conversationId : null;
      if (data.type === "message" && conversationId) {
        router.push({
          pathname: "/chat/[conversationId]",
          params: { conversationId },
        });
      } else if (data.type === "match") {
        router.push("/(app)/matches");
      }
    };

    let disposed = false;
    let subscription: { remove: () => void } | null = null;
    void import("expo-notifications")
      .then(async (Notifications) => {
        if (disposed) return;
        subscription =
          Notifications.addNotificationResponseReceivedListener(openNotification);
        const response = await Notifications.getLastNotificationResponseAsync();
        if (!disposed && response) openNotification(response);
      })
      .catch((error) => {
        console.error("Bildirim yönlendirmesi başlatılamadı:", error);
      });

    return () => {
      disposed = true;
      subscription?.remove();
    };
  }, [onboarded, router, user]);

  return null;
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
        <NotificationEffects />
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
