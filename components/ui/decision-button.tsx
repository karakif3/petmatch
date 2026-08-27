import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";

import {
  likeHaptic,
  passHaptic,
  superHaptic,
} from "../../core/ui/haptics";
import { DecisionIcons } from "./icon";
import { AppPressable } from "./pressable";

type Variant = "pass" | "like" | "super";

type Spec = {
  size: number;
  iconSize: number;
  strokeWidth: number;
  iconColor: string;
  fill: boolean;
  iconTranslateY: number;
  backgroundColor: string;
  borderColor?: string;
  borderWidth: number;
  gradient: readonly [string, string, string] | null;
  gradientLocations: readonly [number, number, number] | null;
  highlight: boolean;
  highlightOpacity: number;
  ringColor: string | null;
  overlayOpacity: number;
  hitSlop: number;
  shadow: object;
};

/**
 * Geç / beğen / süper — hiyerarşi boyutta değil maddede.
 *
 * Siyah gölge coral dolgunun üstünde çamur duruyordu; gölge rengi
 * düğmenin kendisine boyanıyor. X, Heart'tan optik olarak daha geniş
 * okunduğu için 24 / 26. Boyutlar neredeyse eşit (66) — ürün "kalp
 * daha büyük olsun" demedi.
 *
 * Dolu düğmelerde üst yarıya cam highlight + iç hairline ring: düz
 * dolgu "ikon rozeti", bu ikisi "yüzey" okutuyor.
 */
const SPECS: Record<Variant, Spec> = {
  pass: {
    size: 66,
    iconSize: 24,
    strokeWidth: 2.25,
    iconColor: "#5F534C",
    fill: false,
    iconTranslateY: 0,
    backgroundColor: "#FFFFFF",
    borderColor: "#EADCD1",
    borderWidth: 1,
    gradient: null,
    gradientLocations: null,
    highlight: false,
    highlightOpacity: 0,
    ringColor: null,
    overlayOpacity: 0.05,
    hitSlop: 0,
    shadow: tintedShadow("#8A5A4A", 0.08, 14, 5, 3),
  },
  like: {
    size: 66,
    iconSize: 26,
    strokeWidth: 1.75,
    iconColor: "#FFFFFF",
    fill: true,
    iconTranslateY: -0.5,
    backgroundColor: "#F97362",
    borderWidth: 0,
    gradient: ["#FF9C82", "#F97362", "#EC5442"],
    gradientLocations: [0, 0.52, 1],
    highlight: true,
    highlightOpacity: 0.28,
    ringColor: "rgba(255,255,255,0.22)",
    overlayOpacity: 0.1,
    hitSlop: 0,
    shadow: tintedShadow("#D9432F", 0.32, 18, 7, 8),
  },
  super: {
    size: 46,
    iconSize: 18,
    strokeWidth: 1.75,
    iconColor: "#FFFFFF",
    fill: true,
    iconTranslateY: -0.5,
    backgroundColor: "#F8B23A",
    borderWidth: 0,
    gradient: ["#FDC95F", "#F8B23A", "#F09B14"],
    gradientLocations: [0, 0.5, 1],
    highlight: true,
    highlightOpacity: 0.32,
    ringColor: "rgba(255,255,255,0.25)",
    overlayOpacity: 0.1,
    hitSlop: 6,
    shadow: tintedShadow("#C97F10", 0.26, 12, 5, 6),
  },
};

const ICONS = {
  pass: DecisionIcons.pass,
  like: DecisionIcons.like,
  super: DecisionIcons.superLike,
} as const;

const SPRING = { damping: 15, stiffness: 340, mass: 0.6 } as const;

