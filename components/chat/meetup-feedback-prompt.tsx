import { useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { MeetupOutcome } from "../../core/api/conversations";
import { getIntlLocale } from "../../core/i18n";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleDateString(getIntlLocale(), {
    day: "numeric",
    month: "long",
  });
}

/**
 * "Buluştunuz mu?"
 *
 * Hinge'in "We Met" döngüsünün karşılığı. İki işi var:
 *
 *   1. Ürünün başarı metriğini tanımlamak — uygulamada geçen süre değil,
 *      kaç konuşmanın gerçek buluşmaya döndüğü.
 *   2. Sıralamaya besleyecek sinyali üretmek. Mesafe, son aktiflik ve uyum
 *      skoru yarışıyordu ama hangisinin işe yaradığını gösteren veri yoktu.
 *
 * Cevap karşı tarafa ASLA gösterilmiyor; "o ne dedi" bilgisi dürüst cevabı
 * bozar. "Sorma" seçeneği bilerek eşit ağırlıkta — cevap vermeye zorlamak
 * veriyi kirletir.
 */
export function MeetupFeedbackPrompt({
  petName,
  meetupPlaceName,
  meetupScheduledAt,
  onAnswer,
}: {
  petName: string | null;
  /** Kayıtlı, onaylanmış buluşmadan geliyorsa yeri/tarihi soruda adıyla anmak için. */
  meetupPlaceName?: string | null;
  meetupScheduledAt?: string | null;
  onAnswer: (outcome: MeetupOutcome) => Promise<void>;
}) {
  const [busy, setBusy] = useState<MeetupOutcome | null>(null);

  const answer = async (outcome: MeetupOutcome) => {
    if (busy) return;
    setBusy(outcome);
    try {
      await onAnswer(outcome);
    } finally {
      setBusy(null);
    }
  };

  const question = (() => {
    const who = petName ? `${petName} ile` : null;
    if (meetupPlaceName && meetupScheduledAt) {
      const when = formatWhen(meetupScheduledAt);
      return who
        ? `${who} ${meetupPlaceName} konumunda ${when} buluştunuz mu?`
        : `${meetupPlaceName} konumunda ${when} buluştunuz mu?`;
    }
    return who ? `${who} buluştunuz mu?` : "Buluştunuz mu?";
  })();

  return (
    <View
      className="mx-4 mb-3 rounded-2xl border border-border bg-bg-secondary p-4"
      accessibilityRole="summary"
    >
      <View className="flex-row items-center">
        <Ionicons name="paw-outline" color="#F97362" size={18} />
        <Text className="ml-2 flex-1 text-sm font-bold text-text-primary">{question}</Text>
      </View>

      <Text className="mt-1.5 text-xs leading-4 text-text-secondary">
        Cevabın yalnızca sana özel — karşı tarafa gösterilmiyor. Kimlerin
        gerçekten buluştuğunu bilmek, sana daha iyi öneriler getirmemizi sağlıyor.
      </Text>

      <View className="mt-3 flex-row gap-2">
        <Pressable
          onPress={() => void answer("met")}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Evet, buluştuk"
          className="min-h-11 flex-1 flex-row items-center justify-center rounded-xl bg-accent px-3 disabled:opacity-60"
        >
          {busy === "met" ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" color="#FFFFFF" size={16} />
              <Text className="ml-1.5 text-sm font-bold text-white">Buluştuk</Text>
            </>
          )}
        </Pressable>

        <Pressable
          onPress={() => void answer("not_yet")}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityLabel="Henüz buluşmadık"
          className="min-h-11 flex-1 items-center justify-center rounded-xl border border-border bg-surface px-3 disabled:opacity-60"
        >
          {busy === "not_yet" ? (
            <ActivityIndicator color="#9A8B82" size="small" />
          ) : (
            <Text className="text-sm font-semibold text-text-primary">Henüz değil</Text>
          )}
        </Pressable>
      </View>

      <Pressable
        onPress={() => void answer("declined")}
        disabled={busy !== null}
        accessibilityRole="button"
        accessibilityLabel="Bu soruyu bir daha sorma"
        className="mt-1 min-h-11 items-center justify-center"
      >
        <Text className="text-xs font-semibold text-text-tertiary">Sorma</Text>
      </Pressable>
    </View>
  );
}
