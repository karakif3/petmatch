import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  expressAdoptionInterest,
  listAdoptablePets,
  type AdoptablePet,
} from "../../core/api/adoption";
import { trackProductEvent } from "../../core/api/observability";
import { formatAge } from "../../core/domain/age";

/**
 * Sahiplendirme yüzeyi.
 *
 * Keşfet destesi DEĞİL, bilerek liste: yuva sahiplenmek anlık bir karar değil.
 * Swipe'lamak bu kararı hafifletir ve barınakların en çok şikâyet ettiği şey
 * budur.
 *
 * Sıralamayı sunucu yapıyor: yanıt veren ve aktif ilan sahipleri önce.
 * Bekleme süresine göre sıralamak bayat ilanları yukarı taşır ve başvuranı
 * ölü uçlara sürer.
 */

function AdoptionCard({
  pet,
  onApply,
  applying,
}: {
  pet: AdoptablePet;
  onApply: (pet: AdoptablePet) => void;
  applying: boolean;
}) {
  const age = formatAge(pet.birthDate);

  return (
    <View className="mx-4 mb-3 overflow-hidden rounded-2xl border border-border bg-surface">
      <View className="h-44 w-full bg-bg-tertiary">
        {pet.photoUrls[0] ? (
          <Image
            source={pet.photoUrls[0]}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Ionicons name="home-outline" size={40} color="#C4B7AE" />
          </View>
        )}
      </View>

      <View className="p-4">
        <View className="flex-row items-center">
          <Text className="flex-1 text-lg font-bold text-text-primary" numberOfLines={1}>
            {pet.name}
          </Text>
          {pet.ownerVerified ? (
            <View className="flex-row items-center rounded-full bg-accent/10 px-2 py-0.5">
              <Ionicons name="shield-checkmark" size={12} color="#1E9384" />
              <Text className="ml-1 text-[11px] font-bold text-accent-dark">Doğrulanmış</Text>
            </View>
          ) : null}
        </View>

        <Text className="mt-1 text-sm text-text-secondary">
          {[pet.species === "dog" ? "Köpek" : "Kedi", pet.breed, age, pet.city]
            .filter(Boolean)
            .join(" · ")}
        </Text>

        {pet.bio ? (
          <Text className="mt-2 text-sm leading-5 text-text-secondary" numberOfLines={3}>
            {pet.bio}
          </Text>
        ) : null}

        <Pressable
          onPress={() => onApply(pet)}
          disabled={pet.alreadyApplied || applying}
          accessibilityRole="button"
          accessibilityLabel={
            pet.alreadyApplied
              ? `${pet.name} için başvurun gönderildi`
              : `${pet.name} ile ilgilendiğini bildir`
          }
          className={`mt-4 min-h-12 flex-row items-center justify-center rounded-xl px-4 ${
            pet.alreadyApplied ? "border border-border bg-bg-secondary" : "bg-brand"
          } disabled:opacity-70`}
        >
          {applying ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <>
              <Ionicons
                name={pet.alreadyApplied ? "checkmark-circle-outline" : "heart-outline"}
                size={17}
                color={pet.alreadyApplied ? "#6B5D55" : "#FFFFFF"}
              />
              <Text
                className={`ml-2 text-sm font-bold ${
                  pet.alreadyApplied ? "text-text-secondary" : "text-white"
                }`}
              >
                {pet.alreadyApplied ? "Başvurun gönderildi" : "İlgileniyorum"}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export default function AdoptionScreen() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<AdoptablePet | null>(null);
  const [note, setNote] = useState("");

  const listings = useQuery({
    queryKey: ["adoptable-pets"],
    queryFn: () => listAdoptablePets(),
  });

  useEffect(() => {
    void trackProductEvent("adoption_surface_viewed");
  }, []);

  const apply = useMutation({
    mutationFn: async ({ petId, message }: { petId: string; message: string }) =>
      expressAdoptionInterest(petId, message),
    onSuccess: async () => {
      setSelected(null);
      setNote("");
      Alert.alert(
        "Başvurun gönderildi",
        "İlan sahibi başvurunu inceleyecek. Kabul ederse sohbet açılır ve Eşleşmeler sekmesinde görürsün.",
      );
      await queryClient.invalidateQueries({ queryKey: ["adoptable-pets"] });
    },
    onError: (error) => {
      Alert.alert(
        "Başvuru gönderilemedi",
        error instanceof Error ? error.message : "Bir şeyler ters gitti.",
      );
    },
  });

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <View className="flex-row items-center border-b border-border px-3 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Geri"
          className="min-h-11 min-w-11 items-center justify-center"
        >
          <Ionicons name="chevron-back" size={24} color="#1F1A17" />
        </Pressable>
        <View className="flex-1">
          <Text className="text-lg font-bold text-text-primary">Yuva arayanlar</Text>
          <Text className="text-xs text-text-secondary">
            Sahiplendirmek için ilan veren doğrulanmış profiller
          </Text>
        </View>
      </View>

      {listings.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F97362" size="large" />
        </View>
      ) : null}

      {listings.isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline-outline" size={42} color="#E5484D" />
          <Text className="mt-3 text-center text-sm text-text-secondary">
            İlanlar yüklenemedi.
          </Text>
          <Pressable
            onPress={() => listings.refetch()}
            className="mt-4 min-h-11 items-center justify-center rounded-xl bg-brand px-5"
          >
            <Text className="text-sm font-bold text-white">Tekrar dene</Text>
          </Pressable>
        </View>
      ) : null}

      {!listings.isLoading && !listings.isError ? (
        <FlashList
          data={listings.data ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <AdoptionCard
              pet={item}
              applying={apply.isPending && selected?.id === item.id}
              onApply={(pet) => {
                setSelected(pet);
                setNote("");
              }}
            />
          )}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 28 }}
          refreshControl={
            <RefreshControl
              refreshing={listings.isRefetching}
              onRefresh={() => listings.refetch()}
              tintColor="#F97362"
            />
          }
          ListEmptyComponent={
            <View className="items-center px-8 py-20">
              <Ionicons name="home-outline" size={52} color="#C4B7AE" />
              <Text className="mt-4 text-center text-lg font-bold text-text-primary">
                Şu an yuva arayan yok
              </Text>
              <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
                Yakınında sahiplendirme ilanı açıldığında burada görünecek.
              </Text>
            </View>
          }
        />
      ) : null}

      {/* Başvuru notu — barınak/sahip için en önemli bilgi burada veriliyor. */}
      {selected ? (
        <View className="border-t border-border bg-surface px-4 pb-5 pt-4">
          <Text className="text-sm font-bold text-text-primary">
            {selected.name} için başvuru
          </Text>
          <Text className="mt-1 text-xs leading-4 text-text-secondary">
            Yaşam alanın, deneyimin ve gününün ne kadarını evde geçirdiğin en çok
            merak edilen şeyler.
          </Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Kendinden kısaca bahset…"
            placeholderTextColor="#C4B7AE"
            multiline
            maxLength={1000}
            className="mt-3 min-h-20 rounded-xl border border-border bg-bg-secondary px-3 py-2.5 text-sm text-text-primary"
          />
          <View className="mt-3 flex-row gap-2">
            <Pressable
              onPress={() => setSelected(null)}
              className="min-h-12 flex-1 items-center justify-center rounded-xl border border-border"
            >
              <Text className="text-sm font-semibold text-text-secondary">Vazgeç</Text>
            </Pressable>
            <Pressable
              onPress={() => apply.mutate({ petId: selected.id, message: note })}
              disabled={apply.isPending}
              className="min-h-12 flex-1 items-center justify-center rounded-xl bg-brand disabled:opacity-60"
            >
              {apply.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text className="text-sm font-bold text-white">Gönder</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
