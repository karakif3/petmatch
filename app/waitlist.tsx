import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { BrandMark } from "../components/brand-mark";
import { Button } from "../components/ui/button";
import { Checkbox } from "../components/ui/checkbox";
import { AppPressable } from "../components/ui/pressable";
import { listRegions, loadMyRegionWaitlist, setMyRegion } from "../core/api/regions";
import { errorMessage } from "../core/domain/error-message";
import { useAuthStore } from "../stores/auth";

export default function RegionWaitlistScreen() {
  const queryClient = useQueryClient();
  const signOut = useAuthStore((state) => state.signOut);
  const retryAccountStatus = useAuthStore((state) => state.retryOnboardingStatus);
  const waitlist = useQuery({ queryKey: ["region-waitlist"], queryFn: loadMyRegionWaitlist });
  const regions = useQuery({ queryKey: ["regions"], queryFn: listRegions });
  const pilotRegions = useMemo(
    () => (regions.data ?? []).filter((region) => region.isPilot),
    [regions.data],
  );
  const outsideRegion = useMemo(
    () => (regions.data ?? []).find((region) => !region.isPilot) ?? null,
    [regions.data],
  );
  const [editing, setEditing] = useState(false);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [requestedLocation, setRequestedLocation] = useState("");
  const [notifyWhenOpen, setNotifyWhenOpen] = useState(false);

  useEffect(() => {
    if (!waitlist.data || editing) return;
    setRequestedLocation(waitlist.data.requestedLocation);
    setNotifyWhenOpen(waitlist.data.notifyWhenOpen);
    setSelectedSlug(outsideRegion?.slug ?? null);
  }, [editing, outsideRegion?.slug, waitlist.data]);

  const saveRegion = useMutation({
    mutationFn: async () => {
      if (!selectedSlug) throw new Error("Bir bölge seçmelisin.");
      const isOutside = selectedSlug === outsideRegion?.slug;
      if (isOutside && !requestedLocation.trim()) {
        throw new Error("Bulunduğun ilçe veya şehri yazmalısın.");
      }
      await setMyRegion(
        selectedSlug,
        isOutside ? { requestedLocation, notifyWhenOpen } : undefined,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["region-waitlist"] });
      setEditing(false);
      await retryAccountStatus();
    },
  });

  const beginEditing = () => {
    setRequestedLocation(waitlist.data?.requestedLocation ?? "");
    setNotifyWhenOpen(waitlist.data?.notifyWhenOpen ?? false);
    setSelectedSlug(outsideRegion?.slug ?? null);
    saveRegion.reset();
    setEditing(true);
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary px-6">
      <View className="flex-1 justify-center">
        <BrandMark size={58} />
        <View className="mt-7 h-12 w-12 items-center justify-center rounded-full bg-accent/10">
          <MapPin size={25} strokeWidth={2.25} color="#1E9384" />
        </View>
        <Text accessibilityRole="header" className="mt-5 text-3xl font-bold text-text-primary">
          Sıradaki bölgeyi birlikte seçiyoruz
        </Text>

        {editing ? (
          <View className="mt-5">
            <Text className="text-sm font-semibold text-text-primary">Bölgeni seç</Text>
            <View className="mt-3 flex-row flex-wrap gap-2">
              {regions.isLoading ? <ActivityIndicator color="#F97362" /> : null}
              {pilotRegions.map((region) => {
                const active = selectedSlug === region.slug;
                return (
                  <AppPressable
                    key={region.slug}
                    onPress={() => setSelectedSlug(region.slug)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    className={`min-h-11 justify-center rounded-xl border px-4 ${
                      active ? "border-brand bg-brand/10" : "border-border bg-surface"
                    }`}
                  >
                    <Text className={active ? "font-semibold text-brand-dark" : "font-semibold text-text-secondary"}>
                      {region.name}
                    </Text>
                  </AppPressable>
                );
              })}
              {outsideRegion ? (
                <AppPressable
                  onPress={() => setSelectedSlug(outsideRegion.slug)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: selectedSlug === outsideRegion.slug }}
                  className={`min-h-11 justify-center rounded-xl border px-4 ${
                    selectedSlug === outsideRegion.slug
                      ? "border-brand bg-brand/10"
                      : "border-border bg-surface"
                  }`}
                >
                  <Text className="font-semibold text-text-secondary">{outsideRegion.name}</Text>
                </AppPressable>
              ) : null}
            </View>

            {selectedSlug === outsideRegion?.slug ? (
              <View className="mt-4">
                <Text className="mb-2 text-sm font-semibold text-text-primary">İlçe veya şehir</Text>
                <TextInput
                  value={requestedLocation}
                  onChangeText={setRequestedLocation}
                  placeholder="Örn. Üsküdar veya Ankara"
                  autoCapitalize="words"
                  accessibilityLabel="Bulunduğun ilçe veya şehir"
                  className="min-h-12 rounded-xl border border-border bg-surface px-4 text-text-primary"
                />
                <View className="mt-4">
                  <Checkbox checked={notifyWhenOpen} onChange={setNotifyWhenOpen}>
                    <Text className="font-semibold text-text-primary">Bölgem açıldığında haber ver</Text>
                  </Checkbox>
                </View>
              </View>
            ) : null}

            {regions.isError ? (
              <Text accessibilityRole="alert" className="mt-3 text-sm text-danger">
                Bölgeler yüklenemedi. Tekrar deneyebilirsin.
              </Text>
            ) : null}
            {saveRegion.error ? (
              <Text accessibilityRole="alert" className="mt-3 text-sm font-semibold text-danger">
                {errorMessage(saveRegion.error, "Bölge kaydedilemedi.")}
              </Text>
            ) : null}
            <Button
              label="Bölgeyi kaydet"
              onPress={() => saveRegion.mutate()}
              loading={saveRegion.isPending}
              disabled={regions.isLoading || regions.isError}
              className="mt-5"
            />
            <Button label="Vazgeç" onPress={() => setEditing(false)} variant="ghost" className="mt-2" />
          </View>
        ) : (
          <>
            {waitlist.isLoading ? (
              <ActivityIndicator className="mt-6 self-start" color="#F97362" />
            ) : (
              <Text className="mt-4 text-base leading-7 text-text-secondary">
                {waitlist.data?.requestedLocation ?? "Bulunduğun bölge"} henüz PetMatch&apos;in açık bölgeleri arasında değil. Talebin önceliklendirme listemize eklendi.
              </Text>
            )}
            <View className="mt-6 rounded-xl border border-border bg-surface p-4">
              <Text className="text-sm font-bold text-text-primary">Açık bölgeler</Text>
              {regions.isLoading ? (
                <ActivityIndicator className="mt-3 self-start" color="#F97362" />
              ) : (
                <Text className="mt-2 text-sm leading-6 text-text-secondary">
                  {pilotRegions.map((region) => region.name).join(" · ") || "Açık bölge bilgisi alınamadı"}
                </Text>
              )}
              <Text className="mt-3 text-xs leading-5 text-text-tertiary">
                {waitlist.data?.notifyWhenOpen
                  ? "Bölgen açıldığında kayıtlı bildirim tercihin üzerinden haber vereceğiz."
                  : "Talebin sayılıyor; açılış bildirimi istemedin."}
              </Text>
            </View>
            {waitlist.isError || regions.isError ? (
              <Text accessibilityRole="alert" className="mt-4 text-sm text-danger">
                Bölge bilgileri alınamadı. Tekrar deneyebilirsin.
              </Text>
            ) : null}
            <Button
              label="Bölgemi yeniden kontrol et"
              onPress={() => void retryAccountStatus()}
              className="mt-7"
            />
            <Button label="Bölge talebini düzenle" onPress={beginEditing} variant="secondary" className="mt-3" />
            <Button label="Çıkış yap" onPress={() => void signOut()} variant="ghost" className="mt-2" />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
