import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { MatchCelebration } from "../../components/match-celebration";
import { PetProfileBody } from "../../components/pet-profile-body";
import { PhotoCarousel } from "../../components/photo-carousel";
import { AppIcon } from "../../components/ui/icon";
import { AppPressable } from "../../components/ui/pressable";
import { DecisionActions, swipePendingAction } from "../../components/decision-actions";
import { loadConversationIdForMatch, loadConversationOwnerProfile } from "../../core/api/conversations";
import { loadEditableProfile, loadOwnerPhotos } from "../../core/api/profile";
import { loadProfileCompletion } from "../../core/api/profile-completion";
import { swipePet } from "../../core/api/discovery";
import { missingProfileItems } from "../../core/domain/profile-completion";
import { useAuthStore } from "../../stores/auth";
import {
  getDiscoverProfileSession,
  markDiscoverProfileSwiped,
} from "../../stores/discover-profile";
import { loadPetProfile } from "../../core/api/pet-profile";
import { formatAge } from "../../core/domain/age";
import { ownerAgeBucket } from "../../core/domain/owner-age-bucket";
import { sizeLabels } from "../../core/domain/labels";
import { errorMessage } from "../../core/domain/error-message";
import type { SwipeDirection } from "../../core/domain/types";

function extraOwnerPhotoUrls(
  photos: { storagePath: string; url: string }[] | undefined,
): string[] | undefined {
  if (!photos?.length) return undefined;
  const unique = photos.filter(
    (photo, index, rows) =>
      rows.findIndex((row) => row.storagePath === photo.storagePath) === index,
  );
  if (unique.length < 2) return undefined;
  return unique.slice(1).map((photo) => photo.url);
}

/**
 * PET PROFİL SAYFASI — ürünün tek profil yüzeyi.
 *
 * Neden petin sayfası, sahibin değil:
 *
 * 1. **Sahip görünürlüğü değişken, pet değişmez.** Sahip `hidden` /
 *    `after_match` / `public` olabiliyor; pet her zaman var. Tabanı değişken
 *    olan bir ekran boş durumlar üretmek zorunda kalırdı — dahası "sahip
 *    profili yok" diye bir boşluk göstermek, o kişinin gizlenmeyi SEÇTİĞİNİ
 *    ele verirdi. Pet tabanlı sayfada sahip bölümü ya vardır ya hiç yoktur.
 * 2. **Görünürlük kuralı tek yerde kalıyor.** Bu sayfa kuralı yeniden
 *    uygulamıyor; RPC / deste satırı ne döndürürse onu gösteriyor.
 * 3. **Keşfet girişi desteden.** Eşleşmeden `pets_select_matched` boş döner;
 *    `from=discover` iken ağ atılmaz, destede zaten olan satır kullanılır.
 */
