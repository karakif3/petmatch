import { Text, View } from "react-native";
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

  return (
    <View
      className={`${grouped ? "mb-1" : "mb-2.5"} px-4 ${mine ? "items-end" : "items-start"}`}
      accessible
      accessibilityLabel={`${mine ? "Sen" : "Karşı taraf"}: ${message.body}. ${messageTime(
        message.createdAt,
      )}${latestMine ? `. ${status}` : ""}`}
    >
      <View
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
      </View>
    </View>
  );
}
