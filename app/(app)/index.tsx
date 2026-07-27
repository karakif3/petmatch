import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DiscoveryCard } from "../../components/discovery-card";
import { DiscoveryFilterModal } from "../../components/discovery-filter-modal";
import { ReportModal } from "../../components/report-modal";
import { SafetyMenuModal } from "../../components/safety-menu-modal";
import {
  loadDiscoveryDeck,
  swipePet,
  updateDiscoveryFilters,
  type DiscoveryFilterSettings,
  type OwnerDiscoveryFilterInput,
} from "../../core/api/discovery";
import { blockUser } from "../../core/api/safety";
import type { SwipeDirection } from "../../core/domain/types";
import { useAuthStore } from "../../stores/auth";
import { trackProductEvent } from "../../core/api/observability";
import { registerForPushNotifications } from "../../core/api/notifications";

export default function DiscoverScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [matchName, setMatchName] = useState<string | null>(null);
  const [safetyVisible, setSafetyVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterBusy, setFilterBusy] = useState(false);
  const [filterReady, setFilterReady] = useState(false);
  const [ownerFilters, setOwnerFilters] = useState<OwnerDiscoveryFilterInput>({
    genders: [],
    minAge: null,
    maxAge: null,
  });
  const scrollRef = useRef<ScrollView>(null);
  const discoveryTrackedRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setFilterReady(false);
    if (!user) return () => undefined;
    void AsyncStorage.getItem(`petmatch:owner-filters:${user.id}`)
      .then((value) => {
        if (!active || !value) return;
        const parsed = JSON.parse(value) as Partial<OwnerDiscoveryFilterInput>;
        const genders = Array.isArray(parsed.genders)
          ? parsed.genders.filter(
              (item): item is "female" | "male" | "other" =>
                item === "female" || item === "male" || item === "other",
            )
          : [];
        setOwnerFilters({
          genders,
          minAge: typeof parsed.minAge === "number" ? parsed.minAge : null,
          maxAge: typeof parsed.maxAge === "number" ? parsed.maxAge : null,
        });
      })
      .catch((storageError) => {
        console.error("Yerel sahip filtreleri okunamadı:", storageError);
      })
      .finally(() => {
        if (active) setFilterReady(true);
      });
    return () => {
      active = false;
    };
  }, [user]);

  const deck = useQuery({
    queryKey: ["discovery", user?.id, ownerFilters],
    queryFn: () => loadDiscoveryDeck(user!.id, ownerFilters),
    enabled: Boolean(user) && filterReady,
  });

  useEffect(() => {
    if (!user || !deck.data || discoveryTrackedRef.current === user.id) return;
    discoveryTrackedRef.current = user.id;
    void trackProductEvent("discovery_viewed", {
      candidateCount: deck.data.cards.length,
    });
  }, [deck.data, user]);

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

  const confirmBlock = () => {
    if (!currentCard) return;
    setSafetyVisible(false);
    Alert.alert(
      "Kullanıcı engellensin mi?",
      `${currentCard.name} ve sahibi artık keşfette görünmez. Varsa konuşmalarınız kapanır.`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Engelle",
          style: "destructive",
          onPress: () => {
            setSafetyBusy(true);
            void blockUser(currentCard.ownerId)
              .then(async () => {
                setDismissedIds((ids) => [...ids, currentCard.id]);
                setError(null);
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ["discovery"] }),
                  queryClient.invalidateQueries({ queryKey: ["conversations"] }),
                ]);
              })
              .catch((blockError) => {
                setError(
                  blockError instanceof Error
                    ? blockError.message
                    : "Kullanıcı engellenemedi.",
                );
              })
              .finally(() => setSafetyBusy(false));
          },
        },
      ],
    );
  };

  const applyFilters = async (
    persistent: DiscoveryFilterSettings,
    local: OwnerDiscoveryFilterInput,
  ) => {
    if (!user) return;
    setFilterBusy(true);
    setError(null);
    try {
      await updateDiscoveryFilters(persistent);
      await AsyncStorage.setItem(
        `petmatch:owner-filters:${user.id}`,
        JSON.stringify(local),
      );
      setOwnerFilters(local);
      setDismissedIds([]);
      setFilterVisible(false);
      await queryClient.invalidateQueries({ queryKey: ["discovery", user.id] });
    } catch (filterError) {
      setError(
        filterError instanceof Error ? filterError.message : "Filtreler kaydedilemedi.",
      );
    } finally {
      setFilterBusy(false);
    }
  };

  const toggleNewCandidateNotification = async () => {
    if (!deck.data) return;
    const enabling = !deck.data.filterSettings.notifyOnNewCandidates;
    if (enabling) {
      const registration = await registerForPushNotifications();
      if (registration.status !== "registered") {
        setError(registration.message);
        return;
      }
    }
    await applyFilters(
      {
        ...deck.data.filterSettings,
        notifyOnNewCandidates: enabling,
      },
      ownerFilters,
    );
  };

  const activeFilterCount =
    Number(deck.data?.filterSettings.species.length !== 2) +
    Number(deck.data?.filterSettings.maxDistanceKm !== 25) +
    Number(
      deck.data?.filterSettings.minPetAgeYears !== null ||
      deck.data?.filterSettings.maxPetAgeYears !== null,
    ) +
    Number(deck.data?.filterSettings.requireVisibleOwner) +
    Number(deck.data?.filterSettings.requirePhoto) +
    Number(deck.data?.filterSettings.requireSocial) +
    Number(deck.data?.filterSettings.requireVerified) +
    Number(ownerFilters.genders.length > 0) +
    Number(ownerFilters.minAge !== null || ownerFilters.maxAge !== null);

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
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => setFilterVisible(true)}
              disabled={!deck.data}
              accessibilityLabel="Keşfet filtreleri"
              className="relative h-10 w-10 items-center justify-center rounded-full border border-border bg-surface disabled:opacity-40"
            >
              <Ionicons name="options-outline" color="#6B5D55" size={20} />
              {activeFilterCount > 0 ? (
                <View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1">
                  <Text className="text-[10px] font-bold text-white">{activeFilterCount}</Text>
                </View>
              ) : null}
            </Pressable>
            {deck.data?.viewer ? (
              <View className="flex-row items-center gap-2 rounded-full border border-border bg-surface px-3 py-2">
                <Ionicons name="paw" color="#F97362" size={16} />
                <Text className="text-xs font-semibold text-text-primary">
                  {deck.data.viewer.name}
                </Text>
              </View>
            ) : null}
          </View>
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
            <Ionicons name="search-outline" color="#2FB8A6" size={56} />
            <Text className="mt-4 text-center text-xl font-bold text-text-primary">
              Bu ayarlarda yeni bir pet yok
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
              Beğendiğin/geçtiğin petler desteden çıkar. Mesafeyi genişletebilir,
              filtreleri temizleyebilir veya yeni aday bildirimi isteyebilirsin.
            </Text>
            {deck.data.filterSettings.maxDistanceKm < 100 ? (
              <Pressable
                onPress={() => {
                  const settings = deck.data!.filterSettings;
                  const nextDistance =
                    [5, 10, 25, 50, 100].find((value) => value > settings.maxDistanceKm) ?? 100;
                  void applyFilters(
                    { ...settings, maxDistanceKm: nextDistance },
                    ownerFilters,
                  );
                }}
                disabled={filterBusy}
                className="mt-5 w-full items-center rounded-xl bg-brand px-5 py-3 disabled:opacity-50"
              >
                <Text className="font-semibold text-white">Yarıçapı genişlet</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() =>
                void applyFilters(
                  {
                    species: ["cat", "dog"],
                    maxDistanceKm: 25,
                    minPetAgeYears: null,
                    maxPetAgeYears: null,
                    requireVisibleOwner: false,
                    requirePhoto: false,
                    requireSocial: false,
                    requireVerified: false,
                    notifyOnNewCandidates: false,
                  },
                  { genders: [], minAge: null, maxAge: null },
                )
              }
              disabled={filterBusy}
              className="mt-3 w-full items-center rounded-xl border border-border bg-surface px-5 py-3 disabled:opacity-50"
            >
              <Text className="font-semibold text-text-primary">Filtreleri temizle</Text>
            </Pressable>
            <Pressable
              onPress={() => void toggleNewCandidateNotification()}
              disabled={filterBusy}
              className="mt-3 w-full items-center rounded-xl border border-accent bg-accent/5 px-5 py-3 disabled:opacity-50"
            >
              <Text className="font-semibold text-accent-dark">
                {deck.data.filterSettings.notifyOnNewCandidates
                  ? "Yeni pet bildirimi açık ✓"
                  : "Yeni pet gelince bildir"}
              </Text>
            </Pressable>
            <Pressable onPress={refresh} className="mt-3 px-5 py-3">
              <Text className="font-semibold text-text-secondary">Desteyi yenile</Text>
            </Pressable>
          </View>
        ) : null}

        {currentCard ? (
          <>
            <View>
              <DiscoveryCard card={currentCard} />
              <Pressable
                onPress={() => setSafetyVisible(true)}
                disabled={safetyBusy}
                accessibilityLabel="Profil güvenliği"
                className="absolute right-3 top-3 h-11 w-11 items-center justify-center rounded-full bg-black/45 disabled:opacity-50"
              >
                <Ionicons name="ellipsis-horizontal" color="#FFFFFF" size={23} />
              </Pressable>
            </View>

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
      <SafetyMenuModal
        visible={safetyVisible}
        busy={safetyBusy}
        onClose={() => setSafetyVisible(false)}
        onReport={() => {
          setSafetyVisible(false);
          setReportVisible(true);
        }}
        onBlock={confirmBlock}
      />
      <ReportModal
        visible={reportVisible}
        subjectUserId={currentCard?.ownerId}
        subjectPetId={currentCard?.id}
        onClose={() => setReportVisible(false)}
        onReported={() => {
          setError(null);
          Alert.alert("Teşekkürler", "Şikâyetin inceleme kuyruğuna alındı.");
        }}
      />
      {deck.data ? (
        <DiscoveryFilterModal
          visible={filterVisible}
          ownerSettings={deck.data.ownerSettings}
          filterSettings={deck.data.filterSettings}
          localFilters={ownerFilters}
          busy={filterBusy}
          onClose={() => setFilterVisible(false)}
          onConfigureOwner={() => {
            setFilterVisible(false);
            router.push("/profile/owner");
          }}
          onApply={(persistent, local) => {
            void applyFilters(persistent, local);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}
