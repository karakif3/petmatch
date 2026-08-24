import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import { AppIcon } from "../ui/icon";

import { AppPressable } from "../ui/pressable";

/**
 * Hazır açılışlar.
 *
 * Hepsi bilerek PET üzerinden konuşuyor: ürünün vaadi "petler tanıştırır"
 * olduğu için sohbetin tonunu da pet belirlemeli. Bu aynı zamanda insan
 * katmanındaki beklenti uyuşmazlığını azaltan en ucuz araç.
 */
export const quickReplies = [
  {
    label: "Tanışma mesajı",
    text: "Merhaba! 🐾 Petin en çok nasıl oyun oynamayı seviyor?",
    icon: "sparkles" as const,
  },
  {
    label: "Buluşma planla",
    text: "Bir pet buluşması planlayalım mı? Uygun olduğun gün ve saat nedir? İlk buluşma için halka açık bir yer seçebiliriz. 🐾",
    icon: "calendar" as const,
  },
  {
    label: "Uyumluluk sor",
    text: "Buluşmadan önce aşı, enerji seviyesi ve diğer petlerle iletişimi hakkında paylaşmak istediğin bir şey var mı?",
    icon: "paw-print" as const,
  },
];

/**
 * Yazma alanının üstündeki yatay öneri şeridi.
 *
 * `leading`: "Buluşma yeri" düğmesi önceden bu şeridin YANINDA, ayrı bir
 * `flex-row` kardeşiydi — kendi genişliğini alıp şeridi sıkıştırıyordu.
 * Aynı yatay kaydırılabilir şeridin İLK öğesi olarak veriliyor artık;
 * ikisi de "hızlı eylem" kategorisinde, ayrı bir bölüm olmayı gerektirmiyor.
 */
export function QuickReplyBar({
  replies = quickReplies,
  onSelect,
  leading,
}: {
  replies?: typeof quickReplies;
  onSelect: (text: string) => void;
  leading?: ReactNode;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: 8 }}
    >
      {leading}
      {replies.map((reply) => (
        <AppPressable
          key={reply.label}
          onPress={() => onSelect(reply.text)}
          accessibilityRole="button"
          accessibilityLabel={`Hazır mesaj: ${reply.label}`}
          className="min-h-11 flex-row items-center justify-center rounded-full border border-border bg-bg-secondary px-3"
        >
          <AppIcon name={reply.icon} color="#E0523F" size={16} />
          <Text className="ml-1.5 text-xs font-semibold text-text-secondary">{reply.label}</Text>
        </AppPressable>
      ))}
    </ScrollView>
  );
}

/** Boş sohbette gösterilen dikey öneri listesi. */
export function QuickReplyStarters({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <View className="mt-5 w-full gap-2">
      {quickReplies.map((reply) => (
        <AppPressable
          key={reply.label}
          onPress={() => onSelect(reply.text)}
          accessibilityRole="button"
          accessibilityLabel={`Hazır mesaj: ${reply.label}`}
          className="min-h-12 flex-row items-center rounded-2xl border border-border bg-surface px-4 py-3"
        >
          <AppIcon name={reply.icon} color="#F97362" size={18} />
          <Text className="ml-2.5 flex-1 text-sm font-semibold text-text-primary">
            {reply.label}
          </Text>
          <AppIcon name="chevron-right" color="#C4B7AE" size={16} />
        </AppPressable>
      ))}
    </View>
  );
}
