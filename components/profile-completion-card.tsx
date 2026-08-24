import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { AppIcon, type AppIconName } from "./ui/icon";

import {
  completionRatio,
  missingProfileItems,
  type CompletionItem,
  type ProfileCompletionInput,
} from "../core/domain/profile-completion";
import { AppPressable } from "./ui/pressable";

type Props = {
  data: ProfileCompletionInput | null | undefined;
};

type Group = {
  route: CompletionItem["route"];
  label: string;
  icon: AppIconName;
  count: number;
};

/**
 * Kayıtta sorulmayanları, kullanıcı ürünü gördükten SONRA ister.
 *
 * Kayıt akışı 17 alandan 6'ya indi; buradaki kart o farkın gittiği yer.
 * Üç kural var:
 *
 * 1. **Kapatılabilir.** Kalıcı bir dürtme değil; kullanıcı kapattığında
 *    oturum boyunca geri gelmiyor.
 * 2. **Eksik yoksa hiç render edilmiyor** — tamamlamış kullanıcı "tamamla"
 *    kartı görmüyor.
 * 3. **Kart hero değil.** Keşfet'te asıl iş desteyi görmek; bu şerit
 *    kartın önüne geçmemeli (bkz. plandaki K4). Bu yüzden tek satırlık
 *    bir başlık + ince ilerleme çubuğu + yan yana iki küçük çip.
 *
 * Eksikler iki gruba ayrılıyor (pet / sahip) çünkü model ikisini de
 * biliyor ama önceki sunum yalnızca `missing[0]`'ın route'una gidiyordu:
 * sahip profili eksik olan kullanıcı, pet eksikleri bitene kadar o
 * route'u hiç görmüyordu.
 */
export function ProfileCompletionCard({ data }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (!data || dismissed) return null;

  const missing = missingProfileItems(data);
  if (missing.length === 0) return null;

  const ratio = completionRatio(data);
  const groups: Group[] = ([
    {
      route: "/profile/pet",
      label: "Pet profili",
      icon: "paw-print",
      count: missing.filter((item) => item.route === "/profile/pet").length,
    },
    {
      route: "/profile/owner",
      label: "Sahip profili",
      icon: "user",
      count: missing.filter((item) => item.route === "/profile/owner").length,
    },
  ] satisfies Group[]).filter((group) => group.count > 0);

  return (
    <View className="mb-4 rounded-2xl border border-border bg-surface px-4 py-3">
      <View className="flex-row items-center">
        <Text className="flex-1 text-sm font-bold text-text-primary">
          Profilini tamamla
        </Text>
        <Text className="mr-2 text-xs text-text-tertiary">
          %{Math.round(ratio * 100)}
        </Text>
        <AppPressable
          onPress={() => setDismissed(true)}
          accessibilityRole="button"
          accessibilityLabel="Kartı kapat"
          hitSlop={10}
          className="h-7 w-7 items-center justify-center rounded-full bg-bg-tertiary"
        >
          <AppIcon name="x" size={14} color="#9A8B82" />
        </AppPressable>
      </View>

      <View className="mt-2 h-1 overflow-hidden rounded-full bg-bg-tertiary">
        <View
          className="h-full rounded-full bg-brand"
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </View>

      <View className="mt-3 flex-row gap-2">
        {groups.map((group) => (
          <AppPressable
            key={group.route}
            onPress={() => router.push(group.route)}
            accessibilityRole="button"
            accessibilityLabel={`${group.label}: ${group.count} madde eksik`}
            className="min-h-11 flex-1 flex-row items-center justify-center rounded-xl border border-brand/30 bg-brand/10 px-3"
          >
            <AppIcon name={group.icon} size={14} color="#F97362" />
            <Text
              numberOfLines={1}
              className="ml-1.5 text-xs font-semibold text-brand-dark"
            >
              {group.label}
            </Text>
            <View className="ml-1.5 h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1">
              <Text className="text-[10px] font-bold text-white">{group.count}</Text>
            </View>
          </AppPressable>
        ))}
      </View>
    </View>
  );
}
