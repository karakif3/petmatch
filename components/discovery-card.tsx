import { useEffect, useState, type ReactNode } from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { DiscoveryDeckCard } from "../core/api/discovery";
import { formatAge } from "../core/domain/age";
import { ownerInterestLabels, sizeLabels, temperamentLabels } from "../core/domain/labels";
import { shadowSm } from "../core/ui/shadow";
import { PhotoCarousel } from "./photo-carousel";
import { AppPressable } from "./ui/pressable";

const CARD_ASPECT = 3 / 4;
const MAX_OWNER_INTEREST_CHIPS = 2;

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

/** Foto üstünde okunabilirlik için tutarlı koyu-cam çip stili. */
function OverlayChip({ children }: { children: ReactNode }) {
  return (
    <View className="rounded-full bg-black/65 px-2.5 py-1.5">
      <Text className="text-[11px] font-bold text-white">{children}</Text>
    </View>
  );
}

export function DiscoveryCard({
  card,
  onOwnerPress,
  variant = "discovery",
}: {
  card: DiscoveryDeckCard;
  /** Sahip teaser'ına dokunulduğunda; verilmezse blok tıklanamaz kalır. */
  onOwnerPress?: () => void;
  /**
   * "preview": kullanıcı KENDİ kartına bakıyor (Profil → Profilimi önizle).
   * Uyum rozeti, mesafe ve sahip teaser'ı kendine göre anlamsız — bu yüzden
   * gizleniyor. Geri kalan (foto, mizaç/bilgi çipleri) karşı tarafın
   * gördüğüyle birebir aynı.
   */
  variant?: "discovery" | "preview";
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  // Kart değişince (yeni aday) önceki kartın fotoğraf sayfasında kalınmasın.
  useEffect(() => {
    setPhotoIndex(0);
  }, [card.id]);

  const age = formatAge(card.birthDate);
  const activity = activityLabel(card.activityBucket);
  const compatibility = Math.round(card.compatibility.total * 100);
  const details = [card.breed, age, sizeLabels[card.size]].filter(Boolean).join(" · ");
  const showCompatibility = variant === "discovery";
  const showDistance = variant === "discovery";

  /*
   * Kartın YÜZÜNE (fotoğrafın üstüne) taşınan "ilgi çekici bilgiler" —
   * önceden ayrı bir "Ayrıntılar için dokun" panelinin arkasındaydı. Artık
   * ayrı bir panel YOK: ilk fotoğrafa sığmayan bilgiler bir SONRAKİ
   * fotoğrafta beliriyor. Sıra öncelik sırası: enerji/şehir/kısırlaştırma →
   * mizaç → bio → sahip teaser'ı (sahip görünürse).
   */
  const extraBlocks: ReactNode[] = [];

  const factChips: string[] = [];
  if (card.city) factChips.push(card.city);
  factChips.push(`Enerji ${card.energyLevel}/5`);
  if (card.isNeutered) factChips.push("Kısırlaştırılmış");
  extraBlocks.push(
    <View key="facts" className="flex-row flex-wrap gap-1.5">
      {factChips.map((chip) => (
        <OverlayChip key={chip}>{chip}</OverlayChip>
      ))}
    </View>,
  );

  if (card.temperaments.length > 0) {
    extraBlocks.push(
      <View key="temperament" className="flex-row flex-wrap gap-1.5">
        {card.temperaments.map((temperament) => (
          <OverlayChip key={temperament}>{temperamentLabels[temperament]}</OverlayChip>
        ))}
      </View>,
    );
  }

  if (card.bio) {
    extraBlocks.push(
      <View key="bio" className="rounded-xl bg-black/70 px-3 py-2.5">
        <Text className="text-xs leading-5 text-white" numberOfLines={3}>
          {card.bio}
        </Text>
      </View>,
    );
  }

  // Sahip teaser'ı yalnızca `discovery` modunda: kendi kartını önizlerken
  // kendi ilgi alanlarını kendine göstermenin anlamı yok. Sahip verisi zaten
  // yalnızca `owner_visibility = 'public'` iken doluyor (RPC tarafında
  // gated) — istemci burada ek bir görünürlük kontrolü YAPMIYOR, 0021'deki
  // kuralı ikinci kez uygulamak yerine sunucuya güveniyor.
  if (variant === "discovery" && card.owner) {
    const owner = card.owner;
    const interestChips = owner.interests.slice(0, MAX_OWNER_INTEREST_CHIPS);
    extraBlocks.push(
      <AppPressable
        key="owner"
        onPress={onOwnerPress}
        disabled={!onOwnerPress}
        accessibilityRole={onOwnerPress ? "button" : undefined}
        accessibilityLabel={
          onOwnerPress ? `${owner.displayName ?? "Pet sahibi"} profilini aç` : undefined
        }
        className="flex-row items-center gap-2 rounded-2xl bg-black/70 px-2.5 py-2"
      >
        {owner.photoUrl ? (
          <Image
            source={owner.photoUrl}
            contentFit="cover"
            style={{ width: 32, height: 32, borderRadius: 16 }}
          />
        ) : (
          <View className="h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <Ionicons name="person-outline" color="#FFFFFF" size={16} />
          </View>
        )}
        <Text className="text-xs font-bold text-white" numberOfLines={1}>
          {owner.displayName ?? "Pet sahibi"}
        </Text>
        {owner.verified ? (
          <Ionicons name="shield-checkmark" color="#5ED3C3" size={14} />
        ) : null}
        {interestChips.map((interest) => (
          <View key={interest} className="rounded-full bg-white/20 px-2 py-1">
            <Text className="text-[10px] font-bold text-white">
              {ownerInterestLabels[interest]}
            </Text>
          </View>
        ))}
      </AppPressable>,
    );
  }

  const photoCount = Math.max(1, card.photoUrls.length);
  // Sayfa 0 çekirdek bilgiye (ad/yaş/mesafe) ayrılmış; fazladan içerik
  // sonraki sayfalara dağılıyor. Tek fotoğrafta gidecek başka sayfa
  // olmadığı için hepsi aynı sayfada, çekirdek bilginin ÜSTÜNDE toplanıyor
  // — veri kaybı olmasın diye.
  const extraPageCount = Math.max(1, photoCount - 1);
  const buckets: ReactNode[][] = Array.from({ length: extraPageCount }, () => []);
  extraBlocks.forEach((block, i) => {
    buckets[Math.min(i, extraPageCount - 1)].push(block);
  });
  const currentExtra =
    photoCount === 1 ? buckets[0] : photoIndex === 0 ? [] : buckets[photoIndex - 1];

  return (
    <View
      className="relative w-full overflow-hidden rounded-3xl border border-border bg-surface"
      style={shadowSm}
    >
      <PhotoCarousel
        photoUrls={card.photoUrls}
        aspectRatio={CARD_ASPECT}
        index={photoIndex}
        onIndexChange={setPhotoIndex}
      />

      {/*
        Alt okunabilirlik gradyanı — foto tam kadraj, metin üstüne biniyor.
        Sayfa başına birden fazla bilgi bloğu eklenince (mizaç/bio/sahip
        teaser'ı) üst sıradaki bloklar önceden yalnızca tek satırlık içerik
        için ayarlanmış gradyanın zayıf kaldığı bölgeye düşüyordu. Üç durak +
        daha yüksek tepe opaklık, kartta kaç blok olursa olsun okunurluğu
        koruyor.
      */}
      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.55)", "rgba(0,0,0,0.88)"]}
        locations={[0.1, 0.5, 1]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "75%" }}
      />

      {activity ? (
        <View className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5">
          <View className="h-2 w-2 rounded-full bg-accent" />
          <Text className="text-[11px] font-bold text-white">{activity}</Text>
        </View>
      ) : null}

      {showCompatibility ? (
        <View
          style={shadowSm}
          // top-16: `app/(app)/index.tsx` bu kartın ÜSTÜNE, aynı `right-3
          // top-3` köşesine güvenlik düğmesini biniyor (ayrı bir sorumluluk,
          // kart bunu bilmiyor) — ikisi çakışmasın diye rozet bir satır
          // aşağıda duruyor.
          className="absolute right-3 top-16 flex-row items-center gap-1 rounded-full bg-white/95 px-3 py-1.5"
        >
          <Ionicons name="sparkles" size={13} color="#1E9384" />
          <Text className="text-xs font-bold text-accent-dark">%{compatibility} uyum</Text>
        </View>
      ) : null}

      {/*
        `key`: fotoğraf sayfası değişince bu bloğun içeriği (hangi çipler/
        bio/sahip teaser'ı gösterileceği) tamamen değişiyor — `key` React'a
        eskiyi güncellemek yerine yeniden mount etmesini söylüyor.
      */}
      <View
        key={`bottom-${card.id}-${photoIndex}`}
        className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-10"
      >
        {currentExtra.length > 0 ? (
          <View className="mb-2.5 gap-1.5">
            {currentExtra.map((node, i) => (
              <View key={i}>{node}</View>
            ))}
          </View>
        ) : null}
        <View className="flex-row items-end justify-between gap-3">
          <View className="flex-1">
            <View className="flex-row items-center gap-2">
              <Text className="text-[26px] font-bold text-white" numberOfLines={1}>
                {card.name}
              </Text>
              <Ionicons
                name={card.gender === "female" ? "female" : "male"}
                color={card.gender === "female" ? "#FFB6D0" : "#AFC9F2"}
                size={19}
              />
            </View>
            {details ? (
              <Text className="mt-0.5 text-sm font-semibold text-white/90" numberOfLines={1}>
                {details}
              </Text>
            ) : null}
          </View>
          {showDistance ? (
            <View className="flex-row items-center gap-1 rounded-full bg-white/20 px-2.5 py-1.5">
              <Ionicons name="location-outline" color="#FFFFFF" size={13} />
              <Text className="text-[11px] font-bold text-white">
                {distanceLabel(card.distanceBucket)}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
