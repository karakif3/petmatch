import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import {
  completionRatio,
  missingProfileItems,
  type ProfileCompletionInput,
} from "../core/domain/profile-completion";

type Props = {
  data: ProfileCompletionInput | null | undefined;
};

/**
 * Kayıtta sorulmayanları, kullanıcı ürünü gördükten SONRA ister.
 *
 * Kayıt akışı 17 alandan 6'ya indi; buradaki kart o farkın gittiği yer.
 * İki kural var:
 *
 * 1. **Kapatılabilir.** Kalıcı bir dürtme değil; kullanıcı kapattığında
 *    oturum boyunca geri gelmiyor.
 * 2. **Eksik yoksa hiç render edilmiyor** — tamamlamış kullanıcı "tamamla"
 *    kartı görmüyor.
 */
export function ProfileCompletionCard({ data }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!data || dismissed) return null;

  const missing = missingProfileItems(data);
  if (missing.length === 0) return null;

  const ratio = completionRatio(data);
  const primary = missing[0];

  return (
    <View className="mb-4 rounded-2xl border border-border bg-surface p-4">
      <View className="flex-row items-start justify-between">
        <View className="mr-3 flex-1">
          <Text className="text-sm font-bold text-text-primary">
            Profilini tamamla
          </Text>
          <Text className="mt-1 text-xs leading-5 text-text-secondary">
            {primary.improvesMatching
              ? `${primary.label} eklersen eşleşme önerilerin daha isabetli olur.`
              : `${primary.label} ekleyerek profilini güçlendirebilirsin.`}
          </Text>
        </View>
        <Pressable
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          accessibilityLabel="Kartı kapat"
          hitSlop={10}
          className="h-8 w-8 items-center justify-center rounded-full bg-bg-tertiary"
        >
          <Ionicons name="close" size={16} color="#9A8B82" />
        </Pressable>
      </View>

      <View className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
        <View
          className="h-full rounded-full bg-brand"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </View>
      <Text className="mt-1.5 text-xs text-text-tertiary">
        {missing.length} madde eksik
      </Text>

      <Pressable
        onPress={() => router.push(primary.route)}
        className="mt-3 items-center rounded-xl bg-brand py-3"
      >
        <Text className="text-sm font-bold text-white">{primary.label} ekle</Text>
      </Pressable>
    </View>
  );
}
