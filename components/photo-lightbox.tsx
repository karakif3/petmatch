import { Modal, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppIcon } from "./ui/icon";
import { AppPressable } from "./ui/pressable";

/**
 * Sahip galerisi — tam ekran ama `overFullScreen` değil.
 *
 * Eski hali PhotoCarousel'i fill + tap bölgeleriyle sarıyordu: kapatma
 * X'i yutuluyor, alt yığın (Keşfet) deliniyor, GO_BACK işlenmiyordu.
 * Bu görüntüleyici kendi kromuna sahip; fotoğraf `contain` — kareyi
 * doldurmak için kırpmıyor, kapatmak her zaman üst çubuktan.
 */
export function PhotoLightbox({
  visible,
  photoUrls,
  index,
  onIndexChange,
  onClose,
}: {
  visible: boolean;
  photoUrls: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  if (!photoUrls.length) return null;

  const current = Math.min(index, Math.max(0, photoUrls.length - 1));
  const count = photoUrls.length;
  const canPrev = current > 0;
  const canNext = current < count - 1;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black">
        <View
          className="z-20 flex-row items-center justify-between px-4"
          style={{ paddingTop: insets.top + 8 }}
        >
          <Text className="text-sm font-semibold text-white/80">
            {count > 1 ? `${current + 1} / ${count}` : "Fotoğraf"}
          </Text>
          <AppPressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            hitSlop={12}
            className="h-11 w-11 items-center justify-center rounded-full bg-white/15"
          >
            <AppIcon name="x" color="#FFFFFF" size={20} />
          </AppPressable>
        </View>

        <View className="flex-1 flex-row items-center">
          {count > 1 ? (
            <AppPressable
              onPress={() => canPrev && onIndexChange(current - 1)}
              disabled={!canPrev}
              accessibilityRole="button"
              accessibilityLabel="Önceki fotoğraf"
              className="h-full w-14 items-center justify-center disabled:opacity-20"
            >
              <AppIcon name="chevron-left" color="#FFFFFF" size={28} />
            </AppPressable>
          ) : (
            <View className="w-4" />
          )}
          <Image
            source={photoUrls[current]}
            contentFit="contain"
            recyclingKey={photoUrls[current]}
            style={{ flex: 1, height: "100%" }}
          />
          {count > 1 ? (
            <AppPressable
              onPress={() => canNext && onIndexChange(current + 1)}
              disabled={!canNext}
              accessibilityRole="button"
              accessibilityLabel="Sonraki fotoğraf"
              className="h-full w-14 items-center justify-center disabled:opacity-20"
            >
              <AppIcon name="chevron-right" color="#FFFFFF" size={28} />
            </AppPressable>
          ) : (
            <View className="w-4" />
          )}
        </View>

        <AppPressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Kapat"
          style={{ paddingBottom: insets.bottom + 16 }}
          className="items-center pt-3"
        >
          <Text className="text-sm font-semibold text-white/70">Kapat</Text>
        </AppPressable>
      </View>
    </Modal>
  );
}
