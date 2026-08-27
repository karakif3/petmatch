import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import { Platform } from "react-native";

import { requireSupabaseClient } from "./supabase.client";
import { errorMessage } from "../../core/domain/error-message";

const PUSH_TOKEN_STORAGE_KEY = "petmatch:expo-push-token";
const NOTIFICATION_CHANNEL_ID = "petmatch";

export type PushRegistrationResult = {
  status:
    | "registered"
    | "permission-denied"
    | "missing-project-id"
    | "simulator"
    | "unsupported"
    | "error";
  message: string;
};

type NotificationEvent =
  | { type: "match"; matchId: string }
  | { type: "message"; messageId: string }
  | { type: "new_candidate"; petId: string }
  | { type: "super_like"; swipeId: string }
  | { type: "verification"; moderationItemId: string };

function easProjectId(): string | null {
  const configured =
    Constants.easConfig?.projectId ??
    (Constants.expoConfig?.extra?.eas as { projectId?: string } | undefined)?.projectId;
  return typeof configured === "string" && configured ? configured : null;
}

async function configureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  const Notifications = await import("expo-notifications");
  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: "PetMatch bildirimleri",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 150, 250],
    lightColor: "#F97362",
    sound: "default",
  });
}

export function configureForegroundNotifications(): void {
  if (Platform.OS === "web") return;
  void import("expo-notifications")
    .then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          // Uygulama açıkken PetMatch'in kendi route-aware banner'ı gösterilir.
          // Sistem banner'ını da açmak aynı bildirimi iki kez gösterirdi.
          shouldShowBanner: false,
          shouldShowList: true,
          shouldPlaySound: false,
          shouldSetBadge: true,
        }),
      });
    })
    .catch(() => undefined);
}

export async function registerForPushNotifications(
  requestPermission = true,
): Promise<PushRegistrationResult> {
  try {
    if (Platform.OS === "web") {
      return {
        status: "unsupported",
        message: "Push bildirimleri şu anda iOS ve Android uygulamasında kullanılabilir.",
      };
    }
    if (!Device.isDevice) {
      return {
        status: "simulator",
        message: "Push tokenı için fiziksel bir iOS veya Android cihaz gerekiyor.",
      };
    }

    const projectId = easProjectId();
    if (!projectId) {
      return {
        status: "missing-project-id",
        message: "Push bildirimlerini açmak için PetMatch EAS projesi bağlanmalı.",
      };
    }

    const Notifications = await import("expo-notifications");
    await configureAndroidChannel();
    let permission = await Notifications.getPermissionsAsync();
    if (permission.status !== "granted" && requestPermission) {
      permission = await Notifications.requestPermissionsAsync({
        ios: { allowAlert: true, allowBadge: true, allowSound: true },
      });
    }
    if (permission.status !== "granted") {
      return {
        status: "permission-denied",
        message: "Bildirim izni verilmedi. İzni cihaz ayarlarından açabilirsin.",
      };
    }

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    const { error } = await requireSupabaseClient().rpc("register_push_token", {
      p_platform: Platform.OS,
      p_token: token,
    });
    if (error) throw error;

    await AsyncStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
    return { status: "registered", message: "Bu cihaz için bildirimler açıldı." };
  } catch (error) {
    return {
      status: "error",
      message:
        errorMessage(error, "Push bildirimi kaydedilemedi."),
    };
  }
}

export async function syncPushRegistration(): Promise<void> {
  if (Platform.OS === "web" || !Device.isDevice || !easProjectId()) return;
  const Notifications = await import("expo-notifications");
  const permission = await Notifications.getPermissionsAsync();
  if (permission.status !== "granted") return;
  const result = await registerForPushNotifications(false);
  if (result.status === "error") throw new Error(result.message);
}

export async function unregisterCurrentPushToken(): Promise<void> {
  const token = await AsyncStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
  if (!token) return;

  const { error } = await requireSupabaseClient().rpc("unregister_push_token", {
    p_token: token,
  });
  if (error) throw error;
  await AsyncStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

export async function requestNotificationDelivery(
  event: NotificationEvent,
): Promise<void> {
  const { error } = await requireSupabaseClient().functions.invoke(
    "send-notification",
    { body: event },
  );
  if (error) throw error;
}
