import { useEffect, useState } from "react";
import { AccessibilityInfo, Modal, Pressable, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  cancelAnimation,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

/**
 * Eşleşme kutlaması.
 *
 * Ürünün farkı burada görünür olmalı: kutlanan şey iki insanın birbirini
 * beğenmesi değil, İKİ PETİN tanışması. Metin ve görsel hiyerarşi bu yüzden
 * pet adları ve fotoğrafları üzerine kurulu.
 *
 * Önceki hali destenin üstünde küçük bir şeritti — kolayca kaçıyordu ve
 * hiçbir yere götürmüyordu. Kutlamanın asıl işi tek bir sonraki adımı
 * apaçık hale getirmek: mesaj göndermek.
 */

const PAW_POSITIONS = [
  { left: "12%", delay: 0, size: 22 },
  { left: "28%", delay: 260, size: 16 },
  { left: "48%", delay: 120, size: 26 },
  { left: "68%", delay: 380, size: 18 },
  { left: "84%", delay: 200, size: 20 },
] as const;

function FloatingPaw({
  left,
  delay,
  size,
  enabled,
}: {
  left: string;
  delay: number;
  size: number;
  enabled: boolean;
}) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      cancelAnimation(progress);
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 2600 }), -1, false),
    );
    return () => cancelAnimation(progress);
  }, [delay, enabled, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value < 0.15 ? progress.value / 0.15 : 1 - progress.value,
    transform: [
      { translateY: -progress.value * 260 },
      { rotate: `${progress.value * 40 - 20}deg` },
    ],
  }));

  if (!enabled) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", bottom: 0, left: left as never }, style]}
    >
      <Ionicons name="paw" size={size} color="rgba(255,255,255,0.55)" />
    </Animated.View>
  );
}

function PetAvatar({
  photoUrl,
  ownerPhotoUrl,
  name,
  from,
  animate,
  visible,
}: {
  photoUrl: string | null;
  /** Sahip görünürlüğü zaten yukarıda çözülmüş geliyor — burada ekstra kural yok. */
  ownerPhotoUrl: string | null;
  name: string;
  from: "left" | "right";
  animate: boolean;
  visible: boolean;
}) {
  const offset = useSharedValue(animate ? (from === "left" ? -60 : 60) : 0);
  const scale = useSharedValue(animate ? 0.6 : 1);

  useEffect(() => {
    if (!visible) return;
    if (!animate) {
      offset.value = 0;
      scale.value = 1;
      return;
    }
    offset.value = from === "left" ? -60 : 60;
    scale.value = 0.6;
    offset.value = withSpring(0, { damping: 12, stiffness: 140 });
    scale.value = withSequence(
      withSpring(1.08, { damping: 10, stiffness: 160 }),
      withSpring(1, { damping: 14, stiffness: 160 }),
    );
  }, [animate, from, offset, scale, visible]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: offset.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View style={style} className="items-center">
      <View className="relative">
        <View className="h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-bg-tertiary">
          {photoUrl ? (
            <Image
              source={photoUrl}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              transition={200}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View className="h-full w-full items-center justify-center">
              <Ionicons name="paw" size={34} color="#C4B7AE" />
            </View>
          )}
        </View>
        {ownerPhotoUrl ? (
          <View className="absolute bottom-0 right-0 h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-bg-tertiary">
            <Image
              source={ownerPhotoUrl}
              style={{ width: "100%", height: "100%" }}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          </View>
        ) : null}
      </View>
      <Text
        className="mt-2 max-w-28 text-center text-sm font-bold text-white"
        numberOfLines={1}
      >
        {name}
      </Text>
    </Animated.View>
  );
}

