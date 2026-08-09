import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { LinearGradient } from "expo-linear-gradient";
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
import { AppPressable } from "../../components/ui/pressable";
import { DiscoveryCardSkeleton } from "../../components/ui/skeleton";
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
import { updateOwnerVisibility } from "../../core/api/profile";
import { blockUser } from "../../core/api/safety";
import { FEATURES } from "../../core/features";
import type { OwnerVisibility, SwipeDirection } from "../../core/domain/types";
import { useAuthStore } from "../../stores/auth";
import { trackProductEvent } from "../../core/api/observability";
import { registerForPushNotifications } from "../../core/api/notifications";
import { errorMessage } from "../../core/domain/error-message";
import { decisionHaptic } from "../../core/ui/haptics";
import { shadowLg } from "../../core/ui/shadow";
import { DECISION_STROKE, DecisionIcons } from "../../components/ui/icon";

export default function DiscoverScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [match, setMatch] = useState<{
    petName: string;
    photoUrl: string | null;
    ownerPhotoUrl: string | null;
    conversationId: string | null;
  } | null>(null);
  const [segment, setSegment] = useState<DiscoverySegment>("all");
  const [safetyVisible, setSafetyVisible] = useState(false);
  const [ownerSheet, setOwnerSheet] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [filterVisible, setFilterVisible] = useState(false);
  const [filterBusy, setFilterBusy] = useState(false);
  const [visibilityBusy, setVisibilityBusy] = useState(false);
  const [filterReady, setFilterReady] = useState(false);
  const [ownerFilters, setOwnerFilters] = useState<OwnerDiscoveryFilterInput>({
    genders: [],
    minAge: null,
    maxAge: null,
  });
  const scrollRef = useRef<ScrollView>(null);
  const discoveryTrackedRef = useRef<string | null>(null);
  const [showSwipeHint, setShowSwipeHint] = useState(false);

  /**
   * Mini onboarding — bilerek TUR değil, bağlamsal ipucu.
   *
   * Kayıt akışı 17 alandan 6'ya indirildi; üstüne bir de adım adım tur
   * eklemek o sadeleştirmeyle gerilirdi. Turlar genelde atlanır; bağlamsal
   * ipucu davranışın gerçekleştiği anda öğretir. İlk karar anında (ilk
   * swipe/düğme) ya da birkaç saniye sonra kendiliğinden kapanıyor, bir
   * daha hiç çıkmıyor.
   */
  useEffect(() => {
    if (!user) return;
    void AsyncStorage.getItem(`petmatch:seen-swipe-hint:${user.id}`).then((value) => {
      if (!value) setShowSwipeHint(true);
    });
  }, [user]);

  const dismissSwipeHint = () => {
    if (!showSwipeHint || !user) return;
    setShowSwipeHint(false);
    void AsyncStorage.setItem(`petmatch:seen-swipe-hint:${user.id}`, "1");
  };

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
  const nextCard = activeCards[1] ?? null;

  // İpucu ekranda GERÇEKTEN görünmüyorsa (kart yoksa) sayaç işlemeye
  // başlamıyor — yoksa kullanıcı hiç görmeden "görüldü" işaretlenirdi.
  useEffect(() => {
    if (!showSwipeHint || !currentCard) return;
    const timeout = setTimeout(dismissSwipeHint, 5000);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showSwipeHint, currentCard?.id]);

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
      isSuper,
    }: {
      toPetId: string;
      direction: SwipeDirection;
      isSuper?: boolean;
    }) => {
      const viewer = deck.data?.viewer;
      if (!viewer) throw new Error("Aktif pet bulunamadı.");
      const matchId = await swipePet({
        fromPetId: viewer.id,
        toPetId,
        direction,
        isSuper,
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
          ownerPhotoUrl: swipedCard.owner?.photoUrl ?? null,
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
    dismissSwipeHint();
    decisionHaptic();
    swipe.mutate({ toPetId: currentCard.id, direction });
  };

  const handleSuperLike = () => {
    if (!currentCard || swipe.isPending) return;
    dismissSwipeHint();
    decisionHaptic();
    swipe.mutate({ toPetId: currentCard.id, direction: "like", isSuper: true });
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

  /**
   * Sahip görünürlüğü hızlı anahtarı.
   *
   * Görünürlük ayarı profilde de duruyor ama asıl karşılığını BURADA
   * veriyor: `public` olan sahip, kendi kartında avatar + ad + ilgi alanı
   * teaser'ı olarak karşı tarafa görünüyor (0049). Kararın alındığı yer ile
   * sonucunun görüldüğü yer aynı ekran olunca anahtarın ne yaptığı
   * açıklama gerektirmiyor.
   *
   * İki kural:
   * - **Otomatik açılmaz.** Varsayılan `after_match`/`hidden` kalıyor;
   *   kapatınca da `public` öncesindeki değere dönüyor, `after_match`'e
   *   sabitlemiyor — `hidden` seçmiş kullanıcıyı sessizce yukarı çekmek
   *   gizlilik varsayılanını bozardı.
   * - **Fotoğrafsız `public` anlamsız.** Avatar yoksa kart teaser'ı boş
   *   kalırdı; sessizce başarısız olmak yerine sahip profiline yönlendiriyor.
   */
  const ownerVisibility: OwnerVisibility =
    deck.data?.ownerSettings.visibility ?? "after_match";
  const ownerPublic = ownerVisibility === "public";
  const lastPrivateVisibility = useRef<OwnerVisibility>("after_match");
  useEffect(() => {
    if (ownerVisibility !== "public") lastPrivateVisibility.current = ownerVisibility;
  }, [ownerVisibility]);

  const toggleOwnerVisibility = async () => {
    if (!user || !deck.data || visibilityBusy) return;
    const next: OwnerVisibility = ownerPublic
      ? lastPrivateVisibility.current
      : "public";

    if (next === "public" && !deck.data.ownerSettings.avatarUrl) {
      Alert.alert(
        "Önce kendi fotoğrafını ekle",
        "Herkese açık profilde kartında adın ve fotoğrafın görünür. Fotoğrafın olmadan bu anahtarın bir karşılığı olmaz.",
        [
          { text: "Vazgeç", style: "cancel" },
          {
            text: "Sahip profiline git",
            onPress: () => router.push("/profile/owner"),
          },
        ],
      );
      return;
    }

    setVisibilityBusy(true);
    setError(null);
    try {
      await updateOwnerVisibility({ userId: user.id, visibility: next });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["discovery", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
      ]);
    } catch (visibilityError) {
      setError(errorMessage(visibilityError, "Görünürlük değiştirilemedi."));
    } finally {
      setVisibilityBusy(false);
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
        contentContainerClassName="flex-grow px-5 pt-4"
        // Yüzen düğme şeridi, gradyanın şeffaf ucuyla son 36 pt'nin ÜSTÜNE
        // biniyor (`marginTop: -36`). Kart varken alt boşluk o örtüşmeden
        // büyük olmalı, yoksa gradyan kartın alt satırını yiyor.
        contentContainerStyle={{ paddingBottom: currentCard ? 44 : 32 }}
        refreshControl={
          <RefreshControl
            refreshing={deck.isRefetching}
            onRefresh={refresh}
            tintColor="#F97362"
          />
        }
      >
        {/*
          Tek sıra: başlık + filtre + pet çipi. Önceden ayrı bir alt başlık
          satırı da vardı — kart altta 4 modül birikince (bu satır, tamamlama
          kartı, segment çubuğu, sahiplendirme bandı) hero olması gereken
          kart ekranın dışına itiliyordu. Alt başlık en düşük bilgi
          değerine sahipti, ilk giden o oldu.
        */}
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-text-primary">Keşfet</Text>
          <View className="flex-row items-center gap-2">
            {deck.data ? (
              <AppPressable
                onPress={() => void toggleOwnerVisibility()}
                disabled={visibilityBusy}
                accessibilityRole="switch"
                accessibilityState={{ checked: ownerPublic, disabled: visibilityBusy }}
                accessibilityLabel="Sahip profilim keşfette görünsün"
                accessibilityHint={
                  ownerPublic
                    ? "Kapatırsan adın ve fotoğrafın yalnızca eşleştiğin kişilere görünür."
                    : "Açarsan adın ve fotoğrafın kartında herkese görünür."
                }
                className={`h-11 w-11 items-center justify-center rounded-full border disabled:opacity-40 ${
                  ownerPublic ? "border-brand bg-brand/10" : "border-border bg-surface"
                }`}
              >
                {visibilityBusy ? (
                  <ActivityIndicator size="small" color="#6B5D55" />
                ) : (
                  <Ionicons
                    name={ownerPublic ? "eye" : "eye-off-outline"}
                    color={ownerPublic ? "#F97362" : "#6B5D55"}
                    size={20}
                  />
                )}
              </AppPressable>
            ) : null}
            <AppPressable
              onPress={() => setFilterVisible(true)}
              disabled={!deck.data}
              accessibilityLabel="Keşfet filtreleri"
              className="relative h-11 w-11 items-center justify-center rounded-full border border-border bg-surface disabled:opacity-40"
            >
              <Ionicons name="options-outline" color="#6B5D55" size={20} />
              {activeFilterCount > 0 ? (
                <View className="absolute -right-1 -top-1 h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1">
                  <Text className="text-[10px] font-bold text-white">{activeFilterCount}</Text>
                </View>
              ) : null}
            </AppPressable>
            {deck.data?.viewer ? (
              // Üçüncü öğe eklendi (görünürlük anahtarı); uzun pet adı
              // artık satırı taşırabilir, bu yüzden çip kısalıyor.
              <View className="max-w-[120px] shrink flex-row items-center gap-2 rounded-full border border-border bg-surface px-3 py-2">
                <Ionicons name="paw" color="#F97362" size={16} />
                <Text
                  numberOfLines={1}
                  className="shrink text-xs font-semibold text-text-primary"
                >
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

        {deck.isLoading ? <DiscoveryCardSkeleton /> : null}

        {deck.isError ? (
          <View className="flex-1 items-center justify-center rounded-3xl border border-danger/20 bg-danger/5 px-8 py-16">
            <Ionicons name="cloud-offline-outline" color="#E5484D" size={42} />
            <Text className="mt-4 text-center text-lg font-bold text-text-primary">
              Keşfet yüklenemedi
            </Text>
            <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
              {errorMessage(deck.error, "Bağlantını kontrol edip tekrar dene.")}
            </Text>
            <AppPressable onPress={refresh} className="mt-5 rounded-xl bg-brand px-5 py-3">
              <Text className="font-semibold text-white">Tekrar dene</Text>
            </AppPressable>
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
              <AppPressable
                onPress={() => router.push("/adoption")}
                accessibilityRole="button"
                className="mt-5 min-h-12 flex-row items-center justify-center rounded-xl bg-brand px-5"
              >
                <Ionicons name="home" size={17} color="#FFFFFF" />
                <Text className="ml-2 text-sm font-bold text-white">Yuva arayanlar</Text>
              </AppPressable>
            ) : null}
            <AppPressable
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
            </AppPressable>
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

          Segment çubuğu görünüyorsa banner BİLEREK bastırılıyor: ikisi aynı
          anda kartın üstünde iki ayrı yatay şerit olarak yığılınca hero
          kart daha da aşağı itiliyordu. Segment, o an aktif bir tarama
          kararını temsil ettiği için önceliği o alıyor.
        */}
        {FEATURES.adoption &&
        deck.data?.viewer &&
        adoptableCount > 0 &&
        ownerVisibleCards.length < OWNER_SEGMENT_MIN_CARDS ? (
          <AppPressable
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
          </AppPressable>
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
            {/*
              Öncesinde burada 4 düğme üst üste duruyordu (yarıçap/temizle/
              bildir/yenile) — hepsi aynı ağırlıkta, birincil eylem
              seçilemiyordu. Tek birincil kalıyor, geri kalanı metin
              bağlantısına iniyor.
            */}
            {deck.data.filterSettings.maxDistanceKm < 100 ? (
              <AppPressable
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
              </AppPressable>
            ) : (
              <AppPressable
                onPress={() => void toggleNewCandidateNotification()}
                disabled={filterBusy}
                className="mt-5 w-full items-center rounded-xl bg-brand px-5 py-3 disabled:opacity-50"
              >
                <Text className="font-semibold text-white">
                  {deck.data.filterSettings.notifyOnNewCandidates
                    ? "Yeni pet bildirimi açık ✓"
                    : "Yeni pet gelince bildir"}
                </Text>
              </AppPressable>
            )}
            <View className="mt-4 flex-row flex-wrap items-center justify-center gap-x-4 gap-y-1">
              <AppPressable
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
                className="min-h-11 justify-center px-2"
              >
                <Text className="text-sm font-semibold text-text-secondary">
                  Filtreleri temizle
                </Text>
              </AppPressable>
              {deck.data.filterSettings.maxDistanceKm < 100 ? (
                <AppPressable
                  onPress={() => void toggleNewCandidateNotification()}
                  disabled={filterBusy}
                  className="min-h-11 justify-center px-2"
                >
                  <Text className="text-sm font-semibold text-text-secondary">
                    {deck.data.filterSettings.notifyOnNewCandidates
                      ? "Yeni pet bildirimi açık ✓"
                      : "Yeni pet gelince bildir"}
                  </Text>
                </AppPressable>
              ) : null}
              <AppPressable onPress={refresh} className="min-h-11 justify-center px-2">
                <Text className="text-sm font-semibold text-text-secondary">Desteyi yenile</Text>
              </AppPressable>
            </View>
          </View>
        ) : null}

        {currentCard ? (
          <>
            {/*
              `flex-1`: kart, üstündeki krom (başlık, tamamlama şeridi,
              segment çubuğu) ne kadar yer kaplarsa kalanı DOLDURUYOR.
              Öncesinde kartın yüksekliği fotoğrafın 3:4 oranından geliyordu;
              tamamlama şeridi açıkken toplam içerik ekranı aşıyor, sayfa
              kaydırılabilir hale geliyor ve kartın alt satırı (ad · boyut ·
              mesafe) yüzen düğme şeridinin ALTINDA kalıyordu. `minHeight`:
              çok dar ekranlarda kart okunamayacak kadar ezilmesin — o
              durumda sayfa yeniden kaydırılabilir oluyor.
            */}
            <View className="relative flex-1" style={{ minHeight: 320 }}>
              {/*
                Deste derinliği: bir sonraki kart hafif küçültülmüş ve
                aşağı kaydırılmış halde arkada duruyor. Öncesinde swipe
                sonrası bir an tamamen boş ekran görünüyordu — arkada
                bekleyen kart, desteyi bitmeyen bir akış gibi hissettiriyor.
                `pointerEvents="none"`: bu kopya salt görsel, dokunulamaz.
              */}
              {nextCard ? (
                <View
                  pointerEvents="none"
                  className="absolute inset-0 top-2"
                  style={{ transform: [{ scale: 0.96 }] }}
                >
                  <DiscoveryCard card={nextCard} fill />
                </View>
              ) : null}
              <SwipeableCard
                resetKey={currentCard.id}
                disabled={swipe.isPending}
                onSwipe={handleSwipe}
                fill
              >
                <DiscoveryCard
                  card={currentCard}
                  fill
                  onOwnerPress={currentCard.owner ? () => setOwnerSheet(true) : undefined}
                />
              </SwipeableCard>
              <AppPressable
                onPress={() => setSafetyVisible(true)}
                disabled={safetyBusy}
                accessibilityLabel="Profil güvenliği"
                className="absolute right-3 top-3 h-11 w-11 items-center justify-center rounded-full bg-black/45 disabled:opacity-50"
              >
                <Ionicons name="ellipsis-horizontal" color="#FFFFFF" size={23} />
              </AppPressable>
            </View>

            {error ? (
              <View className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3">
                <Text className="text-center text-sm text-danger">{error}</Text>
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      {showSwipeHint && currentCard ? (
        <View className="flex-row items-center gap-2 border-t border-border bg-bg-secondary px-4 py-2.5">
          <Ionicons name="hand-left-outline" color="#6B5D55" size={16} />
          <Text className="flex-1 text-xs text-text-secondary">
            Kartı sağa/sola sürükle ya da alttaki düğmelere dokun
          </Text>
          <AppPressable onPress={dismissSwipeHint} accessibilityLabel="İpucunu kapat" hitSlop={8}>
            <Ionicons name="close" color="#9A8B82" size={16} />
          </AppPressable>
        </View>
      ) : null}

      {/*
        Düğmeler bilerek ScrollView'ın DIŞINDA — kart + tamamlama kartı +
        segment çubuğu üst üste geldiğinde beğen düğmesi kaydırmadan hiç
        görünmüyordu. Tinder/Bumble'daki gibi sabit alt şerit: kart ne kadar
        uzun olursa olsun düğmeler her zaman ekranda.
        Düz bir araç çubuğu değil, deste'nin üstüne binen bir gradyan —
        negatif üst boşluk son kaydırma pikselleriyle örtüşüyor, sert bir
        çizgi yerine yumuşak bir geçiş. Düğmeler kendi gölgeleriyle
        yüzüyor (Tinder/Bumble referansı).
      */}
      {currentCard ? (
        // NativeWind'in ürettiği stil ile elle verilen `style` prop'u AYNI
        // View'da çakışınca (burada `flex-row` gibi layout sınıfları)
        // explicit `style` kazanıyor ve className'in ürettiği layout
        // tamamen düşüyor — düğmelerin dikey yığılıp yarısının ekran dışında
        // kalmasının kök sebebi buydu. Düzeltme: gradyan yalnızca ZEMİN
        // (`style` ile, className yok); düğme şeridi kendi `className`'i
        // olan AYRI bir View'da.
        <LinearGradient
          colors={["rgba(255,251,247,0)", "#FFFBF7", "#FFFBF7"]}
          locations={[0, 0.55, 1]}
          // İpucu şeridi görünüyorken üste binmesin — kendi zemini var,
          // gradyanın şeffaf ucu onunla çakışırsa renk dikişi oluşur.
          style={
            showSwipeHint
              ? { paddingTop: 20 }
              : { marginTop: -36, paddingTop: 36 }
          }
        >
          <View className="flex-row items-center justify-center gap-6 px-5 pb-4">
            <AppPressable
              onPress={() => handleSwipe("pass")}
              disabled={swipe.isPending}
              accessibilityLabel="Geç"
              style={shadowLg}
              className="h-16 w-16 items-center justify-center rounded-full bg-surface disabled:opacity-50"
            >
              <DecisionIcons.pass color="#7A6A61" size={30} strokeWidth={DECISION_STROKE} />
            </AppPressable>
            <AppPressable
              onPress={handleSuperLike}
              disabled={swipe.isPending}
              accessibilityLabel="Süper beğen"
              style={shadowLg}
              className="h-12 w-12 items-center justify-center rounded-full bg-warning disabled:opacity-50"
            >
              <DecisionIcons.superLike
                color="#FFFFFF"
                size={20}
                strokeWidth={DECISION_STROKE}
                fill="#FFFFFF"
              />
            </AppPressable>
            <AppPressable
              onPress={() => handleSwipe("like")}
              disabled={swipe.isPending}
              accessibilityLabel="Beğen"
              style={shadowLg}
              className="h-[70px] w-[70px] items-center justify-center rounded-full bg-brand disabled:opacity-50"
            >
              {swipe.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <DecisionIcons.like
                  color="#FFFFFF"
                  size={31}
                  strokeWidth={DECISION_STROKE}
                  fill="#FFFFFF"
                />
              )}
            </AppPressable>
          </View>
        </LinearGradient>
      ) : null}
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
        viewerOwnerPhotoUrl={deck.data?.ownerSettings.avatarUrl ?? null}
        matchedPetName={match?.petName ?? ""}
        matchedPhotoUrl={match?.photoUrl ?? null}
        matchedOwnerPhotoUrl={match?.ownerPhotoUrl ?? null}
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
