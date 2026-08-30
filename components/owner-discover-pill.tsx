import { Text, View } from "react-native";
import { Image } from "expo-image";

import { ownerInterestLabels } from "../core/domain/labels";
import type { OwnerInterest } from "../core/domain/types";
import { AppIcon } from "./ui/icon";
import { AppPressable } from "./ui/pressable";

const MAX_OWNER_INTEREST_CHIPS = 2;

export type OwnerDiscoverPillOwner = {
  displayName: string | null;
  photoUrl: string | null;
  verified: boolean;
  interests?: OwnerInterest[];
};

/**
 * Keşfet kartındaki sahip hapı.
 *
 * Ayrı bileşen olmasının sebebi: "Karşı taraf ne görüyor" önizlemesi aynı
 * hapı taklit ediyor. İki kopya tutunca kalkan ve ilgi çipleri birinde
 * kalıp diğerinde unutuluyordu.
 */
export function OwnerDiscoverPill({
  owner,
  variant,
  onPress,
  pageIndex = 0,
}: {
  owner: OwnerDiscoverPillOwner;
  /** overlay = foto üstü cam; preview = açık kart üzerindeki koyu hap. */
  variant: "overlay" | "preview";
  onPress?: () => void;
  /** Pet karusel sayfasıyla sahip fotoğrafı/ilgilerini birlikte ilerletir. */
  pageIndex?: number;
}) {
  const interests = owner.interests ?? [];
  const interestChips = Array.from(
    { length: Math.min(MAX_OWNER_INTEREST_CHIPS, interests.length) },
    (_, offset) => interests[(pageIndex * MAX_OWNER_INTEREST_CHIPS + offset) % interests.length],
  );
  const overlay = variant === "overlay";
  const avatar = overlay ? 38 : 26;
  const body = (
    <>
      {owner.photoUrl ? (
        <Image
          source={owner.photoUrl}
          contentFit="cover"
          style={{ width: avatar, height: avatar, borderRadius: avatar / 2 }}
        />
      ) : (
        <View
          className="items-center justify-center rounded-full bg-white/20"
          style={{ width: avatar, height: avatar }}
        >
          <AppIcon name="user" color="#FFFFFF" size={overlay ? 16 : 13} />
        </View>
      )}
      <Text className="text-xs font-bold text-white" numberOfLines={1}>
        {owner.displayName ?? "Pet sahibi"}
      </Text>
      {owner.verified ? (
        <AppIcon name="shield-check" color="#5ED3C3" size={overlay ? 14 : 13} />
      ) : null}
      {interestChips.map((interest) => (
        <View key={interest} className="rounded-full bg-white/20 px-2 py-0.5">
          <Text className="text-[10px] font-semibold text-white">
            {ownerInterestLabels[interest]}
          </Text>
        </View>
      ))}
      {/*
        İlgi girilmemişse hap yalnızca isimden ibaret kalır. Boşken niyeti
        söyleyen metin; dolu olduğunda gürültü olmasın diye yalnızca boşken.
      */}
      {interestChips.length === 0 ? (
        <Text className="text-[10px] font-semibold text-white/70">Sahibini gör</Text>
      ) : null}
      {onPress || variant === "preview" ? (
        <AppIcon name="chevron-right" color="#FFFFFFB3" size={overlay ? 13 : 12} />
      ) : null}
    </>
  );

  const className = overlay
    ? "max-w-full flex-row items-center gap-2 self-start rounded-full border border-white/15 bg-black/50 py-1.5 pl-1.5 pr-3"
    : "max-w-full flex-row items-center gap-2 self-start rounded-full bg-text-primary/90 py-1.5 pl-1.5 pr-3";

  if (onPress) {
    return (
      <AppPressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${owner.displayName ?? "Pet sahibi"} — sahip profilini aç`}
        className={className}
      >
        {body}
      </AppPressable>
    );
  }

  return <View className={className}>{body}</View>;
}
