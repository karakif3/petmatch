import { useEffect, useState } from "react";
import { AccessibilityInfo, View, type ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

/**
 * Yükleme durumları öncesinde her yerde çıplak `ActivityIndicator` idi —
 * içerik "birden" beliriyordu. Bu üç bileşen, gerçek içeriğin yaklaşık
 * biçimini önceden gösteren nabız atan bloklar üretir (Keşfet kartı,
 * konuşma satırı, beğeni kartı).
 *
 * `AccessibilityInfo.isReduceMotionEnabled()` kontrolü `swipeable-card.tsx`
 * ve `message-bubble.tsx`'teki aynı kalıp — hareket azaltma açıkken nabız
 * durur, blok sabit yarı opaklıkta kalır.
 */
function useReduceMotion(): boolean {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => active && setReduceMotion(value))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  return reduceMotion;
}

function SkeletonBlock({
  className,
  style,
}: {
  className?: string;
  style?: ViewStyle;
}) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(0.6);

  useEffect(() => {
    if (reduceMotion) {
      opacity.value = 0.6;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 750 }),
        withTiming(0.6, { duration: 750 }),
      ),
      -1,
      true,
    );
  }, [opacity, reduceMotion]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      className={`bg-bg-tertiary ${className ?? ""}`}
      style={[style, animatedStyle]}
    />
  );
}

/** Keşfet kartının yerini tutan iskelet — tam kadraj fotoğraf oranıyla aynı. */
export function DiscoveryCardSkeleton() {
  return (
    <View className="w-full overflow-hidden rounded-3xl border border-border bg-surface">
      <SkeletonBlock className="w-full" style={{ aspectRatio: 3 / 4 }} />
    </View>
  );
}

/** Mesajlar listesindeki bir konuşma satırının iskeleti. */
export function ConversationRowSkeleton() {
  return (
    <View className="mx-5 mb-3 flex-row items-center rounded-2xl border border-border bg-surface p-3.5">
      <SkeletonBlock className="rounded-[18px]" style={{ width: 62, height: 62 }} />
      <View className="ml-3 flex-1 gap-2">
        <SkeletonBlock className="rounded-full" style={{ width: "55%", height: 14 }} />
        <SkeletonBlock className="rounded-full" style={{ width: "85%", height: 12 }} />
      </View>
    </View>
  );
}

/** Beğeniler ızgarasındaki bir kartın iskeleti. */
export function LikeCardSkeleton() {
  return <SkeletonBlock className="aspect-[3/4] w-[48%] rounded-2xl" />;
}