function tintedShadow(
  color: string,
  opacity: number,
  radius: number,
  offsetY: number,
  elevation: number,
) {
  return Platform.select({
    android: { elevation },
    default: {
      shadowColor: color,
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
  })!;
}

function pressHaptic(variant: Variant) {
  if (variant === "pass") passHaptic();
  else if (variant === "super") superHaptic();
  else likeHaptic();
}

export function DecisionButton({
  variant,
  onPress,
  disabled,
  loading,
  accessibilityLabel,
}: {
  variant: Variant;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  accessibilityLabel: string;
}) {
  const spec = SPECS[variant];
  const Icon = ICONS[variant];
  const scale = useSharedValue(1);
  const overlay = useSharedValue(0);
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

  const springStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const overlayStyle = useAnimatedStyle(() => ({
    opacity: overlay.value,
  }));

  const pressIn = () => {
    if (disabled) return;
    pressHaptic(variant);
    if (!reduceMotion) scale.value = withSpring(0.92, SPRING);
    overlay.value = withTiming(spec.overlayOpacity, { duration: 90 });
  };

  const pressOut = () => {
    if (!reduceMotion) scale.value = withSpring(1, SPRING);
    overlay.value = withTiming(0, { duration: 140 });
  };

  const radius = spec.size / 2;

  return (
    <Animated.View
      style={[
        springStyle,
        spec.shadow,
        {
          width: spec.size,
          height: spec.size,
          borderRadius: radius,
          // Android `elevation` opak bir zemin olmadan gölge çizemez;
          // dolgu iç View'da kalınca dıştaki elevation kayboluyordu.
          backgroundColor: spec.backgroundColor,
        },
      ]}
    >
      {/*
        Kırpma Pressable'da değil: iOS'ta Pressable `overflow: hidden` +
        `borderRadius` kombinasyonunu daireye çevirmiyor.

        İkon da Pressable'ın çocuğu değil. Lucide SVG Yoga'da 0×0
        ölçülüyor; Pressable içine koyunca X/yıldız/kalp sol üste
        yapışıyordu. Sabit boyutlu katman ortaya oturtuyor, Pressable
        yalnızca dokunma hedefi.
      */}
      <View
        pointerEvents="box-none"
        style={{
          width: spec.size,
          height: spec.size,
          borderRadius: radius,
          overflow: "hidden",
          backgroundColor: spec.backgroundColor,
          borderWidth: spec.borderWidth,
          borderColor: spec.borderColor,
        }}
      >
        {spec.gradient ? (
          <LinearGradient
            pointerEvents="none"
            colors={[...spec.gradient]}
            locations={[...spec.gradientLocations!]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFillObject}
          />
        ) : null}
        {spec.highlight ? (
          <LinearGradient
            pointerEvents="none"
            colors={[
              `rgba(255,255,255,${spec.highlightOpacity})`,
              "rgba(255,255,255,0)",
            ]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={{
              position: "absolute",
              top: 1,
              left: 1,
              right: 1,
              height: spec.size * 0.5,
              borderTopLeftRadius: radius,
              borderTopRightRadius: radius,
            }}
          />
        ) : null}
        {spec.ringColor ? (
          <View
            pointerEvents="none"
            style={{
              ...StyleSheet.absoluteFillObject,
              borderRadius: radius,
              borderWidth: 1,
              borderColor: spec.ringColor,
            }}
          />
        ) : null}
        <Animated.View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFillObject,
            overlayStyle,
            { backgroundColor: "#000" },
          ]}
        />
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            width: spec.size,
            height: spec.size,
            alignItems: "center",
            justifyContent: "center",
            transform: [{ translateY: spec.iconTranslateY }],
          }}
        >
          {loading ? (
            <ActivityIndicator color={spec.iconColor} />
          ) : (
            <Icon
              color={spec.iconColor}
              size={spec.iconSize}
              width={spec.iconSize}
              height={spec.iconSize}
              strokeWidth={spec.strokeWidth}
              fill={spec.fill ? spec.iconColor : "none"}
            />
          )}
        </View>
        <AppPressable
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
          disabled={disabled}
          disablePressFeedback
          hitSlop={spec.hitSlop || undefined}
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          style={{ width: spec.size, height: spec.size }}
        />
      </View>
    </Animated.View>
  );
}
