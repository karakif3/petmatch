import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { BrandMark } from "../components/brand-mark";
import { AppPressable } from "../components/ui/pressable";
import { loadMyRegionWaitlist } from "../core/api/regions";
import { useAuthStore } from "../stores/auth";

export default function RegionWaitlistScreen() {
  const signOut = useAuthStore((state) => state.signOut);
  const retryAccountStatus = useAuthStore((state) => state.retryOnboardingStatus);
  const waitlist = useQuery({ queryKey: ["region-waitlist"], queryFn: loadMyRegionWaitlist });

  return (
    <SafeAreaView className="flex-1 bg-bg-primary px-6">
      <View className="flex-1 justify-center">
        <BrandMark size={58} />
        <View className="mt-7 h-12 w-12 items-center justify-center rounded-full bg-accent/10">
          <Ionicons name="location-outline" size={25} color="#1E9384" />
        </View>
        <Text className="mt-5 text-3xl font-bold text-text-primary">Sıradaki bölgeyi birlikte seçiyoruz</Text>
        {waitlist.isLoading ? (
          <ActivityIndicator className="mt-6 self-start" color="#F97362" />
        ) : (
          <Text className="mt-4 text-base leading-7 text-text-secondary">
            {waitlist.data?.requestedLocation ?? "Bulunduğun bölge"} henüz PetMatch&apos;in açık bölgeleri arasında değil. Talebin önceliklendirme listemize eklendi.
          </Text>
        )}
        <View className="mt-6 rounded-xl border border-border bg-surface p-4">
          <Text className="text-sm font-bold text-text-primary">Açık bölgeler</Text>
          <Text className="mt-2 text-sm leading-6 text-text-secondary">Kadıköy · Nişantaşı · Beşiktaş</Text>
          <Text className="mt-3 text-xs leading-5 text-text-tertiary">
            {waitlist.data?.notifyWhenOpen
              ? "Bölgen açıldığında kayıtlı bildirim tercihin üzerinden haber vereceğiz."
              : "Talebin sayılıyor; açılış bildirimi istemedin."}
          </Text>
        </View>
        {waitlist.isError ? (
          <Text className="mt-4 text-sm text-danger">Bekleme listesi bilgisi alınamadı.</Text>
        ) : null}
        <AppPressable
          onPress={() => void retryAccountStatus()}
          className="mt-7 min-h-12 items-center justify-center rounded-xl bg-brand px-5"
        >
          <Text className="font-bold text-white">Bölgemi yeniden kontrol et</Text>
        </AppPressable>
        <AppPressable
          onPress={() => void signOut()}
          className="mt-2 min-h-12 items-center justify-center px-5"
        >
          <Text className="font-semibold text-text-secondary">Çıkış yap</Text>
        </AppPressable>
      </View>
    </SafeAreaView>
  );
}
