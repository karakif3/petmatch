import { Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
    icon: "sparkles-outline" as const,
  },
  {
    label: "Buluşma planla",
    text: "Bir pet buluşması planlayalım mı? Uygun olduğun gün ve saat nedir? İlk buluşma için halka açık bir yer seçebiliriz. 🐾",
    icon: "calendar-outline" as const,
  },
  {
    label: "Uyumluluk sor",
    text: "Buluşmadan önce aşı, enerji seviyesi ve diğer petlerle iletişimi hakkında paylaşmak istediğin bir şey var mı?",
    icon: "paw-outline" as const,
  },
];

/** Yazma alanının üstündeki yatay öneri şeridi. */
export function QuickReplyBar({
  replies = quickReplies,
  onSelect,
}: {
  replies?: typeof quickReplies;
  onSelect: (text: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ paddingHorizontal: 12, gap: 8, paddingBottom: 8 }}
    >
      {replies.map((reply) => (
        <Pressable
          key={reply.label}
          onPress={() => onSelect(reply.text)}
          accessibilityRole="button"
          accessibilityLabel={`Hazır mesaj: ${reply.label}`}
          className="min-h-11 flex-row items-center justify-center rounded-full border border-border bg-bg-secondary px-3"
        >
          <Ionicons name={reply.icon} color="#E0523F" size={16} />
          <Text className="ml-1.5 text-xs font-semibold text-text-secondary">{reply.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/** Boş sohbette gösterilen dikey öneri listesi. */
export function QuickReplyStarters({ onSelect }: { onSelect: (text: string) => void }) {
  return (
    <View className="mt-5 w-full gap-2">
      {quickReplies.map((reply) => (
        <Pressable
          key={reply.label}
          onPress={() => onSelect(reply.text)}
          accessibilityRole="button"
          accessibilityLabel={`Hazır mesaj: ${reply.label}`}
          className="min-h-12 flex-row items-center rounded-2xl border border-border bg-surface px-4 py-3"
        >
          <Ionicons name={reply.icon} color="#F97362" size={18} />
          <Text className="ml-2.5 flex-1 text-sm font-semibold text-text-primary">
            {reply.label}
          </Text>
          <Ionicons name="chevron-forward" color="#C4B7AE" size={16} />
        </Pressable>
      ))}
    </View>
  );
}
