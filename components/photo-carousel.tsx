import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { AppIcon } from "./ui/icon";

import { lightHaptic } from "../core/ui/haptics";
import { AppPressable } from "./ui/pressable";

type Props = {
  photoUrls: string[];
  aspectRatio: number;
  index: number;
  onIndexChange: (index: number) => void;
  /**
   * Açıkken en-boy oranı YOK SAYILIR ve foto kabına yayılır (`flex: 1`).
   * Keşfet'te kart artık ekrandaki boşluğu dolduruyor: sabit 3:4 oranı,
   * kartın alt satırının (ad/mesafe) yüzen düğme şeridinin ALTINA
   * kaymasına yol açıyordu.
   */
  fill?: boolean;
  /** Üst kontrollerin tap alanını karusel gezinmesinden ayırmak için. */
  topTapInset?: number;
};

const CARD_FILL = "#FDEADF";

/**
 * Tinder tarzı fotoğraf karuseli: sol/sağ yarıya dokunarak geçiş, üstte
 * ilerleme çubuğu.
 *
 * KONTROLLÜ bileşen — index üst bileşende (`DiscoveryCard`) yaşıyor.
 * Sebep: her fotoğraf artık sadece görsel değil, üstüne binen bilgi de
 * taşıyor (mizaç/ilgi çekici bilgiler/sahip teaser'ı fotoğraf sayfalarına
 * dağıtılıyor) — DiscoveryCard'ın hangi sayfada olduğumuzu bilmesi gerekiyor.
 *
 * `SwipeableCard`'ın yatay pan jestiyle ÇAKIŞMIYOR: jest yalnızca
 * `activeOffsetX([-12,12])` eşiğini aşan sürüklemelerde devreye giriyor
 * (`components/swipeable-card.tsx`), buradaki dokunma bölgeleri düz
 * `Pressable`'lar — kısa bir dokunuş jestin eşiğine hiç ulaşmıyor.
 */
export function PhotoCarousel({
  photoUrls,
  aspectRatio,
  index,
  onIndexChange,
  fill = false,
  topTapInset = 0,
}: Props) {
  const count = photoUrls.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const frameStyle = fill ? { flex: 1 } : { aspectRatio };

  if (count === 0) {
    return (
      <View
        className="w-full items-center justify-center"
        style={[frameStyle, { backgroundColor: CARD_FILL }]}
      >
        <AppIcon name="paw-print" color="#C4B7AE" size={72} />
      </View>
    );
  }

  const go = (next: number) => {
    // Fotoğraf değişimi küçük bir gezinme adımı: `light`, karar
    // anlarının `medium`'undan bilerek ayrı (bkz. core/ui/haptics.ts).
    lightHaptic();
    onIndexChange((next + count) % count);
  };

  return (
    // Opak dolgu şart: Keşfet destesinde arkadaki kart isim olarak
    // delinmesin. `fill` iken yüzde yükseklik 0 kalabiliyor — Image
    // absoluteFill ile kabı gerçekten kaplar.
    <View
      style={[frameStyle, { backgroundColor: CARD_FILL, overflow: "hidden" }]}
      className="w-full"
    >
      <Image
        source={photoUrls[current]}
        contentFit="cover"
        cachePolicy="memory-disk"
        priority={fill ? "high" : "normal"}
        recyclingKey={photoUrls[current]}
        transition={fill ? 0 : 160}
        style={
          fill
            ? [StyleSheet.absoluteFillObject, { backgroundColor: CARD_FILL }]
            : { width: "100%", aspectRatio, backgroundColor: CARD_FILL }
        }
      />

      {count > 1 ? (
        <View className="absolute left-2.5 right-2.5 top-2.5 flex-row gap-1.5">
          {photoUrls.map((_, photoIndex) => (
            <View
              key={photoIndex}
              className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/35"
            >
              {photoIndex <= current ? <View className="h-full w-full rounded-full bg-white" /> : null}
            </View>
          ))}
        </View>
      ) : null}

      {count > 1 ? (
        <View className="absolute bottom-0 left-0 right-0 flex-row" style={{ top: topTapInset }}>
          <AppPressable
            className="flex-1"
            disablePressFeedback
            accessibilityRole="button"
            accessibilityLabel="Önceki fotoğraf"
            onPress={() => go(current - 1)}
          />
          <AppPressable
            className="flex-1"
            disablePressFeedback
            accessibilityRole="button"
            accessibilityLabel="Sonraki fotoğraf"
            onPress={() => go(current + 1)}
          />
        </View>
      ) : null}
    </View>
  );
}
