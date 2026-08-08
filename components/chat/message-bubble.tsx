import { useEffect, useState } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

import type { ChatMessage } from "../../core/api/conversations";
import { getIntlLocale } from "../../core/i18n";

export function messageTime(value: string): string {
  return new Date(value).toLocaleTimeString(getIntlLocale(), {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Tek mesaj balonu.
 *
 * `grouped`, aynı gönderenin ardışık mesajlarında köşeleri yumuşatıp aradaki
 * boşluğu daraltıyor; hangi mesajın gruplu olduğuna `core/domain/chat-items`
 * karar veriyor. Okundu bilgisi yalnızca kendi SON mesajında gösteriliyor —
 * her balonda tekrar etmesi gürültü yaratıyor.
 *
 * **Giriş animasyonu süs değil, durum bildirimi.** Gönderilen mesaj sağdan,
 * gelen mesaj soldan yaylanarak giriyor; yön kimin yazdığını hareketin
 * kendisiyle söylüyor ve realtime'la düşen mesaj "liste birden değişti"
 * yerine "yeni bir şey geldi" gibi okunuyor. Ağ yavaşken en çok merak
 * edilen şey mesajın gidip gitmediği; hareketin varlığı o belirsizliği
 * kapatıyor.
 *
 * Hareket azaltma açıkken animasyon YOK — `match-celebration` ile aynı
 * kural. Balon doğrudan son halinde görünüyor.
 */
export function MessageBubble({
  message,
  mine,
  grouped,
  latestMine,
}: {
  message: ChatMessage;
  mine: boolean;
  grouped: boolean;
  latestMine: boolean;
}) {
  const status = message.readAt ? "Okundu" : "Gönderildi";

  const [animate, setAnimate] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((reduced) => {
        if (!active) return;
        if (reduced) {
          progress.value = 1;
          return;
        }
        setAnimate(true);
        progress.value = withSpring(1, { damping: 18, stiffness: 190 });
      })
      .catch(() => {
        if (active) progress.value = 1;
      });
    return () => {
      active = false;
    };
  }, [progress]);

  const style = useAnimatedStyle(() => ({
    opacity: animate ? withTiming(progress.value, { duration: 140 }) : 1,
    transform: [
      { scale: 0.94 + progress.value * 0.06 },
      { translateX: (mine ? 14 : -14) * (1 - progress.value) },
    ],
  }));

  return (
    <View
      className={`${grouped ? "mb-1" : "mb-2.5"} px-4 ${mine ? "items-end" : "items-start"}`}
      accessible
      accessibilityLabel={`${mine ? "Sen" : "Karşı taraf"}: ${message.body}. ${messageTime(
        message.createdAt,
      )}${latestMine ? `. ${status}` : ""}`}
    >
      <Animated.View
        style={style}
        className={`max-w-[82%] px-4 py-2.5 ${
          mine
            ? `bg-brand ${grouped ? "rounded-2xl rounded-r-md" : "rounded-2xl rounded-br-md"}`
            : `border border-border bg-surface ${
                grouped ? "rounded-2xl rounded-l-md" : "rounded-2xl rounded-bl-md"
              }`
        }`}
      >
        <Text className={`text-[15px] leading-5 ${mine ? "text-white" : "text-text-primary"}`}>
          {message.body}
        </Text>
        <View className="mt-1 flex-row items-center justify-end gap-1">
          <Text className={`text-[11px] ${mine ? "text-white/75" : "text-text-tertiary"}`}>
            {messageTime(message.createdAt)}
          </Text>
          {latestMine ? (
            <>
              <Ionicons
                name={message.readAt ? "checkmark-done" : "checkmark"}
                color={mine ? "rgba(255,255,255,0.8)" : "#9A8B82"}
                size={14}
              />
              <Text className={`text-[11px] ${mine ? "text-white/80" : "text-text-tertiary"}`}>
                {status}
              </Text>
            </>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}
