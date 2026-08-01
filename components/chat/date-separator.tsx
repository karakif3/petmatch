import { Text, View } from "react-native";

import { localDateKey } from "../../core/domain/chat-items";
import { getIntlLocale } from "../../core/i18n";

/**
 * "Bugün" / "Dün" / tam tarih.
 *
 * Yıl yalnızca içinde bulunduğumuz yıldan farklıysa yazılıyor — aynı yıl
 * içindeki her ayraçta "2026" tekrar etmesi gereksiz gürültü.
 */
export function dateLabel(isoDate: string): string {
  const date = new Date(isoDate);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (localDateKey(isoDate) === localDateKey(today.toISOString())) return "Bugün";
  if (localDateKey(isoDate) === localDateKey(yesterday.toISOString())) return "Dün";

  return date.toLocaleDateString(getIntlLocale(), {
    day: "numeric",
    month: "long",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  });
}

export function DateSeparator({ isoDate }: { isoDate: string }) {
  return (
    <View className="my-3 items-center" accessibilityRole="text">
      <View className="rounded-full bg-bg-tertiary px-3 py-1.5">
        <Text className="text-xs font-semibold text-text-secondary">{dateLabel(isoDate)}</Text>
      </View>
    </View>
  );
}
