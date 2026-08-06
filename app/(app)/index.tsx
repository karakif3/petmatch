import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
// SafeAreaView react-native'den DEĞİL buradan geliyor: deprecated olan
// sürüm iOS 26'da KeyboardAvoidingView zinciriyle birlikte içeriği sıfır
// yüksekliğe düşürüyor ve ekran boş render ediliyordu.
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DiscoveryCard } from "../../components/discovery-card";
import { DiscoveryFilterModal } from "../../components/discovery-filter-modal";
import {
  DiscoverySegments,
  OWNER_SEGMENT_MIN_CARDS,
  type DiscoverySegment,
} from "../../components/discovery-segments";
import { MatchCelebration } from "../../components/match-celebration";
import { ProfileCompletionCard } from "../../components/profile-completion-card";
import { ReportModal } from "../../components/report-modal";
import { SafetyMenuModal } from "../../components/safety-menu-modal";
import { OwnerSheet } from "../../components/owner-sheet";
import { SwipeableCard } from "../../components/swipeable-card";
import { listAdoptablePets } from "../../core/api/adoption";
import { loadConversationIdForMatch } from "../../core/api/conversations";
import {
  loadDiscoveryDeck,
  swipePet,
  updateDiscoveryFilters,
  type DiscoveryFilterSettings,
  type OwnerDiscoveryFilterInput,
} from "../../core/api/discovery";
import { loadProfileCompletion } from "../../core/api/profile-completion";
import { blockUser } from "../../core/api/safety";
import { FEATURES } from "../../core/features";
import type { SwipeDirection } from "../../core/domain/types";
import { useTranslation } from "../../core/i18n";
import { useAuthStore } from "../../stores/auth";
import { trackProductEvent } from "../../core/api/observability";
import { registerForPushNotifications } from "../../core/api/notifications";
import { errorMessage } from "../../core/domain/error-message";

