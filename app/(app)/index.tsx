import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "@tanstack/react-query";

import { DiscoveryCard } from "../../components/discovery-card";
import { loadDiscoveryDeck, swipePet } from "../../core/api/discovery";
import type { SwipeDirection } from "../../core/domain/types";
import { useAuthStore } from "../../stores/auth";

export default function DiscoverScreen() {
  const user = useAuthStore((state) => state.user);
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [matchName, setMatchName] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);

  const deck = useQuery({
    queryKey: ["discovery", user?.id],
    queryFn: () => loadDiscoveryDeck(user!.id),
    enabled: Boolean(user),
  });

  const visibleCards = useMemo(
    () => deck.data?.cards.filter((card) => !dismissedIds.includes(card.id)) ?? [],
    [deck.data?.cards, dismissedIds],
  );
  const currentCard = visibleCards[0] ?? null;

  useEffect(() => {
    setDismissedIds([]);
  }, [deck.dataUpdatedAt]);

  const swipe = useMutation({
    mutationFn: async ({
      toPetId,
      direction,
    }: {
      toPetId: string;
      direction: SwipeDirection;
    }) => {
      const viewer = deck.data?.viewer;
      if (!viewer) throw new Error("Aktif pet bulunamadı.");
      const matchId = await swipePet({
        fromPetId: viewer.id,
        toPetId,
        direction,
      });
      return { direction, matchId, toPetId };
    },
    onSuccess: ({ direction, matchId, toPetId }) => {
      const swipedCard = deck.data?.cards.find((card) => card.id === toPetId);
      setDismissedIds((ids) => [...ids, toPetId]);
      setError(null);
      if (direction === "like" && matchId && swipedCard) setMatchName(swipedCard.name);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error ? mutationError.message : "Beğeni kaydedilemedi.",
      );
    },
  });

  const handleSwipe = (direction: SwipeDirection) => {
    if (!currentCard || swipe.isPending) return;
    swipe.mutate({ toPetId: currentCard.id, direction });
  };

  const refresh = async () => {
    setDismissedIds([]);
    setMatchName(null);
    setError(null);
    await deck.refetch();
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <ScrollView
        ref={scrollRef}
        contentContainerClassName="flex-grow px-5 pb-8 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={deck.isRefetching}
            onRefresh={refresh}
            tintColor="#F97362"
          />
        }
      >
        <View className="mb-5 flex-row items-center justify-between">
          <View>
            <Text className="text-2xl font-bold text-text-primary">Keşfet</Text>
            <Text className="mt-1 text-sm text-text-secondary">
              Yakınındaki uyumlu oyun arkadaşları
            </Text>
          </View>
          {deck.data?.viewer ? (
            <View className="flex-row items-center gap-2 rounded-full border border-border bg-surface px-3 py-2">
              <Ionicons name="paw" color="#F97362" size={16} />
              <Text className="text-xs font-semibold text-text-primary">
                {deck.data.viewer.name}
              </Text>
            </View>
          ) : null}
        </View>

        {matchName ? (
          <View className="mb-4 flex-row items-center justify-between rounded-2xl bg-accent px-4 py-3">
            <View className="flex-1">
              <Text className="font-bold text-white">Yeni eşleşme! 🎉</Text>
              <Text className="mt-0.5 text-sm text-white/90">
                {matchName} da seni beğenmiş.
              </Text>
            </View>
            <Pressable onPress={() => setMatchName(null)} hitSlop={12}>
              <Ionicons name="close" color="#FFFFFF" size={21} />
            </Pressable>
          </View>
        ) : null}

        {deck.isLoading ? (
          <View className="flex-1 items-center justify-center py-24">
            <ActivityIndicator color="#F97362" size="large" />
            <Text className="mt-4 text-sm text-text-secondary">Uyumlu petler aranıyor…</Text>
          </View>
        ) : null}

        {deck.isError ? (
          <View className="flex-1 items-center justify-center rounded-3xl border border-danger/20 bg-danger/5 px-8 py-16">
            <Ionicons name="cloud-offline-outline" color="#E5484D" size={42} />
            <Text className="mt-4 text-center text-lg font-bold text-text-primary">
              Keşfet yüklenemedi
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
              {deck.error instanceof Error ? deck.error.message : "Bağlantını kontrol edip tekrar dene."}
            </Text>
            <Pressable onPress={refresh} className="mt-5 rounded-xl bg-brand px-5 py-3">
              <Text className="font-semibold text-white">Tekrar dene</Text>
            </Pressable>
          </View>
        ) : null}

        {!deck.isLoading && !deck.isError && !deck.data?.viewer ? (
          <View className="flex-1 items-center justify-center px-8 py-20">
            <Ionicons name="paw-outline" color="#C4B7AE" size={54} />
            <Text className="mt-4 text-center text-xl font-bold text-text-primary">
              Aktif pet bulunamadı
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
              Keşfet’i kullanmak için profilinden aktif bir pet seçmelisin.
            </Text>
          </View>
        ) : null}

        {!deck.isLoading && !deck.isError && deck.data?.viewer && !currentCard ? (
          <View className="flex-1 items-center justify-center px-8 py-20">
            <Ionicons name="checkmark-circle-outline" color="#2FB8A6" size={56} />
            <Text className="mt-4 text-center text-xl font-bold text-text-primary">
              Şimdilik bu kadar
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
              Yeni oyun arkadaşları geldiğinde burada görünecek.
            </Text>
            <Pressable onPress={refresh} className="mt-5 rounded-xl border border-border bg-surface px-5 py-3">
              <Text className="font-semibold text-text-primary">Desteyi yenile</Text>
            </Pressable>
          </View>
        ) : null}

        {currentCard ? (
          <>
            <DiscoveryCard card={currentCard} />

            {error ? (
              <View className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3">
                <Text className="text-center text-sm text-danger">{error}</Text>
              </View>
            ) : null}

            <View className="mt-5 flex-row items-center justify-center gap-6">
              <Pressable
                onPress={() => handleSwipe("pass")}
                disabled={swipe.isPending}
                accessibilityLabel="Geç"
                className="h-16 w-16 items-center justify-center rounded-full border border-border bg-surface shadow-sm disabled:opacity-50"
              >
                <Ionicons name="close" color="#9A8B82" size={32} />
              </Pressable>
              <Pressable
                onPress={() => handleSwipe("like")}
                disabled={swipe.isPending}
                accessibilityLabel="Beğen"
                className="h-20 w-20 items-center justify-center rounded-full bg-brand shadow-sm disabled:opacity-50"
              >
                {swipe.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="heart" color="#FFFFFF" size={36} />
                )}
              </Pressable>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
