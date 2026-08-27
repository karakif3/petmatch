import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import type { DiscoveryDeckCard } from "../core/api/discovery";
import { formatAge } from "../core/domain/age";
import { sizeLabels, temperamentLabels } from "../core/domain/labels";
import { shadowSm } from "../core/ui/shadow";
import { OwnerDiscoverPill } from "./owner-discover-pill";
import { PhotoCarousel } from "./photo-carousel";
import { AppIcon, DecisionIcons } from "./ui/icon";
import { AppPressable } from "./ui/pressable";

const CARD_ASPECT = 3 / 4;

function distanceLabel(bucket: string | null): string | null {
  if (!bucket) return null;
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
    <View className="rounded-full border border-white/15 bg-black/45 px-2.5 py-1">
      <Text className="text-[11px] font-semibold text-white">{children}</Text>
    </View>
  );
}

export function DiscoveryCard({
  card,
  onOpenProfile,
  onOpenOwner,
  fill = false,
}: {
  card: DiscoveryDeckCard;
  /** Kimlik satırına dokununca tam pet profili. */
  onOpenProfile?: () => void;
  /** Sahip hapına dokununca pet profilinin sahip bölümü. */
  onOpenOwner?: () => void;
  /**
   * Keşfet'te kart, başlık ile yüzen düğme şeridi arasındaki BOŞLUĞU
   * dolduruyor (sabit 3:4 değil).
   */
  fill?: boolean;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  useEffect(() => {
    setPhotoIndex(0);
  }, [card.id]);

  const age = formatAge(card.birthDate);
  const activity = activityLabel(card.activityBucket);
  const compatibility = Math.round(card.compatibility.total * 100);
  const details = [card.breed, age, sizeLabels[card.size]].filter(Boolean).join(" · ");

  /*
   * İlk fotoğraf YALNIZCA kimlik: ad, cinsiyet, ırk/yaş/boyut, mesafe.
   * Enerji, kısırlaştırma, mizaç, bio, sahip sonraki karelere dağılır.
   * Tek fotoğrafta o ayrıntılar kartta YOK — profil sayfasına gider.
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
      <Text key="bio" className="text-[13px] leading-5 text-white/90" numberOfLines={2}>
        {card.bio}
      </Text>,
    );
  }

  const photoCount = Math.max(1, card.photoUrls.length);
  const extraPageCount = Math.max(0, photoCount - 1);
  const buckets: ReactNode[][] = Array.from({ length: extraPageCount }, () => []);
  extraBlocks.forEach((block, i) => {
    if (extraPageCount === 0) return;
    buckets[Math.min(i, extraPageCount - 1)].push(block);
  });
  const currentExtra =
    photoIndex === 0 || extraPageCount === 0 ? [] : buckets[photoIndex - 1];

  const identity = (
    <>
      <View className="flex-row items-center gap-2">
        <Text className="text-[28px] font-bold leading-9 text-white" numberOfLines={1}>
          {card.name}
        </Text>
        <AppIcon
          name={card.gender === "female" ? "venus" : "mars"}
          color={card.gender === "female" ? "#FFB6D0" : "#AFC9F2"}
          size={19}
        />
        {onOpenProfile ? (
          <AppIcon name="chevron-right" color="#FFFFFFB3" size={22} />
        ) : null}
      </View>
      {details || distanceLabel(card.distanceBucket) ? (
        <Text className="mt-0.5 text-[13px] font-semibold text-white/85" numberOfLines={1}>
          {[details, distanceLabel(card.distanceBucket)].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
    </>
  );

  return (
    <View
      className={`relative w-full overflow-hidden rounded-3xl border border-border ${
        fill ? "flex-1" : ""
      }`}
      style={[
        { backgroundColor: "#FDEADF" },
        fill ? { flex: 1 } : null,
        shadowSm,
      ]}
    >
      {fill ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#FDEADF" }]} />
      ) : null}
      <PhotoCarousel
        photoUrls={card.photoUrls}
        aspectRatio={CARD_ASPECT}
        fill={fill}
        index={photoIndex}
        onIndexChange={setPhotoIndex}
        onPress={onOpenProfile}
      />

      <LinearGradient
        pointerEvents="none"
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.5)", "rgba(0,0,0,1)"]}
        locations={[0, 0.45, 1]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "75%" }}
      />

      {activity ? (
        <View
          pointerEvents="none"
          className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5"
        >
          <View className="h-2 w-2 rounded-full bg-accent" />
          <Text className="text-[11px] font-bold text-white">{activity}</Text>
        </View>
      ) : null}

      {card.previouslyPassed ? (
        <View
          pointerEvents="none"
          className={`absolute left-3 ${
            activity ? "top-14" : "top-3"
          } flex-row items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5`}
        >
          <AppIcon name="refresh-cw" color="#FFFFFF" size={12} />
          <Text className="text-[11px] font-bold text-white">Daha önce geçtin</Text>
        </View>
      ) : null}

      <View
        pointerEvents="none"
        style={shadowSm}
        className="absolute right-3 top-16 flex-row items-center gap-1 rounded-full bg-white/95 px-3 py-1.5"
      >
        <DecisionIcons.compatibility size={13} color="#1E9384" strokeWidth={2.25} />
        <Text className="text-xs font-bold text-accent-dark">%{compatibility} uyum</Text>
      </View>

      <View
        pointerEvents="box-none"
        key={`bottom-${card.id}-${photoIndex}`}
        className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12"
      >
        {onOpenProfile ? (
          <AppPressable
            onPress={onOpenProfile}
            accessibilityRole="button"
            accessibilityLabel={`${card.name} profilini aç`}
            className="min-h-11 self-start justify-center"
          >
            {identity}
            {photoCount === 1 && extraBlocks.length > 0 ? (
              <Text className="mt-1 text-[11px] font-semibold text-white/70">
                Profilde daha fazla
              </Text>
            ) : null}
          </AppPressable>
        ) : (
          identity
        )}

        {currentExtra.length > 0 ? (
          <View className="mt-2.5 gap-1.5" pointerEvents="box-none">
            {currentExtra.map((node, i) => (
              <View key={i} pointerEvents="box-none">
                {node}
              </View>
            ))}
          </View>
        ) : null}

        {card.owner ? (
          <View className="mt-2.5">
            <OwnerDiscoverPill
              variant="overlay"
              owner={card.owner}
              onPress={onOpenOwner ?? onOpenProfile}
            />
          </View>
        ) : null}
      </View>
    </View>
  );
}
