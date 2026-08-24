import { Alert, Linking, Text, View } from "react-native";
import { AppIcon } from "../ui/icon";

import { AppPressable } from "../ui/pressable";

const AMENITY_LABELS: Record<string, string> = {
  pet_park: "Evcil hayvan parkı",
  dog_walking_area: "Köpek gezdirme alanı",
  walking_track: "Yürüyüş parkuru",
  walking_paths: "Yürüyüş yolları",
  duspet: "DuşPet",
};

export function MeetupPlaceTrust({
  verificationMethod,
  sourceName,
  sourceUrl,
  amenities,
}: {
  verificationMethod: "official_source" | "field" | null;
  sourceName: string | null;
  sourceUrl: string | null;
  amenities: string[];
}) {
  const verificationLabel =
    verificationMethod === "field"
      ? "Sahada kontrol edildi"
      : verificationMethod === "official_source"
        ? "Resmi kaynakla kontrol edildi"
        : "Doğrulanmış nokta";

  const openSource = async () => {
    if (!sourceUrl) return;
    try {
      await Linking.openURL(sourceUrl);
    } catch {
      Alert.alert("Kaynak açılamadı", "Bağlantıyı şu anda açamıyoruz. Lütfen tekrar dene.");
    }
  };

  return (
    <View>
      <View className="mt-2 flex-row flex-wrap gap-1.5">
        <View className="flex-row items-center rounded-full bg-accent/10 px-2 py-1">
          <AppIcon name="shield-check" size={12} color="#1E9384" />
          <Text className="ml-1 text-[11px] font-semibold text-accent-dark">
            {verificationLabel}
          </Text>
        </View>
        {amenities.map((amenity) => (
          <View key={amenity} className="rounded-full bg-bg-tertiary px-2 py-1">
            <Text className="text-[11px] font-semibold text-text-secondary">
              {AMENITY_LABELS[amenity] ?? amenity}
            </Text>
          </View>
        ))}
      </View>

      {sourceUrl && sourceName ? (
        <AppPressable
          onPress={() => void openSource()}
          accessibilityRole="link"
          accessibilityLabel={`${sourceName} kaynağını aç`}
          className="mt-2 min-h-8 flex-row items-center self-start"
        >
          <AppIcon name="external-link" size={13} color="#E0523F" />
          <Text className="ml-1.5 text-xs font-semibold text-brand-dark">{sourceName}</Text>
        </AppPressable>
      ) : null}
    </View>
  );
}
