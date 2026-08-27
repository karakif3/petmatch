import "react-native-url-polyfill/auto";
import "../global.css";

import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ActivityIndicator, AppState, LogBox, Platform, Text, View } from "react-native";
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
import { touchLastActive } from "../core/api/conversations";
import { syncLanguagePreference } from "../core/api/preferences";
import { getAppLocale, syncAppLocale } from "../core/i18n";
import { useAuthStore } from "../stores/auth";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppErrorBoundary } from "../components/app-error-boundary";
import { InAppNotificationBanner } from "../components/in-app-notification-banner";
import { AppPressable } from "../components/ui/pressable";

if (__DEV__) {
  LogBox.ignoreLogs([
    "[expo-notifications]",
    "Error reading persisted",
    "The action 'GO_BACK' was not handled",
  ]);
}

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
  const regionAccess = useAuthStore((s) => s.regionAccess);
  const legalRequired = useAuthStore((s) => s.legalRequired);
  const loading = useAuthStore((s) => s.loading);
  const recoveryMode = useAuthStore((s) => s.recoveryMode);

  useEffect(() => {
    if (loading || (user && onboarded === null)) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inOnboarding = segments[0] === "onboarding";
    const inWaitlist = segments[0] === "waitlist";
    const inLegalConsent = segments[0] === "legal-consent";
    const onAuthCallback =
      segments[0] === "auth" &&
      (segments as readonly string[])[1] === "callback";
    const onPasswordReset =
      inAuthGroup && (segments as readonly string[])[1] === "reset-password";
    const onLegal =
      inAuthGroup && (segments as readonly string[])[1] === "legal";

    if (onLegal || onAuthCallback) {
      return;
    } else if (!user && !inAuthGroup) {
      router.replace("/(auth)/sign-in");
    } else if (user && recoveryMode && onPasswordReset) {
      return;
    } else if (user && !onboarded && !inOnboarding) {
      router.replace("/onboarding");
    } else if (user && onboarded && legalRequired && !inLegalConsent) {
      router.replace("/legal-consent");
    } else if (user && onboarded && !legalRequired && inLegalConsent) {
      router.replace(regionAccess === "waitlist" ? "/waitlist" : "/(app)");
    } else if (user && onboarded && regionAccess === "waitlist" && !inWaitlist) {
      router.replace("/waitlist");
    } else if (user && onboarded && regionAccess === "open" && inWaitlist) {
      router.replace("/(app)");
    } else if (user && onboarded && (inAuthGroup || inOnboarding)) {
      router.replace("/(app)");
    }
  }, [legalRequired, loading, onboarded, recoveryMode, regionAccess, router, segments, user]);
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
      if ((data.type === "message" || data.type === "match") && conversationId) {
        router.push({
          pathname: "/chat/[conversationId]",
          params: { conversationId },
        });
      } else if (data.type === "match") {
        router.push("/(app)/matches");
      } else if (data.type === "new_candidate") {
        router.push("/(app)");
      } else if (data.type === "super_like") {
        router.push("/(app)/likes");
      } else if (data.type === "verification") {
        router.push("/profile/owner");
      }
    };

    let disposed = false;
    let subscription: { remove: () => void } | null = null;
    void import("expo-notifications")
      .then(async (Notifications) => {
        if (disposed) return;
        subscription =
          Notifications.addNotificationResponseReceivedListener(
            openNotification,
          );
        try {
          const response = await Notifications.getLastNotificationResponseAsync();
          if (!disposed && response) openNotification(response);
        } catch {
          // Simülatörde persisted notification deposu okunamayabiliyor.
        }
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      subscription?.remove();
    };
  }, [onboarded, router, user]);

  return null;
}

