import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

import {
  loadPushPermission,
  registerForPushNotifications,
} from "../core/api/notifications";
import { trackProductEvent } from "../core/api/observability";
import {
  decidePushPrompt,
  markPushPromptShown,
  parsePushPromptHistory,
  type PushPromptSource,
} from "../core/domain/push-prompt";
import { useAuthStore } from "../stores/auth";
import { usePushPromptStore } from "../stores/push-prompt";
import { Button } from "./ui/button";
import { AppIcon, type AppIconName } from "./ui/icon";

const historyKey = (userId: string) => `petmatch:push-prompt:${userId}`;

const REASONS: { icon: AppIconName; title: string; detail: string }[] = [
  {
    icon: "heart",
    title: "Yeni eşleşme",
    detail: "Karşılıklı beğeni olduğunda anında haberin olsun.",
  },
  {
    icon: "message-circle",
    title: "Yeni mesaj",
    detail: "Eşleştiğin sahip yazınca uygulamayı açmadan gör.",
  },
  {
    icon: "paw-print",
    title: "Yakınında yeni pet",
    detail: "Bölgende yeni bir pet katılınca ilk sen bil.",
  },
];

/**
 * Push izni ön ekranı. Ekranlar `requestPushPrompt(source)` der; burası
 * izin durumu ve tarihçeye bakıp göstermeye karar verir, sistem penceresini
 * yalnız kullanıcı "Bildirimleri aç" deyince açar.
 *
 * Kök layout'ta tek örnek. Modal olduğu için sohbete geçilse de görünür
 * (ilk eşleşmede "Mesaj gönder" denip chat'e gidilirken de).
 */
export function PushPermissionPromptHost() {
  const user = useAuthStore((state) => state.user);
  const pending = usePushPromptStore((state) => state.pending);
  const clear = usePushPromptStore((state) => state.clear);
  const [visible, setVisible] = useState<PushPromptSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const evaluating = useRef(false);

  useEffect(() => {
    if (!pending || !user || visible || evaluating.current) return;
    evaluating.current = true;
    const source = pending;

    void (async () => {
      try {
        const permission = await loadPushPermission();
        // Web: push yok, soru da yok.
        if (!permission) return;
        const history = parsePushPromptHistory(
          await AsyncStorage.getItem(historyKey(user.id)),
        );
        const decision = decidePushPrompt({
          permission,
          source,
          history,
          now: new Date(),
        });
        if (!decision.show) return;

        await AsyncStorage.setItem(
          historyKey(user.id),
          JSON.stringify(markPushPromptShown(history, source, new Date())),
        );
        setNotice(null);
        setVisible(source);
      } catch (error) {
        console.warn("Push ön ekranı değerlendirilemedi:", error);
      } finally {
        clear();
        evaluating.current = false;
      }
    })();
  }, [clear, pending, user, visible]);

  const source = visible;
  if (!source) return null;

  const close = () => {
    setVisible(null);
    setBusy(false);
  };

  const dismiss = () => {
    void trackProductEvent("push_permission_result", { status: "dismissed", source });
    close();
  };

  const enable = async () => {
    setBusy(true);
    const registration = await registerForPushNotifications(true);
    void trackProductEvent("push_permission_result", {
      status: registration.status,
      source,
    });
    if (registration.status === "registered") {
      close();
      return;
    }
    // Sistem penceresinde red ya da simülatör: tek satır açıklama, kapat.
    // Kullanıcıyı burada tutmanın anlamı yok; Profil'deki satır devralır.
    setBusy(false);
    setNotice(registration.message);
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismiss}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={dismiss}>
        <Pressable
          className="rounded-t-3xl bg-bg-primary px-5 pb-9 pt-5"
          onPress={(event) => event.stopPropagation()}
          accessibilityViewIsModal
        >
          <View className="mb-4 h-14 w-14 items-center justify-center self-center rounded-full bg-brand/10">
            <AppIcon name="sparkles" color="#F97362" size={28} />
          </View>
          <Text className="text-center text-2xl font-bold text-text-primary">
            {source === "first_match" ? "Eşleştin! Cevabı kaçırma" : "Eşleşmeni kaçırma"}
          </Text>
          <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
            {source === "first_match"
              ? "Karşı taraf yazdığında haberin olsun; sohbetler ilk saatlerde başlıyor."
              : "PetMatch'te asıl şey buluşmak. Bildirimler açıkken eşleşme ve mesajlar seni bekletmez."}
          </Text>

          <View className="mt-5 rounded-2xl border border-border bg-surface">
            {REASONS.map((reason, index) => (
              <View
                key={reason.title}
                className={`flex-row items-center px-4 py-3 ${
                  index > 0 ? "border-t border-border" : ""
                }`}
              >
                <View className="h-9 w-9 items-center justify-center rounded-full bg-brand/10">
                  <AppIcon name={reason.icon} color="#F97362" size={18} />
                </View>
                <View className="ml-3 flex-1">
                  <Text className="font-bold text-text-primary">{reason.title}</Text>
                  <Text className="mt-0.5 text-xs text-text-secondary">{reason.detail}</Text>
                </View>
              </View>
            ))}
          </View>

          {notice ? (
            <Text className="mt-3 text-center text-xs font-semibold text-text-secondary">
              {notice}
            </Text>
          ) : null}

          <Button
            label="Bildirimleri aç"
            onPress={() => void enable()}
            loading={busy}
            className="mt-5"
          />
          <Button
            label={notice ? "Kapat" : "Şimdi değil"}
            variant="ghost"
            onPress={dismiss}
            disabled={busy}
            className="mt-1"
          />
          <Text className="mt-2 text-center text-[11px] text-text-tertiary">
            {"İstediğin zaman Profil > Bildirimler'den değiştirebilirsin."}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