export default function PetProfileScreen() {
  const { petId, conversationId, preview, from, focus } = useLocalSearchParams<{
    petId: string;
    conversationId?: string;
    preview?: string;
    from?: string;
    focus?: string;
  }>();
  const isPreview = preview === "1";
  const fromDiscover = from === "discover";
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [photoIndex, setPhotoIndex] = useState(0);
  const [match, setMatch] = useState<{
    matchId: string;
    conversationId: string | null;
    conversationStatus: "loading" | "ready" | "error";
  } | null>(null);

  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const heroHeight = Math.round(windowWidth * (5 / 4));
  const session = petId && fromDiscover ? getDiscoverProfileSession(petId) : null;

  const pet = useQuery({
    queryKey: ["pet-profile", petId],
    queryFn: () => loadPetProfile(petId),
    enabled: Boolean(petId) && !fromDiscover,
  });
  const petData = session?.card ?? pet.data;

  const owner = useQuery({
    queryKey: ["conversation-owner", conversationId],
    queryFn: () => loadConversationOwnerProfile(conversationId!),
    enabled: Boolean(conversationId) && !isPreview && !session,
  });

  const myProfile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => loadEditableProfile(user!.id),
    enabled: isPreview && Boolean(user),
  });

  const previewOwner = myProfile.data
    ? {
        displayName: myProfile.data.displayName,
        photoUrl: myProfile.data.ownerAvatar?.url ?? null,
        extraPhotoUrls: extraOwnerPhotoUrls(myProfile.data.ownerPhotos),
        bio: myProfile.data.ownerBio,
        gender: myProfile.data.ownerGender,
        ageBucket: ownerAgeBucket(myProfile.data.ownerBirthDate),
        socialOpen: myProfile.data.ownerSocialOpen,
        verified: myProfile.data.verificationStatus === "approved",
        interests: myProfile.data.ownerInterests,
        connectionTag: myProfile.data.ownerSocialOpen
          ? myProfile.data.connectionTag
          : null,
      }
    : null;
  const previewVisibility = myProfile.data?.ownerVisibility ?? "after_match";

  const baseOwner = isPreview
    ? previewVisibility === "hidden"
      ? null
      : previewOwner
    : session
      ? session.card.owner
      : owner.data
        ? {
            displayName: owner.data.displayName,
            photoUrl: owner.data.photoUrl,
            bio: owner.data.bio,
            gender: owner.data.gender,
            ageBucket: owner.data.ageBucket,
            socialOpen: owner.data.socialOpen,
            verified: owner.data.verified,
          }
        : null;

  const galleryOwnerId = isPreview
    ? null
    : session
      ? session.card.owner
        ? session.card.ownerId
        : null
      : (owner.data?.userId ?? null);

  const gallery = useQuery({
    queryKey: ["owner-photos", galleryOwnerId],
    queryFn: () => loadOwnerPhotos(galleryOwnerId!),
    enabled: Boolean(galleryOwnerId) && Boolean(baseOwner),
  });

  const shownOwner = baseOwner
    ? {
        ...baseOwner,
        extraPhotoUrls:
          extraOwnerPhotoUrls(gallery.data) ??
          (isPreview ? previewOwner?.extraPhotoUrls : undefined),
      }
    : null;

  const scrollRef = useRef<ScrollView>(null);
  const focusOwner = focus === "owner";

  useEffect(() => {
    if (!focusOwner || !petData) return;
    const timer = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 350);
    return () => clearTimeout(timer);
  }, [focusOwner, petData]);

  const completion = useQuery({
    queryKey: ["profile-completion", user?.id],
    queryFn: () => loadProfileCompletion(user!.id),
    enabled: isPreview && Boolean(user),
  });
  const missing = completion.data ? missingProfileItems(completion.data) : [];

  const resolveMatchConversation = (matchId: string) => {
    void loadConversationIdForMatch(matchId)
      .then((id) => {
        setMatch((current) =>
          current?.matchId === matchId
            ? {
                ...current,
                conversationId: id,
                conversationStatus: id ? "ready" : "error",
              }
            : current,
        );
      })
      .catch(() => {
        setMatch((current) =>
          current?.matchId === matchId
            ? { ...current, conversationStatus: "error" }
            : current,
        );
      });
  };

  const swipe = useMutation({
    mutationFn: async ({
      direction,
      isSuper,
    }: {
      direction: SwipeDirection;
      isSuper?: boolean;
    }) => {
      if (!session) throw new Error("Aktif pet bulunamadı.");
      const matchId = await swipePet({
        fromPetId: session.viewer.id,
        toPetId: session.card.id,
        direction,
        isSuper,
      });
      return { direction, matchId, petId: session.card.id };
    },
    onSuccess: ({ direction, matchId, petId: swipedId }) => {
      markDiscoverProfileSwiped(swipedId);
      void queryClient.invalidateQueries({ queryKey: ["discovery"] });
      if (direction === "like" && matchId) {
        setMatch({
          matchId,
          conversationId: null,
          conversationStatus: "loading",
        });
        resolveMatchConversation(matchId);
        return;
      }
      router.back();
    },
  });

  const decide = (direction: SwipeDirection, isSuper?: boolean) => {
    if (swipe.isPending || !session) return;
    swipe.mutate({ direction, isSuper });
  };

  const facts = petData
    ? [petData.breed, formatAge(petData.birthDate), sizeLabels[petData.size]]
        .filter(Boolean)
        .join(" · ")
    : "";
  const place = petData
    ? [session?.card.city, session?.card.distanceBucket
        ? session.card.distanceBucket === "<1"
          ? "1 km’den yakın"
          : session.card.distanceBucket === "25+"
            ? "25 km’den uzak"
            : `${session.card.distanceBucket} km uzakta`
        : null]
        .filter(Boolean)
        .join(" · ")
    : "";

  const backButton = (
    <AppPressable
      onPress={() => router.back()}
      accessibilityLabel="Geri"
      className="h-11 w-11 items-center justify-center rounded-full bg-black/40"
    >
      <AppIcon name="chevron-left" color="#FFFFFF" size={22} />
    </AppPressable>
  );

  return (
    <View className="flex-1 bg-bg-primary" style={{ backgroundColor: "#FFFBF7" }}>
      <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: "#FFFBF7" }]} />
      {!petData ? (
        <SafeAreaView className="flex-1">
          <View className="flex-row items-center border-b border-border bg-surface px-3 py-2.5">
            <AppPressable
              onPress={() => router.back()}
              accessibilityLabel="Geri"
              className="h-11 w-11 items-center justify-center rounded-full"
            >
              <AppIcon name="chevron-left" color="#1F1A17" size={27} />
            </AppPressable>
            <Text className="ml-2 text-lg font-bold text-text-primary">Profil</Text>
          </View>
          {fromDiscover && !session ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-center text-sm text-text-secondary">
                Bu kart artık destede yok. Keşfet’e dönüp yeniden açabilirsin.
              </Text>
            </View>
          ) : !fromDiscover && pet.isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#F97362" />
            </View>
          ) : !fromDiscover && pet.isError ? (
            <View className="flex-1 items-center justify-center px-8">
              <Text className="text-center text-sm text-text-secondary">
                {errorMessage(pet.error, "Profil yüklenemedi.")}
              </Text>
            </View>
          ) : (
            <View className="flex-1 items-center justify-center px-8">
              <AppIcon name="lock" color="#C4B7AE" size={32} />
              <Text className="mt-3 text-center text-sm text-text-secondary">
                Bu profil artık görünmüyor. Eşleşme kaldırılmış olabilir.
              </Text>
            </View>
          )}
        </SafeAreaView>
      ) : (
        <>
          <ScrollView
            ref={scrollRef}
            contentContainerClassName={fromDiscover ? "pb-28" : "pb-12"}
          >
            <View
              className="overflow-hidden rounded-b-[28px]"
              style={{ height: heroHeight, backgroundColor: "#1A1410" }}
            >
              <PhotoCarousel
                photoUrls={petData.photoUrls}
                aspectRatio={4 / 5}
                fill
                index={photoIndex}
                onIndexChange={setPhotoIndex}
              />
              <LinearGradient
                pointerEvents="none"
                colors={["rgba(26,20,16,0)", "rgba(26,20,16,0.72)", "#1A1410"]}
                locations={[0, 0.5, 1]}
                style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" }}
              />
              <View
                pointerEvents="box-none"
                className="absolute left-4 right-4"
                style={{ top: insets.top + 6 }}
              >
                <View className="flex-row items-center">
                  {backButton}
                  {isPreview ? (
                    <View className="ml-2 rounded-full bg-white/90 px-2.5 py-1">
                      <Text className="text-[11px] font-bold text-accent-dark">Önizleme</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View pointerEvents="none" className="absolute bottom-0 left-0 right-0 px-5 pb-5">
                <View className="flex-row items-center gap-2">
                  <Text className="text-[28px] font-bold text-white">{petData.name}</Text>
                  <AppIcon
                    name={petData.gender === "female" ? "venus" : "mars"}
                    color="#FFFFFF"
                    size={22}
                  />
                </View>
                {facts ? (
                  <Text className="mt-1 text-[15px] font-medium text-white/90">{facts}</Text>
                ) : null}
                {place ? (
                  <Text className="mt-0.5 text-sm text-white/75">{place}</Text>
                ) : null}
              </View>
            </View>

            {isPreview && missing.length > 0 ? (
              <View className="mx-5 mt-5 rounded-2xl border border-dashed border-brand/40 bg-brand/5 p-4">
                <Text className="text-sm font-bold text-brand-dark">
                  Karşı taraf şunları göremiyor
                </Text>
                <View className="mt-3 gap-2">
                  {missing.map((item) => (
                    <AppPressable
                      key={item.key}
                      onPress={() => router.push(item.route)}
                      accessibilityRole="button"
                      accessibilityLabel={`${item.label} ekle`}
                      className="flex-row items-center rounded-xl bg-surface px-3 py-2.5"
                    >
                      <AppIcon name="circle" color="#C4B7AE" size={15} />
                      <Text className="ml-2.5 flex-1 text-[13px] text-text-primary">
                        {item.label}
                      </Text>
                      <AppIcon name="chevron-right" color="#9A8B82" size={15} />
                    </AppPressable>
                  ))}
                </View>
                <Text className="mt-3 text-[11px] leading-4 text-text-tertiary">
                  Bu kutu yalnızca sana görünür.
                </Text>
              </View>
            ) : null}

            <PetProfileBody
              pet={petData}
              owner={shownOwner}
              city={session?.card.city}
              distanceBucket={session?.card.distanceBucket}
              hideIdentity
              ownerHeader={
                isPreview && previewOwner ? (
                  <View className="-mx-1 rounded-xl bg-bg-secondary px-3 py-2.5">
                    <Text className="text-xs leading-4 text-text-secondary">
                      {previewVisibility === "public"
                        ? "Herkes görüyor: Keşfet kartında adın ve fotoğrafın da görünüyor."
                        : previewVisibility === "after_match"
                          ? `Yalnızca eşleştiklerin görüyor. Keşfet kartında yalnızca ${petData.name} çıkar; sen eşleşmeden sonra burada ve sohbette görünürsün.`
                          : "Gizli: sahip bilgin ne Keşfet kartında ne burada görünüyor."}
                    </Text>
                  </View>
                ) : undefined
              }
            />
          </ScrollView>

          {fromDiscover && session ? (
            <View className="absolute bottom-0 left-0 right-0 border-t border-border bg-bg-primary px-5 pb-4 pt-3">
              <DecisionActions
                busy={swipe.isPending}
                pendingAction={swipePendingAction(
                  swipe.isPending,
                  swipe.variables,
                )}
                onPass={() => decide("pass")}
                onLike={() => decide("like")}
              />
            </View>
          ) : null}
        </>
      )}

      {match && session ? (
        <MatchCelebration
          visible
          viewerPetName={session.viewer.name}
          matchedPetName={session.card.name}
          viewerPhotoUrl={session.viewer.photoUrls[0] ?? null}
          matchedPhotoUrl={session.card.photoUrls[0] ?? null}
          viewerOwnerPhotoUrl={session.viewerOwnerPhotoUrl}
          matchedOwnerPhotoUrl={session.card.owner?.photoUrl ?? null}
          canOpenChat={match.conversationStatus === "ready"}
          chatError={match.conversationStatus === "error"}
          onSendMessage={() => {
            if (match.conversationId) router.replace(`/chat/${match.conversationId}`);
          }}
          onRetry={() => resolveMatchConversation(match.matchId)}
          onKeepBrowsing={() => router.back()}
        />
      ) : null}
    </View>
  );
}