function ActivityEffects() {
  const user = useAuthStore((state) => state.user);
  const onboarded = useAuthStore((state) => state.onboarded);

  useEffect(() => {
    if (!user || !onboarded) return;

    const updateActivity = () => {
      void touchLastActive().catch((error) => {
        console.error("Son aktiflik güncellenemedi:", error);
      });
    };

    updateActivity();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") updateActivity();
    });
    return () => subscription.remove();
  }, [onboarded, user]);

  return null;
}

function LocalizationEffects() {
  const user = useAuthStore((state) => state.user);
  const lastSynced = useRef<string | null>(null);

  useEffect(() => {
    const updateLocale = () => {
      syncAppLocale();
      if (!user) return;
      const syncKey = `${user.id}:${getAppLocale()}`;
      if (lastSynced.current === syncKey) return;
      void syncLanguagePreference()
        .then(() => {
          lastSynced.current = syncKey;
        })
        .catch((error) => {
          console.error("Dil tercihi güncellenemedi:", error);
        });
    };

    updateLocale();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") updateLocale();
    });
    return () => subscription.remove();
  }, [user]);

  return null;
}

export default function RootLayout() {
  const init = useAuthStore((s) => s.init);
  const user = useAuthStore((s) => s.user);
  const onboarded = useAuthStore((s) => s.onboarded);
  const onboardingStatusError = useAuthStore((s) => s.onboardingStatusError);
  const retryOnboardingStatus = useAuthStore((s) => s.retryOnboardingStatus);
  const signOut = useAuthStore((s) => s.signOut);
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
      {/*
        SafeAreaProvider react-native-safe-area-context'in ÖNKOŞULU.
        Ekranlar deprecated react-native SafeAreaView'ından buna geçti;
        eski sürüm iOS 26'da KeyboardAvoidingView zinciriyle birlikte
        içeriği sıfır yüksekliğe düşürüyor ve profil ekranları boş
        render ediliyordu.
      */}
      <SafeAreaProvider>
        <AppErrorBoundary>
          <QueryClientProvider client={queryClient}>
            {user && onboarded === null && onboardingStatusError ? (
              <View className="flex-1 items-center justify-center bg-bg-primary px-8">
                <Text className="text-center text-xl font-bold text-text-primary">
                  Hesap bilgilerin alınamadı
                </Text>
                <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
                  Bağlantını kontrol edip tekrar dene. Hiçbir bilgin değişmedi.
                </Text>
                <AppPressable
                  onPress={() => void retryOnboardingStatus()}
                  className="mt-6 min-h-12 w-full items-center justify-center rounded-xl bg-brand px-5"
                >
                  <Text className="font-bold text-white">Tekrar dene</Text>
                </AppPressable>
                <AppPressable
                  onPress={() => void signOut()}
                  className="mt-2 min-h-12 items-center justify-center px-5"
                >
                  <Text className="font-semibold text-text-secondary">Başka hesapla giriş yap</Text>
                </AppPressable>
              </View>
            ) : user && onboarded === null ? (
              <View className="flex-1 items-center justify-center bg-bg-primary">
                <ActivityIndicator color="#F97362" />
              </View>
            ) : (
              <>
                <NotificationEffects />
                <ActivityEffects />
                <LocalizationEffects />
                <StatusBar style="dark" />
                <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "#FFFBF7" },
              }}
                >
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="onboarding" />
              <Stack.Screen name="waitlist" />
              <Stack.Screen name="legal-consent" />
              <Stack.Screen name="(app)" />
              <Stack.Screen name="chat/[conversationId]" />
              <Stack.Screen
                name="pet/[petId]"
                options={{
                  animation: "slide_from_right",
                  freezeOnBlur: true,
                  contentStyle: { backgroundColor: "#FFFBF7" },
                  gestureEnabled: true,
                }}
              />
              <Stack.Screen name="profile/pet" />
              <Stack.Screen name="profile/owner" />
              <Stack.Screen name="moderation/index" />
                </Stack>
                <InAppNotificationBanner enabled={Boolean(user && onboarded)} />
              </>
            )}
          </QueryClientProvider>
        </AppErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
