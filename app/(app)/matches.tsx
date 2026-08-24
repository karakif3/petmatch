import { useCallback } from "react";
import { RefreshControl, Text, View } from "react-native";
import { AppIcon } from "../../components/ui/icon";
// SafeAreaView react-native'den DEĞİL buradan geliyor: deprecated olan
// sürüm iOS 26'da KeyboardAvoidingView zinciriyle birlikte içeriği sıfır
// yüksekliğe düşürüyor ve ekran boş render ediliyordu.
import { SafeAreaView } from "react-native-safe-area-context";
// Gelen kutusu zamanla uzayan tek liste; hücre geri dönüşümü burada gerçekten
// işe yarıyor. Sohbet ekranı bilerek FlatList'te kaldı: orada
// `contentContainerStyle.justifyContent` balonları aşağı yaslıyor ve FlashList
// o prop'u desteklemiyor.
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { AppPressable } from "../../components/ui/pressable";
import { ConversationRowSkeleton } from "../../components/ui/skeleton";
import {
  listConversations,
  type ConversationSummary,
} from "../../core/api/conversations";
import { getIntlLocale } from "../../core/i18n";

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
  return new Date(value).toLocaleDateString(getIntlLocale(), {
    day: "numeric",
    month: "short",
  });
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
    <AppPressable
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
          <AppIcon
            name={conversation.kind === "adoption" ? "house" : "paw-print"}
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
        {/*
          Sıra göstergesi. Hinge'de bu gösterge, konuşmaya dönüşmeden ölen
          eşleşmeleri belirgin şekilde azaltmış — çünkü kullanıcı çoğu zaman
          kötü niyetli değil, sıranın kendisinde olduğunu unutuyor.
          Sunucu bu konuşmaları zaten listenin başına taşıyor.
        */}
        {conversation.isActive && conversation.awaitingMyReply ? (
          <View className="mt-1.5 flex-row items-center">
            <View className="flex-row items-center rounded-full bg-accent/10 px-2 py-0.5">
              <AppIcon name="undo-2" color="#1E9384" size={12} />
              <Text className="ml-1 text-[11px] font-bold text-accent-dark">Sıra sende</Text>
            </View>
          </View>
        ) : null}

        {!conversation.isActive ? (
          <Text className="mt-1 text-xs font-semibold text-text-tertiary">
            Konuşma kapatıldı
          </Text>
        ) : null}
      </View>
    </AppPressable>
  );
}

export default function MatchesScreen() {
  // Zamanlayıcıyla YENİLENMİYOR — Beğeniler'deki aynı gerekçe: burada da
  // sürekli polling hiçbir kullanıcı faydası olmayan bir maliyet. Yerine
  // sekmeye her girişte tazeleme + aşağı çekerek yenileme. Sohbet içindeki
  // gerçek zamanlı sinyaller (yazıyor, okundu) zaten Realtime kullanıyor;
  // burası liste özeti, anlık olması gerekmiyor.
  const conversations = useQuery({
    queryKey: ["conversations"],
    queryFn: listConversations,
  });

  useFocusEffect(
    useCallback(() => {
      void conversations.refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <View className="px-5 pb-4 pt-4">
        <Text className="text-2xl font-bold text-text-primary">Mesajlar</Text>
        <Text className="mt-1 text-sm text-text-secondary">
          Eşleşmelerin ve sahiplendirme konuşmaların
        </Text>
      </View>

      {conversations.isLoading ? (
        <View className="pt-1">
          <ConversationRowSkeleton />
          <ConversationRowSkeleton />
          <ConversationRowSkeleton />
        </View>
      ) : null}

      {conversations.isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <AppIcon name="cloud-off" color="#E5484D" size={44} />
          <Text className="mt-4 text-lg font-bold text-text-primary">
            Konuşmalar yüklenemedi
          </Text>
          <Text className="mt-2 text-center text-sm text-text-secondary">
            {conversations.error instanceof Error
              ? conversations.error.message
              : "Bağlantını kontrol edip tekrar dene."}
          </Text>
          <AppPressable
            onPress={() => conversations.refetch()}
            className="mt-5 rounded-xl bg-brand px-5 py-3"
          >
            <Text className="font-semibold text-white">Tekrar dene</Text>
          </AppPressable>
        </View>
      ) : null}

      {!conversations.isLoading && !conversations.isError ? (
        <FlashList
          data={conversations.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ConversationRow conversation={item} />}
          // `flexGrow: 1` yoksa boş durum FlashList'in doğal (kısa) yüksekliğine
          // sıkışıp tepede kalıyordu — diğer ekranlardaki ortalanmış boş
          // durumlarla tutarsızdı.
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: 24,
            flexGrow: 1,
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
              <AppIcon name="messages-square" color="#C4B7AE" size={54} />
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
