import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Platform, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { Bell, Heart, MessageCircle, ShieldCheck, Sparkles, Star } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Notification } from "expo-notifications";
import { useQueryClient } from "@tanstack/react-query";

import { AppPressable } from "./ui/pressable";

type BannerNotification = {
  id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

function targetFor(data: Record<string, unknown>) {
  const type = typeof data.type === "string" ? data.type : null;
  const conversationId =
    typeof data.conversationId === "string" ? data.conversationId : null;

  if ((type === "message" || type === "match") && conversationId) {
    return {
      pathname: "/chat/[conversationId]" as const,
      params: { conversationId },
    };
  }
  if (type === "match") return "/(app)/matches" as const;
  if (type === "super_like") return "/(app)/likes" as const;
  if (type === "new_candidate") return "/(app)" as const;
  if (type === "verification") return "/profile/owner" as const;
  return null;
}

function isAlreadyVisible(pathname: string, data: Record<string, unknown>): boolean {
  return (
    data.type === "message" &&
    typeof data.conversationId === "string" &&
    pathname === `/chat/${data.conversationId}`
  );
}

function iconFor(type: unknown) {
  if (type === "message") return MessageCircle;
  if (type === "match") return Heart;
  if (type === "super_like") return Star;
  if (type === "new_candidate") return Sparkles;
  if (type === "verification") return ShieldCheck;
  return Bell;
}

export function InAppNotificationBanner({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const pathnameRef = useRef(pathname);
  const [banner, setBanner] = useState<BannerNotification | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const dismiss = () => {
    if (dismissTimer.current) clearTimeout(dismissTimer.current);
    Animated.timing(translateY, {
      toValue: -120,
      duration: 180,
      useNativeDriver: Platform.OS !== "web",
    }).start(() => setBanner(null));
  };

  useEffect(() => {
    if (!enabled || Platform.OS === "web") return;

    let disposed = false;
    let subscription: { remove: () => void } | null = null;
    void import("expo-notifications").then((Notifications) => {
      if (disposed) return;
      subscription = Notifications.addNotificationReceivedListener(
        (notification: Notification) => {
          const content = notification.request.content;
          const data = content.data ?? {};
          if (isAlreadyVisible(pathnameRef.current, data)) return;

          if (data.type === "message" || data.type === "match") {
            void queryClient.invalidateQueries({ queryKey: ["conversations"] });
          } else if (data.type === "super_like") {
            void queryClient.invalidateQueries({ queryKey: ["pending-likes"] });
          } else if (data.type === "new_candidate") {
            void queryClient.invalidateQueries({ queryKey: ["discovery"] });
          }

          if (dismissTimer.current) clearTimeout(dismissTimer.current);
          setBanner({
            id: notification.request.identifier,
            title: content.title ?? "PetMatch",
            body: content.body ?? "Yeni bir bildirimin var.",
            data,
          });
          translateY.setValue(-120);
          void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
            if (reduceMotion) {
              translateY.setValue(0);
            } else {
              Animated.spring(translateY, {
                toValue: 0,
                damping: 18,
                stiffness: 190,
                mass: 0.8,
                useNativeDriver: Platform.OS !== "web",
              }).start();
            }
          });
          AccessibilityInfo.announceForAccessibility(
            `${content.title ?? "PetMatch"}. ${content.body ?? "Yeni bir bildirimin var."}`,
          );
          dismissTimer.current = setTimeout(dismiss, 4500);
        },
      );
    });

    return () => {
      disposed = true;
      subscription?.remove();
      if (dismissTimer.current) clearTimeout(dismissTimer.current);
    };
    // `dismiss` only closes over stable refs/setters; resubscribing on every render
    // risks handling one foreground notification more than once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, queryClient, translateY]);

  if (!banner) return null;
  const Icon = iconFor(banner.data.type);

  const open = () => {
    const target = targetFor(banner.data);
    dismiss();
    if (target) router.push(target);
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        top: insets.top + 8,
        zIndex: 1000,
        transform: [{ translateY }],
      }}
    >
      <AppPressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`${banner.title}. ${banner.body}`}
        accessibilityHint={targetFor(banner.data) ? "Bildirimin ilgili ekranını açar" : undefined}
        className="min-h-20 flex-row items-center rounded-xl border border-border bg-surface px-4 py-3"
        style={{
          shadowColor: "#1F1A17",
          shadowOpacity: 0.14,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <View className="h-10 w-10 items-center justify-center rounded-full bg-brand/10">
          <Icon color="#E0523F" size={21} strokeWidth={2.25} />
        </View>
        <View className="ml-3 flex-1">
          <Text className="font-bold text-text-primary" numberOfLines={1}>
            {banner.title}
          </Text>
          <Text className="mt-0.5 text-sm leading-5 text-text-secondary" numberOfLines={2}>
            {banner.body}
          </Text>
        </View>
      </AppPressable>
    </Animated.View>
  );
}
