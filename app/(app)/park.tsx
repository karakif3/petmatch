import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { CloudOff, MapPin } from "lucide-react-native";
import { useFocusEffect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "../../components/ui/button";
import { EmptyState } from "../../components/ui/empty-state";
import { AppIcon } from "../../components/ui/icon";
import { AppPressable } from "../../components/ui/pressable";
import { listMeetupPlaces } from "../../core/api/meetup-places";
import { trackProductEvent } from "../../core/api/observability";
import {
  PARK_DURATIONS,
  endMyParkCheckin,
  groupByPlace,
  listParkNow,
  loadParkNotificationsEnabled,
  minutesLeft,
  setParkNotifications,
  startParkCheckin,
  type ParkCheckin,
} from "../../core/api/park";
import { errorMessage } from "../../core/domain/error-message";
import { sizeLabels } from "../../core/domain/labels";
import { successHaptic } from "../../core/ui/haptics";

const PARK_QUERY_KEY = ["park-now"] as const;

function CheckinRow({ checkin, now }: { checkin: ParkCheckin; now: Date }) {
  return (
    <View className="flex-row items-center gap-3 py-2">
      {checkin.petPhotoUrl ? (
        <Image
          source={{ uri: checkin.petPhotoUrl }}
          style={{ width: 44, height: 44, borderRadius: 22 }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View className="h-11 w-11 items-center justify-center rounded-full bg-brand/10">
          <AppIcon name="paw-print" color="#F97362" size={20} />
        </View>
      )}
      <View className="flex-1">
        <Text className="text-sm font-semibold text-text-primary">
          {checkin.petName}
          {checkin.isMine ? " (sen)" : ""}
        </Text>
        <Text className="text-xs text-text-secondary">
          {checkin.species === "dog" ? "Köpek" : "Kedi"} · {sizeLabels[checkin.size]}
          {checkin.ownerName ? ` · ${checkin.ownerName}` : ""}
        </Text>
      </View>
      <Text className="text-xs font-semibold text-text-secondary">
        {minutesLeft(checkin.endsAt, now)} dk
      </Text>
    </View>
  );
}

export default function ParkScreen() {
  const queryClient = useQueryClient();
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [duration, setDuration] = useState<number>(60);
  const [now, setNow] = useState(() => new Date());

  const park = useQuery({ queryKey: PARK_QUERY_KEY, queryFn: listParkNow });
  const places = useQuery({ queryKey: ["meetup-places"], queryFn: listMeetupPlaces });
  const notifications = useQuery({
    queryKey: ["park-notifications"],
    queryFn: loadParkNotificationsEnabled,
  });

  // Kalan dakikalar dakikada bir tazelensin; liste ise odakta ve çekince.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void park.refetch();
      void trackProductEvent("park_now_viewed");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const mine = useMemo(() => (park.data ?? []).find((c) => c.isMine) ?? null, [park.data]);
  const groups = useMemo(() => groupByPlace(park.data ?? []), [park.data]);

  const start = useMutation({
    mutationFn: () => {
      if (!placeId) throw new Error("Bir yer seç.");
      return startParkCheckin({ placeId, durationMinutes: duration });
    },
    onSuccess: async () => {
      successHaptic();
      await queryClient.invalidateQueries({ queryKey: PARK_QUERY_KEY });
    },
    onError: (error) =>
      Alert.alert("Paylaşılamadı", errorMessage(error, "Bağlantını kontrol edip tekrar dene.")),
  });

  const end = useMutation({
    mutationFn: endMyParkCheckin,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: PARK_QUERY_KEY }),
    onError: (error) =>
      Alert.alert("Bitirilemedi", errorMessage(error, "Bağlantını kontrol edip tekrar dene.")),
  });

  const toggleNotifications = useMutation({
    mutationFn: setParkNotifications,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["park-notifications"] }),
    onError: (error) =>
      Alert.alert("Kaydedilemedi", errorMessage(error, "Bağlantını kontrol edip tekrar dene.")),
  });

  const joinPlace = (id: string) => {
    setPlaceId(id);
    if (!mine) start.mutate();
  };

  const verifiedPlaces = places.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        refreshControl={
          <RefreshControl
            refreshing={park.isRefetching}
            onRefresh={() => void park.refetch()}
            tintColor="#F97362"
          />
        }
      >
        <View className="pb-4 pt-4">
          <Text className="text-2xl font-bold text-text-primary">Şimdi parkta</Text>
          <Text className="mt-1 text-sm text-text-secondary">
            Parka çıkıyorsan haber ver; yakındaki petler katılsın. Eşleşme gerekmez.
          </Text>
        </View>

        {mine ? (
          <View className="mb-5 rounded-2xl border border-brand/30 bg-brand/5 p-4">
            <View className="flex-row items-center">
              <AppIcon name="map-pin" color="#F97362" size={20} />
              <Text className="ml-2 flex-1 text-base font-bold text-text-primary">
                {mine.placeName}
              </Text>
              <Text className="text-sm font-semibold text-brand">
                {minutesLeft(mine.endsAt, now)} dk
              </Text>
            </View>
            <Text className="mt-1 text-sm text-text-secondary">
              {mine.petName} ile oradasın. Bölgendeki sahiplere haber verildi.
            </Text>
            <Button
              label="Parktan ayrıldım"
              variant="secondary"
              loading={end.isPending}
              onPress={() => end.mutate()}
              className="mt-3"
            />
          </View>
        ) : (
          <View className="mb-5 rounded-2xl border border-border bg-surface p-4">
            <Text className="mb-2 text-sm font-semibold text-text-primary">Neredesin?</Text>
            {places.isLoading ? (
              <Text className="text-sm text-text-secondary">Yerler yükleniyor…</Text>
            ) : verifiedPlaces.length === 0 ? (
              <Text className="text-sm text-text-secondary">
                Bölgende henüz doğrulanmış buluşma yeri yok. Yerler saha teyidinden sonra açılıyor.
              </Text>
            ) : (
              <View className="flex-row flex-wrap gap-2">
                {verifiedPlaces.map((place) => {
                  const active = placeId === place.id;
                  return (
                    <AppPressable
                      key={place.id}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: active }}
                      onPress={() => setPlaceId(place.id)}
                      className={`min-h-11 justify-center rounded-full border px-4 ${
                        active ? "border-brand bg-brand/10" : "border-border bg-bg-primary"
                      }`}
                    >
                      <Text
                        className={`text-sm font-semibold ${active ? "text-brand" : "text-text-primary"}`}
                      >
                        {place.name}
                      </Text>
                    </AppPressable>
                  );
                })}
              </View>
            )}

            <Text className="mb-2 mt-4 text-sm font-semibold text-text-primary">Ne kadar?</Text>
            <View className="flex-row gap-2">
              {PARK_DURATIONS.map((minutes) => {
                const active = duration === minutes;
                return (
                  <AppPressable
                    key={minutes}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: active }}
                    onPress={() => setDuration(minutes)}
                    className={`min-h-11 flex-1 items-center justify-center rounded-xl border ${
                      active ? "border-brand bg-brand/10" : "border-border bg-bg-primary"
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${active ? "text-brand" : "text-text-primary"}`}
                    >
                      {minutes} dk
                    </Text>
                  </AppPressable>
                );
              })}
            </View>

            <Button
              label="Parktayım"
              loading={start.isPending}
              disabled={!placeId}
              onPress={() => start.mutate()}
              className="mt-4"
            />
            <Text className="mt-2 text-xs leading-4 text-text-secondary">
              Yalnız seçtiğin halka açık yer paylaşılır; konumun paylaşılmaz.
              Sahip adın yalnız profilin keşfette görünürse çıkar.
            </Text>
          </View>
        )}

        {park.isError ? (
          <EmptyState
            icon={CloudOff}
            title="Liste yüklenemedi"
            description="Bağlantını kontrol edip yeniden deneyebilirsin."
            tone="danger"
            action={{ label: "Tekrar dene", onPress: () => void park.refetch() }}
          />
        ) : groups.filter((group) => group.checkins.some((c) => !c.isMine)).length === 0 &&
          !park.isLoading ? (
          <EmptyState
            icon={MapPin}
            title="Şu an parkta kimse yok"
            description="İlk sen haber ver; bölgendeki sahipler bildirim alır."
          />
        ) : (
          groups.map((group) => (
            <View
              key={group.placeId}
              className="mb-3 rounded-2xl border border-border bg-surface px-4 py-3"
            >
              <View className="mb-1 flex-row items-center">
                <Text className="flex-1 text-base font-bold text-text-primary">
                  {group.placeName}
                </Text>
                <Text className="text-xs font-semibold text-text-secondary">
                  {group.checkins.length} pet
                </Text>
              </View>
              {group.checkins.map((checkin) => (
                <CheckinRow key={checkin.id} checkin={checkin} now={now} />
              ))}
              {!mine ? (
                <Button
                  label="Ben de geliyorum"
                  variant="secondary"
                  loading={start.isPending && placeId === group.placeId}
                  onPress={() => joinPlace(group.placeId)}
                  className="mt-2"
                />
              ) : null}
            </View>
          ))
        )}

        <View className="mt-4 flex-row items-center rounded-2xl border border-border bg-surface p-4">
          <Text className="flex-1 text-sm text-text-primary">
            Bölgemde biri parka çıkınca bildir
          </Text>
          <Switch
            value={notifications.data ?? true}
            disabled={notifications.isLoading || toggleNotifications.isPending}
            onValueChange={(value) => toggleNotifications.mutate(value)}
            trackColor={{ true: "#F97362" }}
            accessibilityLabel="Park bildirimleri"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