export default function DiscoverScreen() {
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<{
    petName: string;
    photoUrl: string | null;
    conversationId: string | null;
  } | null>(null);
  const [segment, setSegment] = useState<DiscoverySegment>("all");
  const [safetyVisible, setSafetyVisible] = useState(false);
  const [ownerSheet, setOwnerSheet] = useState(false);
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

  // Segment sunucuya gitmiyor: eleme zaten yapılmış desteyi yerel olarak
  // süzüyor. Kalıcı tercih DEĞİL — bir görünüm anahtarı; kalıcı olsaydı
  // kullanıcı farkında olmadan kendini dar bir destede kilitleyebilirdi.
  const ownerVisibleCards = useMemo(
    () => visibleCards.filter((card) => Boolean(card.owner?.photoUrl)),
    [visibleCards],
  );
  const activeCards = segment === "owner_visible" ? ownerVisibleCards : visibleCards;
  const currentCard = activeCards[0] ?? null;

  // Segment gizlenecek kadar az kart kaldıysa kullanıcıyı orada bırakma.
  useEffect(() => {
    if (segment === "owner_visible" && ownerVisibleCards.length < OWNER_SEGMENT_MIN_CARDS) {
      setSegment("all");
    }
  }, [ownerVisibleCards.length, segment]);

  useEffect(() => {
    setDismissedIds([]);
  }, [deck.dataUpdatedAt]);

  // Kart değişince açık kalan sahip paneli yeni kartın sahibini gösterirdi.
  useEffect(() => {
    setOwnerSheet(false);
  }, [currentCard?.id]);

  const completion = useQuery({
    queryKey: ["profile-completion", user?.id],
    queryFn: () => loadProfileCompletion(user!.id),
    enabled: Boolean(user),
    staleTime: 60 * 1000,
  });

  // Giriş kartı yalnızca gerçekten ilan varsa çıksın diye sayıyoruz.
  // Bayrak kapalıyken sorgu hiç atılmıyor — gizli bir yüzey için her
  // keşfet açılışında istek yapmanın anlamı yok.
  const adoptable = useQuery({
    queryKey: ["adoptable-pets", "count"],
    queryFn: () => listAdoptablePets(),
    enabled: FEATURES.adoption,
    staleTime: 5 * 60 * 1000,
  });
  const adoptableCount = adoptable.data?.length ?? 0;

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
      // Karşı taraf zaten beni beğenmişse bu karar (eşleşme ya da geçme)
      // "Beğeniler" sekmesindeki bekleyen listeden onu düşürür.
      void queryClient.invalidateQueries({ queryKey: ["pending-likes"] });

      if (direction === "like" && matchId && swipedCard) {
        setMatch({
          petName: swipedCard.name,
          photoUrl: swipedCard.photoUrls[0] ?? null,
          conversationId: null,
        });
        // Konuşma id'si ayrı bir sorgu; kutlama onu beklemeden açılıyor,
        // "Mesaj gönder" gelene kadar beklemede kalıyor.
        void loadConversationIdForMatch(matchId)
          .then((conversationId) =>
            setMatch((current) => (current ? { ...current, conversationId } : current)),
          )
          .catch((conversationError) =>
            console.error("Eşleşmenin konuşması bulunamadı:", conversationError),
          );
      }

      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    onError: (mutationError) => {
      setError(
        errorMessage(mutationError, "Beğeni kaydedilemedi."),
      );
    },
  });

  const handleSwipe = (direction: SwipeDirection) => {
    if (!currentCard || swipe.isPending) return;
    swipe.mutate({ toPetId: currentCard.id, direction });
  };

  const refresh = async () => {
    setDismissedIds([]);
    setMatch(null);
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
                  errorMessage(blockError, "Kullanıcı engellenemedi."),
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
        errorMessage(filterError, "Filtreler kaydedilemedi."),
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
              {t("discovery.subtitle")}
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


        {/*
          Kayıt akışı artık ırk/boyut/enerji/biyografi sormuyor; bunlar
          kullanıcı ürünü gördükten sonra buradan toplanıyor. Eksik yoksa
          kart hiç render edilmiyor.
        */}
        <ProfileCompletionCard data={completion.data} />

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
              {errorMessage(deck.error, "Bağlantını kontrol edip tekrar dene.")}
            </Text>
            <Pressable onPress={refresh} className="mt-5 rounded-xl bg-brand px-5 py-3">
              <Text className="font-semibold text-white">Tekrar dene</Text>
            </Pressable>
          </View>
        ) : null}

        {/*
          Hayvanı olmayan kullanıcı için Keşfet ZATEN sahiplendirme yüzeyidir.
          Destesi yok; ona boş bir deste göstermek yerine huninin girişini
          gösteriyoruz — sahiplenir, sonra ana döngüye girer.
        */}
        {!deck.isLoading && !deck.isError && !deck.data?.viewer ? (
          <View className="flex-1 items-center justify-center px-8 py-20">
            <Ionicons name="home-outline" color="#F97362" size={54} />
            <Text className="mt-4 text-center text-xl font-bold text-text-primary">
              Henüz bir petin yok
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
              {FEATURES.adoption
                ? "Keşfet için aktif bir pet gerekiyor. Dilersen önce yuva arayan hayvanlara göz at."
                : "Keşfet için aktif bir pet gerekiyor."}
            </Text>
            {FEATURES.adoption ? (
              <Pressable
                onPress={() => router.push("/adoption")}
                accessibilityRole="button"
                className="mt-5 min-h-12 flex-row items-center justify-center rounded-xl bg-brand px-5"
              >
                <Ionicons name="home" size={17} color="#FFFFFF" />
                <Text className="ml-2 text-sm font-bold text-white">Yuva arayanlar</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => router.push("/profile/pet")}
              accessibilityRole="button"
              className={
                FEATURES.adoption
                  ? "mt-2 min-h-12 items-center justify-center px-5"
                  : "mt-5 min-h-12 items-center justify-center rounded-xl bg-brand px-5"
              }
            >
              <Text
                className={
                  FEATURES.adoption
                    ? "text-sm font-semibold text-text-secondary"
                    : "text-sm font-bold text-white"
                }
              >
                Pet profili oluştur
              </Text>
            </Pressable>
          </View>
        ) : null}

        {deck.data?.viewer ? (
          <DiscoverySegments
            current={segment}
            ownerVisibleCount={ownerVisibleCards.length}
            totalCount={visibleCards.length}
            onChange={(next) => {
              setSegment(next);
              void trackProductEvent("discovery_segment_changed", { segment: next });
            }}
          />
        ) : null}

        {/*
          İlan varsa giriş kartı, yoksa hiç. Boş bir tab uygulamanın ölü
          olduğunu söyler; giriş noktasını içeriğe bağlamak bu sorunu kural
          olarak değil yapısal olarak çözüyor (bkz. docs/goal-model.md).
        */}
        {FEATURES.adoption && deck.data?.viewer && adoptableCount > 0 ? (
          <Pressable
            onPress={() => router.push("/adoption")}
            accessibilityRole="button"
            accessibilityLabel={`Yakınında yuva arayan ${adoptableCount} hayvan var`}
            className="mb-4 flex-row items-center rounded-2xl border border-border bg-bg-secondary px-4 py-3"
          >
            <View className="h-9 w-9 items-center justify-center rounded-full bg-brand/10">
              <Ionicons name="home" size={18} color="#F97362" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-sm font-bold text-text-primary">
                Yakınında yuva arayan {adoptableCount} hayvan var
              </Text>
              <Text className="mt-0.5 text-xs text-text-secondary">
                Sahiplendirme ilanlarına göz at
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#C4B7AE" />
          </Pressable>
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
              <SwipeableCard
                resetKey={currentCard.id}
                disabled={swipe.isPending}
                onSwipe={handleSwipe}
              >
                <DiscoveryCard
                  card={currentCard}
                  onOwnerPress={currentCard.owner ? () => setOwnerSheet(true) : undefined}
                />
              </SwipeableCard>
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
      <OwnerSheet
        owner={currentCard?.owner ?? null}
        petName={currentCard?.name ?? ""}
        visible={ownerSheet && Boolean(currentCard?.owner)}
        onClose={() => setOwnerSheet(false)}
      />

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

      <MatchCelebration
        visible={Boolean(match)}
        viewerPetName={deck.data?.viewer?.name ?? "Petin"}
        viewerPhotoUrl={deck.data?.viewer?.photoUrls[0] ?? null}
        matchedPetName={match?.petName ?? ""}
        matchedPhotoUrl={match?.photoUrl ?? null}
        canOpenChat={Boolean(match?.conversationId)}
        // Doğrulama istemi kayıt akışında değil BURADA: ilk eşleşme, rozetin
        // değerinin somutlaştığı ilk an (bkz. docs/benchmark.md).
        showVerifyPrompt={
          deck.data?.ownerSettings.verificationStatus !== "approved" &&
          deck.data?.ownerSettings.verificationStatus !== "pending"
        }
        onSendMessage={() => {
          const conversationId = match?.conversationId;
          setMatch(null);
          if (conversationId) router.push(`/chat/${conversationId}`);
        }}
        onKeepBrowsing={() => setMatch(null)}
        onVerify={() => {
          setMatch(null);
          router.push("/profile/owner");
        }}
      />
    </SafeAreaView>
  );
}
