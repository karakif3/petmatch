import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { DiscoveryDeckCard } from "../core/api/discovery";
import { formatAge } from "../core/domain/age";

function distanceLabel(bucket: string | null): string {
  if (!bucket) return "Mesafe bilinmiyor";
  if (bucket === "<1") return "1 km’den yakın";
  if (bucket === "25+") return "25 km’den uzak";
  return `${bucket} km uzakta`;
}

function activityLabel(bucket: string | null): string | null {
  if (bucket === "today") return "Bugün aktif";
  if (bucket === "this_week") return "Bu hafta aktif";
  if (bucket === "this_month") return "Bu ay aktif";
  return null;
}

export function DiscoveryCard({ card }: { card: DiscoveryDeckCard }) {
  const age = formatAge(card.birthDate);
  const activity = activityLabel(card.activityBucket);
  const compatibility = Math.round(card.compatibility.total * 100);
  const details = [card.breed, age, card.size === "small" ? "Küçük" : card.size === "large" ? "Büyük" : "Orta"]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
      {card.photoUrls[0] ? (
        <Image
          source={card.photoUrls[0]}
          contentFit="cover"
          transition={180}
          style={{ width: "100%", aspectRatio: 0.92 }}
        />
      ) : (
        <View
          className="items-center justify-center bg-bg-tertiary"
          style={{ width: "100%", aspectRatio: 0.92 }}
        >
          <Ionicons name="paw" color="#C4B7AE" size={72} />
        </View>
      )}

      <View className="p-5">
        <View className="flex-row items-start justify-between gap-4">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-3xl font-bold text-text-primary">{card.name}</Text>
              <Ionicons
                name={card.gender === "female" ? "female" : "male"}
                color={card.gender === "female" ? "#E0527D" : "#4D83D1"}
                size={21}
              />
            </View>
            {details ? <Text className="mt-1 text-sm text-text-secondary">{details}</Text> : null}
          </View>
          <View className="rounded-full bg-accent/10 px-3 py-2">
            <Text className="text-sm font-bold text-accent-dark">%{compatibility} uyum</Text>
          </View>
        </View>

        <View className="mt-4 flex-row flex-wrap gap-2">
          <View className="flex-row items-center gap-1 rounded-full bg-bg-secondary px-3 py-2">
            <Ionicons name="location-outline" color="#6B5D55" size={15} />
            <Text className="text-xs font-semibold text-text-secondary">
              {distanceLabel(card.distanceBucket)}
            </Text>
          </View>
          {card.city ? (
            <View className="rounded-full bg-bg-secondary px-3 py-2">
              <Text className="text-xs font-semibold text-text-secondary">{card.city}</Text>
            </View>
          ) : null}
          <View className="rounded-full bg-bg-secondary px-3 py-2">
            <Text className="text-xs font-semibold text-text-secondary">
              Enerji {card.energyLevel}/5
            </Text>
          </View>
          {card.isNeutered ? (
            <View className="rounded-full bg-bg-secondary px-3 py-2">
              <Text className="text-xs font-semibold text-text-secondary">Kısırlaştırılmış</Text>
            </View>
          ) : null}
        </View>

        {card.bio ? (
          <Text className="mt-4 text-sm leading-5 text-text-secondary" numberOfLines={3}>
            {card.bio}
          </Text>
        ) : null}

        {activity ? (
          <View className="mt-4 flex-row items-center gap-1.5">
            <View className="h-2 w-2 rounded-full bg-accent" />
            <Text className="text-xs font-semibold text-accent-dark">{activity}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}
