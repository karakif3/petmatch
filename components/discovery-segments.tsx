import { Pressable, Text, View } from "react-native";
import { AppIcon, type AppIconName } from "./ui/icon";

/**
 * Keşfet içi segment — ayrı tab DEĞİL.
 *
 * Sahip katmanını ayrı bir tab yapmak, üç tur önce bilerek sildiğimiz beyan
 * yüzeyini geri getirirdi ve mağaza konumlandırmasını "opsiyonel sahip
 * katmanı olan pet uygulaması"ndan "pet temalı dating app"e çevirirdi.
 * Segment, Keşfet'in içinde kalıyor: navigasyon düzeyinde yer talep etmiyor,
 * ayrı bir varış noktası ima etmiyor.
 *
 * KENDİNİ GİZLER. Yeterli sayıda görünür sahip yoksa hiç render edilmez —
 * sürekli boş duran bir seçenek, uygulamanın ölü olduğunu söyler. Yoğunluk
 * oluşunca kendiliğinden ortaya çıkar; ileride ayrı tab'e terfi ettirmek
 * istenirse ölçüt de bu sayı olur (bkz. docs/goal-model.md).
 */

export type DiscoverySegment = "all" | "owner_visible";

/**
 * Segmentin görünmesi için gereken en az görünür-sahipli kart.
 *
 * Amaç sadece "boş değil" değil, geçtikten sonra ELDE BİR DESTE KALMASI.
 * Tek kartlık bir segment, açıp hemen tükenmek demek.
 */
export const OWNER_SEGMENT_MIN_CARDS = 3;

export function DiscoverySegments({
  current,
  ownerVisibleCount,
  totalCount,
  onChange,
}: {
  current: DiscoverySegment;
  ownerVisibleCount: number;
  totalCount: number;
  onChange: (segment: DiscoverySegment) => void;
}) {
  if (ownerVisibleCount < OWNER_SEGMENT_MIN_CARDS) return null;

  const segments: {
    key: DiscoverySegment;
    label: string;
    count: number;
    icon: AppIconName;
  }[] = [
    { key: "all", label: "Tüm petler", count: totalCount, icon: "paw-print" },
    {
      key: "owner_visible",
      label: "Sahibi görünenler",
      count: ownerVisibleCount,
      icon: "user",
    },
  ];

  return (
    <View className="mb-3 flex-row gap-2">
      {segments.map((segment) => {
        const active = current === segment.key;
        return (
          <Pressable
            key={segment.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={`${segment.label}, ${segment.count} profil`}
            onPress={() => onChange(segment.key)}
            className={`min-h-11 flex-1 items-center justify-center rounded-2xl border px-3 py-2.5 ${
              active ? "border-brand bg-brand/10" : "border-border bg-surface"
            }`}
          >
            <View className="flex-row items-center gap-1.5">
              <AppIcon
                name={segment.icon}
                size={14}
                color={active ? "#E0523F" : "#9A8B82"}
              />
              <Text
                className={`text-xs font-bold ${
                  active ? "text-brand-dark" : "text-text-secondary"
                }`}
              >
                {segment.label}
              </Text>
              <Text
                className={`text-xs ${active ? "text-brand-dark" : "text-text-tertiary"}`}
              >
                {segment.count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
