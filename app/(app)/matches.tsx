import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import {
  listConversations,
  type ConversationSummary,
} from "../../core/api/conversations";

function relativeTime(value: string | null): string {
  if (!value) return "";
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "";

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "şimdi";
  if (minutes < 60) return `${minutes} dk`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} gün`;
  return new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}

function ConversationRow({ conversation }: { conversation: ConversationSummary }) {
  const title =
    conversation.petName ?? conversation.counterpartDisplayName ?? "Konuşma";
  const subtitle =
    conversation.lastMessage ??
    (conversation.kind === "adoption"
      ? "Sahiplendirme konuşması başladı"
      : "Eşleştiniz — ilk mesajı gönder");

  return (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/chat/[conversationId]",
          params: { conversationId: conversation.id },
        })
      }
      className="mx-5 mb-3 flex-row items-center rounded-2xl border border-border bg-surface p-3.5"
    >
      {conversation.petPhotoUrl ? (
        <Image
          source={conversation.petPhotoUrl}
          contentFit="cover"
          style={{ width: 62, height: 62, borderRadius: 18 }}
        />
      ) : (
        <View className="h-[62px] w-[62px] items-center justify-center rounded-[18px] bg-bg-tertiary">
          <Ionicons
            name={conversation.kind === "adoption" ? "home" : "paw"}
            color="#C4B7AE"
            size={28}
          />
        </View>
      )}

      <View className="ml-3 min-w-0 flex-1">
        <View className="flex-row items-center justify-between gap-3">
          <Text className="flex-1 text-base font-bold text-text-primary" numberOfLines={1}>
            {title}
          </Text>
          <Text className="text-xs text-text-tertiary">
            {relativeTime(conversation.lastMessageAt)}
          </Text>
        </View>
        <View className="mt-1 flex-row items-center">
          <Text
            className={`flex-1 text-sm ${
              conversation.unreadCount ? "font-semibold text-text-primary" : "text-text-secondary"
            }`}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
          {conversation.unreadCount > 0 ? (
            <View className="ml-2 min-w-5 items-center rounded-full bg-brand px-1.5 py-0.5">
              <Text className="text-[11px] font-bold text-white">
                {Math.min(conversation.unreadCount, 99)}
              </Text>
            </View>
          ) : null}
        </View>
        {!conversation.isActive ? (
          <Text className="mt-1 text-xs font-semibold text-text-tertiary">
            Konuşma kapatıldı
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function MatchesScreen() {
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: listConversations,
    refetchInterval: 15_000,
  });

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <View className="px-5 pb-4 pt-4">
        <Text className="text-2xl font-bold text-text-primary">Mesajlar</Text>
        <Text className="mt-1 text-sm text-text-secondary">
          Eşleşmelerin ve sahiplendirme konuşmaların
        </Text>
      </View>

      {conversations.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F97362" size="large" />
        </View>
      ) : null}

      {conversations.isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline-outline" color="#E5484D" size={44} />
          <Text className="mt-4 text-lg font-bold text-text-primary">
            Konuşmalar yüklenemedi
          </Text>
          <Text className="mt-2 text-center text-sm text-text-secondary">
            {conversations.error instanceof Error
              ? conversations.error.message
              : "Bağlantını kontrol edip tekrar dene."}
          </Text>
          <Pressable
            onPress={() => conversations.refetch()}
            className="mt-5 rounded-xl bg-brand px-5 py-3"
          >
            <Text className="font-semibold text-white">Tekrar dene</Text>
          </Pressable>
        </View>
      ) : null}

      {!conversations.isLoading && !conversations.isError ? (
        <FlatList
          data={conversations.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationRow conversation={item} />}
          contentContainerStyle={{
            flexGrow: 1,
            paddingTop: 4,
            paddingBottom: 24,
          }}
          refreshControl={
            <RefreshControl
              refreshing={conversations.isRefetching}
              onRefresh={() => conversations.refetch()}
              tintColor="#F97362"
            />
          }
          ListEmptyComponent={
            <View className="flex-1 items-center justify-center px-10">
              <Ionicons name="chatbubbles-outline" color="#C4B7AE" size={54} />
              <Text className="mt-4 text-center text-xl font-bold text-text-primary">
                Henüz konuşma yok
              </Text>
              <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
                Karşılıklı beğeni olduğunda yeni eşleşmen burada görünecek.
              </Text>
            </View>
          }
        />
      ) : null}
    </SafeAreaView>
  );
}
