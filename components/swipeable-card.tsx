import { useEffect, useState } from "react";
import { AccessibilityInfo, Dimensions, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import type { SwipeDirection } from "../core/domain/types";
import { likeHaptic, passHaptic } from "../core/ui/haptics";

const SCREEN_WIDTH = Dimensions.get("window").width;

/** Kararın verildiği kabul edilen yatay mesafe. */
const DECISION_THRESHOLD = SCREEN_WIDTH * 0.28;

/** Bu hızın üstünde kısa bir fiske de karar sayılır. */
const FLICK_VELOCITY = 800;

/** Damganın tam görünür olduğu mesafe. */
const STAMP_FULL_AT = SCREEN_WIDTH * 0.22;

type Props = {
  children: React.ReactNode;
  disabled?: boolean;
  onSwipe: (direction: SwipeDirection) => void;
  /** Kart değişince konumu sıfırlamak için; genelde kartın id'si. */
  resetKey: string;
  /**
   * Sarmalayıcı, kabındaki boşluğu doldursun (Keşfet'te kart artık sabit
   * en-boy oranıyla değil, kalan yükseklikle boyutlanıyor). Sarmalayıcı
   * `flex-1` olmazsa içteki kartın `flex-1`'i bağlanacağı bir yükseklik
   * bulamıyor.
   */
  fill?: boolean;
};

/**
 * Keşfet kartına sağa/sola kaydırma jesti ekler.
 *
 * Bu, tanışma ürününün **imza etkileşimi** ve bugüne kadar hiç yoktu:
 * kullanıcı yalnızca X ve kalp düğmesine basabiliyordu. Kartın parmağı
 * takip etmemesi, ürünü tanıdık bir şeyin ucuz taklidi gibi hissettiriyordu.
 *
 * Üç tasarım kararı:
 *
 * 1. **Düğmeler KALDIRILMIYOR.** Kaydırma keşfedilebilir bir etkileşim
 *    değil ve ekran okuyucuyla kullanılamaz. İkisi bir arada duruyor;
 *    jest hızlı yol, düğmeler erişilebilir yol.
 * 2. **Dikey kaydırmayla çakışmıyor.** Keşfet bir `ScrollView` içinde;
 *    `activeOffsetX` sayesinde jest ancak yatay niyet netleştiğinde
 *    devreye giriyor, sayfa kaydırma bozulmuyor.
 * 3. **Hareket azaltma açıkken dönme yok ve kart uçmuyor.** Parmağı takip
 *    etme kalıyor çünkü o süs değil etkileşimin kendisi; süslü olan dönme
 *    ve uçup gitme kısmı kaldırılıyor.
 *
 * Eşiğe yaklaşırken "BEĞEN"/"GEÇ" damgası beliriyor: kullanıcı bırakmadan
 * önce ne olacağını görüyor. Karar geri alınamaz olduğu için bu önemli.
 */
export function SwipeableCard({ children, disabled, onSwipe, resetKey, fill }: Props) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
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

  // Yeni kart geldiğinde eskisinin konumu kalmasın.
  useEffect(() => {
    translateX.value = 0;
    translateY.value = 0;
  }, [resetKey, translateX, translateY]);

  const finish = (direction: SwipeDirection) => {
    if (direction === "like") likeHaptic();
    else passHaptic();
    onSwipe(direction);
  };

  const pan = Gesture.Pan()
    .enabled(!disabled)
    // Yatay niyet netleşmeden ScrollView'e karışma.
    .activeOffsetX([-12, 12])
    .failOffsetY([-18, 18])
    .onChange((event) => {
      translateX.value += event.changeX;
      translateY.value += event.changeY * 0.35;
    })
    .onEnd((event) => {
      const decided =
        Math.abs(translateX.value) > DECISION_THRESHOLD ||
        Math.abs(event.velocityX) > FLICK_VELOCITY;

      if (!decided) {
        translateX.value = withSpring(0, { damping: 20, stiffness: 200 });
        translateY.value = withSpring(0, { damping: 20, stiffness: 200 });
        return;
      }

      const direction: SwipeDirection = translateX.value > 0 ? "like" : "pass";

      if (reduceMotion) {
        translateX.value = 0;
        translateY.value = 0;
        runOnJS(finish)(direction);
        return;
      }

      const target = (translateX.value > 0 ? 1 : -1) * SCREEN_WIDTH * 1.4;
      translateX.value = withTiming(target, { duration: 220 }, (done) => {
        if (done) runOnJS(finish)(direction);
      });
    });

  const cardStyle = useAnimatedStyle(() => {
    const rotate = reduceMotion
      ? "0deg"
      : `${(translateX.value / SCREEN_WIDTH) * 12}deg`;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { rotate },
      ],
    };
  });

  const likeStamp = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, translateX.value) / STAMP_FULL_AT),
  }));

  const passStamp = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, -translateX.value) / STAMP_FULL_AT),
  }));

  const card = (
    <Animated.View
      style={[
        cardStyle,
        fill ? { flex: 1, zIndex: 2 } : { zIndex: 2 },
      ]}
      className={fill ? "flex-1" : undefined}
    >
      {children}

      {/*
        Damgalar `pointerEvents="none"`: kartın üstündeki güvenlik
        düğmesine dokunmayı engellememeleri gerekiyor.
      */}
      <Animated.View
        pointerEvents="none"
        style={likeStamp}
        className="absolute left-5 top-6 -rotate-12 rounded-xl border-[3px] border-accent px-4 py-1.5"
      >
        <Text className="text-2xl font-extrabold tracking-wider text-accent">
          BEĞEN
        </Text>
      </Animated.View>

      <Animated.View
        pointerEvents="none"
        style={passStamp}
        className="absolute right-5 top-6 rotate-12 rounded-xl border-[3px] border-text-tertiary px-4 py-1.5"
      >
        <Text className="text-2xl font-extrabold tracking-wider text-text-tertiary">
          GEÇ
        </Text>
      </Animated.View>
    </Animated.View>
  );

  return (
    <View style={fill ? { flex: 1 } : undefined}>
      <GestureDetector gesture={pan}>{card}</GestureDetector>
    </View>
  );
}
