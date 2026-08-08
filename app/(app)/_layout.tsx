import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { listConversations } from "../../core/api/conversations";
import { loadPendingLikesCount } from "../../core/api/likes";
import { useAuthStore } from "../../stores/auth";

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
        tabBarStyle: { backgroundColor: "#FFFFFF", borderTopColor: "#F0E2D8" },
        tabBarLabelStyle: { fontFamily: "Inter_600SemiBold", fontSize: 11 },
        tabBarBadgeStyle: { backgroundColor: "#F97362", fontFamily: "Inter_700Bold" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Keşfet",
          tabBarIcon: ({ color, size }) => <Ionicons name="paw" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="likes"
        options={{
          title: "Beğeniler",
          tabBarBadge: likesCount.data ? likesCount.data : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" color={color} size={size} />,
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
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubbles" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <Ionicons name="person" color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