export function MatchCelebration({
  visible,
  viewerPetName,
  viewerPhotoUrl,
  viewerOwnerPhotoUrl,
  matchedPetName,
  matchedPhotoUrl,
  matchedOwnerPhotoUrl,
  canOpenChat,
  chatError,
  onSendMessage,
  onKeepBrowsing,
  onRetry,
}: {
  visible: boolean;
  viewerPetName: string;
  viewerPhotoUrl: string | null;
  viewerOwnerPhotoUrl: string | null;
  matchedPetName: string;
  matchedPhotoUrl: string | null;
  matchedOwnerPhotoUrl: string | null;
  /** Konuşma henüz çözülmediyse birincil eylem beklemede gösterilir. */
  canOpenChat: boolean;
  chatError: boolean;
  onSendMessage: () => void;
  onKeepBrowsing: () => void;
  onRetry: () => void;
}) {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (!visible) {
      setAnimate(false);
      return;
    }

    // Hareket azaltma tercihini olan kullanıcıya sabit bir sahne gösteriyoruz.
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((reduceMotion) => {
      if (!cancelled) setAnimate(!reduceMotion);
    });

    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    AccessibilityInfo.announceForAccessibility(
      `${viewerPetName} ve ${matchedPetName} eşleşti.`,
    );

    return () => {
      cancelled = true;
    };
  }, [matchedPetName, viewerPetName, visible]);

  useEffect(() => {
    if (visible && canOpenChat) {
      AccessibilityInfo.announceForAccessibility("Sohbet hazır. Mesaj gönderebilirsin.");
    }
  }, [canOpenChat, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onKeepBrowsing}
      statusBarTranslucent
    >
      <View
        className="flex-1 items-center justify-center bg-brand/95 px-7"
        accessibilityViewIsModal
      >
        {PAW_POSITIONS.map((paw) => (
          <FloatingPaw key={paw.left} {...paw} enabled={visible && animate} />
        ))}

        {/*
          Emoji DEĞİL: uygulamanın global fontu Inter ve emoji glifi
          içermiyor — 🎉 cihazda "?" kutusu olarak çıkıyordu. Eşleşme
          kutlaması ürünün en yüksek duygulu anı; orada tofu göstermek
          anın tamamını bozar. Ionicons zaten her yerde kullanılıyor.
        */}
        <View className="items-center">
          <Ionicons name="sparkles" size={40} color="#FFFFFF" />
        </View>
        <Text
          className="mt-3 text-center text-3xl font-bold text-white"
          accessibilityRole="header"
        >
          Tanıştılar!
        </Text>
        <Text className="mt-2 text-center text-base leading-6 text-white/90">
          {viewerPetName} ve {matchedPetName} birbirini beğendi.
        </Text>

        <View className="mt-8 flex-row items-start justify-center gap-4">
          <PetAvatar
            photoUrl={viewerPhotoUrl}
            ownerPhotoUrl={viewerOwnerPhotoUrl}
            name={viewerPetName}
            from="left"
            animate={animate}
            visible={visible}
          />
          <View className="h-28 items-center justify-center">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-white">
              <Ionicons name="heart" size={20} color="#F97362" />
            </View>
          </View>
          <PetAvatar
            photoUrl={matchedPhotoUrl}
            ownerPhotoUrl={matchedOwnerPhotoUrl}
            name={matchedPetName}
            from="right"
            animate={animate}
            visible={visible}
          />
        </View>

        <View className="mt-10 w-full">
          <Pressable
            onPress={chatError ? onRetry : onSendMessage}
            disabled={!canOpenChat && !chatError}
            accessibilityRole="button"
            accessibilityLabel={
              chatError ? "Sohbeti hazırlamayı tekrar dene" : `${matchedPetName} ile sohbeti aç`
            }
            className="min-h-12 flex-row items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 disabled:opacity-60"
          >
            <Ionicons name="chatbubble-ellipses" size={18} color="#F97362" />
            <Text className="text-base font-bold text-brand">
              {chatError
                ? "Tekrar dene"
                : canOpenChat
                  ? "Mesaj gönder"
                  : "Sohbet hazırlanıyor…"}
            </Text>
          </Pressable>

          {chatError ? (
            <Text className="mt-2 text-center text-xs leading-4 text-white/90">
              Sohbet şu anda hazırlanamadı. Eşleşmen kaydedildi.
            </Text>
          ) : null}

          <Pressable
            onPress={onKeepBrowsing}
            accessibilityRole="button"
            className="mt-3 min-h-12 items-center justify-center py-3"
          >
            <Text className="text-sm font-semibold text-white/90">
              Keşfetmeye devam et
            </Text>
          </Pressable>

        </View>
      </View>
    </Modal>
  );
}
