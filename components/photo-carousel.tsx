import { View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import { AppPressable } from "./ui/pressable";

type Props = {
  photoUrls: string[];
  aspectRatio: number;
  index: number;
  onIndexChange: (index: number) => void;
};

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
export function PhotoCarousel({ photoUrls, aspectRatio, index, onIndexChange }: Props) {
  const count = photoUrls.length;
  const current = Math.min(index, Math.max(0, count - 1));

  if (count === 0) {
    return (
      <View className="w-full items-center justify-center bg-bg-tertiary" style={{ aspectRatio }}>
        <Ionicons name="paw" color="#C4B7AE" size={72} />
      </View>
    );
  }

  const go = (next: number) => {
    if (next < 0 || next >= count) return;
    onIndexChange(next);
  };

  return (
    // `bg-bg-tertiary`: fotoğraf yüklenemezse (kötü URL, ağ hatası) expo-image
    // hiçbir şey boyamıyor; arka plan olmadan o alan şeffaf kalırdı.
    <View style={{ aspectRatio }} className="w-full bg-bg-tertiary">
      <Image
        source={photoUrls[current]}
        contentFit="cover"
        transition={180}
        style={{ width: "100%", height: "100%" }}
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
        <View className="absolute inset-0 flex-row">
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
