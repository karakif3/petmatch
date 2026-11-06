import { Platform, Share } from "react-native";

import { inviteMessage, type InviteSurface } from "../domain/invite";
import { trackProductEvent } from "./observability";

const INVITE_URL = process.env.EXPO_PUBLIC_INVITE_URL?.trim() || null;

/**
 * Sistem paylaşım sayfasını açar. Yalnız gerçekten paylaşılırsa
 * `invite_shared` kaydedilir (iOS kapatmayı ayrıca bildiriyor; Android
 * bildirmediği için orada açılış = paylaşım sayılır).
 */
export async function shareInvite(
  surface: InviteSurface,
  context: { petName?: string | null; location?: string | null } = {},
): Promise<void> {
  const message = inviteMessage({ surface, ...context, url: INVITE_URL });
  const result = await Share.share(
    // iOS'ta `url` ayrı verilirse önizleme kartı çıkıyor; metinde tekrar
    // etmesin diye yalnız Android'de mesajın içinde kalıyor.
    Platform.OS === "ios" && INVITE_URL
      ? { message: message.replace(INVITE_URL, "").trim(), url: INVITE_URL }
      : { message },
  );
  if (result.action === Share.dismissedAction) return;
  void trackProductEvent("invite_shared", {
    surface,
    channel: result.activityType ?? null,
    has_url: Boolean(INVITE_URL),
  });
}
