import { StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { listConversations } from "../../core/api/conversations";
import { loadPendingLikesCount } from "../../core/api/likes";
import { useAuthStore } from "../../stores/auth";

/**
 * Sekme ikonu: seçiliyken DOLU, değilken ÇİZGİ (outline) yüz + seçili
 * olanın arkasında marka renginde bir hap.
 *
 * Önceki hâlde dört ikon da her zaman DOLU'ydu ve aktiflik yalnızca renkle
 * anlatılıyordu — bu, "amatör" hissinin ikon tarafındaki kaynağıydı:
 * dolu bir ikon görsel olarak ağırdır, dördü birden aynı ağırlıkta durunca
 * hiyerarşi kalmıyor ve renk körlüğünde aktif sekme hiç okunmuyor. iOS'un
 * kendi kalıbı (SF Symbols'ta olduğu gibi) ağırlık + renk ikilisidir.
 */
function TabIcon({
  name,
  color,
  focused,
}: {
  name: "paw" | "heart" | "chatbubble" | "person";
  color: string;
  focused: boolean;
}) {
  return (
    <View
      className={`h-8 min-w-[56px] items-center justify-center rounded-full ${
        focused ? "bg-brand/10" : ""
      }`}
    >
      <Ionicons name={focused ? name : `${name}-outline`} color={color} size={22} />
    </View>
  );
}

export default function AppLayout() {
  const user = useAuthStore((state) => state.user);

  // Aynı sorgu anahtarları Beğeniler/Eşleşmeler ekranlarının kendisiyle
  // paylaşılıyor (`likes.tsx`, `matches.tsx`) — React Query önbelleği
  // ortak, ekstra ağ isteği yok; o ekranlar odağa girince zaten tazeliyor.
  const likesCount = useQuery({
    queryKey: ["pending-likes", "count"],
    queryFn: loadPendingLikesCount,
    enabled: Boolean(user),
  });
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: listConversations,
    enabled: Boolean(user),
  });
  const unreadTotal = (conversations.data ?? []).reduce(
    (sum, conversation) => sum + conversation.unreadCount,
    0,
  );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#F97362",
        tabBarInactiveTintColor: "#9A8B82",
        tabBarStyle: {
          backgroundColor: "#FFFFFF",
          // Varsayılan 1pt kenarlık retina ekranda kalın bir çizgi olarak
          // okunuyordu; saç teli kalınlığı + daha açık renk, çubuğu
          // ekrandan ayırmaya yetiyor.
          borderTopColor: "#F5EAE2",
          borderTopWidth: StyleSheet.hairlineWidth,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: "Inter_600SemiBold",
          fontSize: 11,
          letterSpacing: 0.1,
          marginTop: 2,
        },
        tabBarBadgeStyle: {
          backgroundColor: "#F97362",
          fontFamily: "Inter_700Bold",
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Keşfet",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="paw" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: "Beğeniler",
          tabBarBadge: likesCount.data ? likesCount.data : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="heart" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="matches"
        options={{
          // Ekran içeriği konuşma listesi; sekme adı ile ekran başlığı
          // önceden ayrışıyordu ("Eşleşmeler" ↔ "Mesajlar") ve "Eşleşmeler"
          // Beğeniler sekmesiyle karışıyordu. Tek isim: Mesajlar.
          title: "Mesajlar",
          tabBarBadge: unreadTotal ? unreadTotal : undefined,
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="chatbubble" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, focused }) => (
            <TabIcon name="person" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
