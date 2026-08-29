import { useCallback } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { AppIcon } from "../../components/ui/icon";
// SafeAreaView react-native'den DEĞİL buradan geliyor: deprecated olan
// sürüm iOS 26'da KeyboardAvoidingView zinciriyle birlikte içeriği sıfır
// yüksekliğe düşürüyor ve ekran boş render ediliyordu.
import { SafeAreaView } from "react-native-safe-area-context";
import { CloudOff, Heart } from "lucide-react-native";
import { useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { PendingLikeCard } from "../../components/pending-like-card";
import { EmptyState } from "../../components/ui/empty-state";
import { LikeCardSkeleton } from "../../components/ui/skeleton";
import { loadPendingLikes, loadPendingLikesCount } from "../../core/api/likes";

export default function LikesScreen() {
  /*
    Zamanlayıcıyla YENİLENMİYOR — bilerek.

    Önce iki sorgu da 15 saniyede bir polling yapıyordu. Üç sebeple
    kaldırıldı:

    1. Beğeni zaman kritik değil. Beş dakika sonra görmek hiçbir şey
       kaybettirmiyor; sohbetten farkı bu. Realtime'ı sohbete koyduk çünkü
       orası karşılıklı ve anlık bir alışveriş.
    2. Ekran açık kaldıkça sürekli iki RPC atmak, hiçbir kullanıcı faydası
       olmayan bir maliyet.
    3. Asıl mesele ürün değeri: burası ödeme yüzeyi. Kullanıcı bakarken
       kendiliğinden artan bir sayaç kumar makinesidir ve
       `monetization.md`'deki "asla satılmayacaklar" duruşuyla çelişir.
       Sayının artması kullanıcının EYLEMİNE bağlı olmalı, saate değil.

    Yerine: sekmeye her girişte tazeleme + aşağı çekerek yenileme.
  */
  const count = useQuery({
    queryKey: ["pending-likes", "count"],
    queryFn: loadPendingLikesCount,
  });
  const likes = useQuery({
    queryKey: ["pending-likes", "cards"],
    queryFn: loadPendingLikes,
  });

  const isLoading = count.isLoading || likes.isLoading;
  const isError = count.isError || likes.isError;
  const isRefetching = count.isRefetching || likes.isRefetching;
  const refetch = () => {
    void count.refetch();
    void likes.refetch();
  };

  // Sekmeye her dönüşte bir kez tazele.
  useFocusEffect(
    useCallback(() => {
      refetch();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <View className="px-5 pb-4 pt-4">
        <Text className="text-2xl font-bold text-text-primary">Beğeniler</Text>
        <Text className="mt-1 text-sm text-text-secondary">
          Petine gelen ilgiyi gör; kimlikler karşılıklı beğenide açılır.
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-row flex-wrap justify-between gap-y-3 px-5">
          <LikeCardSkeleton />
          <LikeCardSkeleton />
          <LikeCardSkeleton />
          <LikeCardSkeleton />
        </View>
      ) : null}

      {isError && !isLoading ? (
        <View className="flex-1 justify-center">
          <EmptyState
            icon={CloudOff}
            title="Beğeniler yüklenemedi"
            description="Bağlantını kontrol edip yeniden deneyebilirsin."
            tone="danger"
            action={{ label: "Tekrar dene", onPress: refetch }}
          />
        </View>
      ) : null}

      {!isLoading && !isError ? (
        <ScrollView
          contentContainerClassName="px-5 pb-10"
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#F97362" />
          }
        >
          {(count.data ?? 0) === 0 ? (
            <View className="mt-8">
              <EmptyState
                icon={Heart}
                title="Henüz beğeni yok"
                description="Petin birini beğendiğinde burada göreceksin."
              />
            </View>
          ) : (
            <>
              <View className="mb-4 flex-row items-center rounded-2xl border border-brand/25 bg-brand/5 p-3.5">
                <AppIcon name="heart" color="#F97362" size={20} />
                <Text className="ml-2.5 flex-1 text-sm font-semibold text-text-primary">
                  {count.data} kişi petini beğendi
                </Text>
              </View>
              <View className="flex-row flex-wrap justify-between gap-y-3">
                {(likes.data ?? []).map(({ card, likedAt }) => (
                  <PendingLikeCard key={`${card.id}-${likedAt}`} card={card} />
                ))}
              </View>
            </>
          )}
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}
