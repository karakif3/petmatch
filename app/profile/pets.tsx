import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { AppIcon } from "../../components/ui/icon";
import { AppPressable } from "../../components/ui/pressable";
import { createMyPet, listMyPets, setActivePet } from "../../core/api/pets";
import { savePetPhotos, type LocalProfilePhoto } from "../../core/api/profile";
import { errorMessage } from "../../core/domain/error-message";
import type { Species } from "../../core/domain/types";
import { successHaptic } from "../../core/ui/haptics";
import { useAuthStore } from "../../stores/auth";

/**
 * PETLERİM — ikinci pet ekleme ve aktif peti değiştirme.
 *
 * `0012` "tek aktif pet" kuralını veritabanına yazmış, `mvp-scope.md` de
 * "kullanıcı aktif peti profil ekranından değiştirir" demişti — ama o ekran
 * hiç yapılmamıştı. Pet yalnızca onboarding'de yaratılabiliyordu, yani
 * pratikte kural "tek hesap = sonsuza kadar tek pet"ti.
 *
 * En çok acıtan yer petin ölmesiydi: kullanıcının tek çıkışı hesabı silmekti
 * ve o da bütün eşleşmelerini, sohbetlerini götürüyordu.
 *
 * Ekranın iki kuralı:
 * - **Eski pet SİLİNMİYOR**, arşivde kalıyor. Sohbet geçmişi onun üzerinden
 *   asılı (`conversation_participants`, `0012`) ve bir petin kaydı, sahibi
 *   için bir anı.
 * - **Aktifleştirme ayrı bir adım.** Yeni pet pasif doğuyor; kullanıcı
 *   fotoğrafını ekleyip bilinçli olarak aktif ediyor, yoksa mevcut petinin
 *   destedeki yerini yan etki olarak kaybederdi.
 */
export default function PetsScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [photos, setPhotos] = useState<LocalProfilePhoto[]>([]);
  const [error, setError] = useState<string | null>(null);

  const pets = useQuery({
    queryKey: ["my-pets", user?.id],
    queryFn: () => listMyPets(user!.id),
    enabled: Boolean(user),
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["my-pets", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["discovery", user?.id] }),
      queryClient.invalidateQueries({ queryKey: ["profile-completion", user?.id] }),
    ]);
  };

  const activate = useMutation({
    mutationFn: (petId: string) => setActivePet(petId),
    onSuccess: async () => {
      successHaptic();
      await invalidate();
    },
    onError: (mutationError) =>
      setError(errorMessage(mutationError, "Aktif pet değiştirilemedi.")),
  });

  const pickPhotos = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Fotoğraf seçmek için galeri izni gerekiyor.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 6,
      quality: 0.85,
    });
    if (result.canceled) return;
    setPhotos(
      result.assets.slice(0, 6).map((asset) => ({
        uri: asset.uri,
        fileName: asset.fileName ?? null,
        mimeType: asset.mimeType ?? null,
      })),
    );
  };

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Oturum bulunamadı.");
      if (!name.trim()) throw new Error("Petinin adını yazmalısın.");
      if (photos.length === 0) throw new Error("En az bir fotoğraf eklemelisin.");
      const petId = await createMyPet({ name, species, gender });
      // Fotoğraflar ayrı adımda: `0062` peti PASİF yaratıyor, fotoğraf
      // eklenmeden aktif edilemiyor.
      await savePetPhotos({
        userId: user.id,
        petId,
        // Yeni pet, dolayısıyla temizlenecek eski yol yok.
        previousStoragePaths: [],
        photos: photos.map((photo) => ({ kind: "local" as const, ...photo })),
      });
    },
    onSuccess: async () => {
      successHaptic();
      setAdding(false);
      setName("");
      setPhotos([]);
      await invalidate();
    },
    onError: (mutationError) =>
      setError(errorMessage(mutationError, "Pet eklenemedi.")),
  });

  const busy = activate.isPending || create.isPending;

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <View className="flex-row items-center border-b border-border bg-surface px-3 py-2.5">
        <AppPressable
          onPress={() => router.back()}
          accessibilityLabel="Geri"
          className="h-11 w-11 items-center justify-center rounded-full"
        >
          <AppIcon name="chevron-left" color="#1F1A17" size={27} />
        </AppPressable>
        <View className="ml-1 flex-1">
          <Text className="text-lg font-bold text-text-primary">Petlerim</Text>
          <Text className="text-xs text-text-tertiary">
            Keşfet ve eşleşme her zaman tek aktif pet üzerinden yürür.
          </Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="px-5 py-5 pb-12">
        {pets.isLoading ? (
          <ActivityIndicator color="#F97362" />
        ) : (
          (pets.data ?? []).map((pet) => (
            <View
              key={pet.id}
              className={`mb-3 flex-row items-center rounded-2xl border p-3.5 ${
                pet.isActive ? "border-brand bg-brand/5" : "border-border bg-surface"
              }`}
            >
              {pet.photoUrl ? (
                <Image
                  source={pet.photoUrl}
                  contentFit="cover"
                  style={{ width: 56, height: 56, borderRadius: 16 }}
                />
              ) : (
                <View className="h-14 w-14 items-center justify-center rounded-2xl bg-bg-tertiary">
                  <AppIcon name="paw-print" color="#C4B7AE" size={24} />
                </View>
              )}
              <View className="ml-3 flex-1">
                <Text className="text-base font-bold text-text-primary">{pet.name}</Text>
                <Text className="mt-0.5 text-xs text-text-secondary">
                  {pet.species === "dog" ? "Köpek" : "Kedi"} ·{" "}
                  {pet.gender === "female" ? "Dişi" : "Erkek"}
                  {pet.photoCount === 0 ? " · fotoğraf yok" : ""}
                </Text>
              </View>
              {pet.isActive ? (
                <View className="rounded-full bg-brand px-3 py-1.5">
                  <Text className="text-[11px] font-bold text-white">Aktif</Text>
                </View>
              ) : (
                <AppPressable
                  onPress={() => activate.mutate(pet.id)}
                  disabled={busy || pet.photoCount === 0}
                  accessibilityRole="button"
                  accessibilityLabel={`${pet.name} petini aktif yap`}
                  className="rounded-full border border-brand px-3 py-1.5 disabled:opacity-40"
                >
                  <Text className="text-[11px] font-bold text-brand-dark">Aktif yap</Text>
                </AppPressable>
              )}
            </View>
          ))
        )}

        {/*
          Arşivin ne anlama geldiğini SÖYLEMEK gerekiyor: kullanıcı "aktif
          yap"a basarken diğer petinin silineceğini sanabilir. Bu ekranın en
          kritik cümlesi bu.
        */}
        {(pets.data?.length ?? 0) > 1 ? (
          <Text className="mb-5 text-[11px] leading-4 text-text-tertiary">
            Aktif olmayan petler silinmez; profilleri ve geçmiş sohbetleri
            durur. İstediğin zaman geri alabilirsin.
          </Text>
        ) : null}

        {adding ? (
          <View className="rounded-2xl border border-border bg-surface p-4">
            <Text className="mb-3 text-sm font-bold text-text-primary">Yeni pet</Text>

            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Adı"
              placeholderTextColor="#C4B7AE"
              maxLength={40}
              className="mb-3 rounded-xl border border-border bg-bg-primary px-4 py-3 text-text-primary"
            />

            <View className="mb-3 flex-row gap-2">
              {(["dog", "cat"] as const).map((option) => (
                <AppPressable
                  key={option}
                  onPress={() => setSpecies(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: species === option }}
                  className={`flex-1 items-center rounded-xl border py-2.5 ${
                    species === option ? "border-brand bg-brand/10" : "border-border"
                  }`}
                >
                  <Text
                    className={
                      species === option
                        ? "font-semibold text-brand-dark"
                        : "text-text-secondary"
                    }
                  >
                    {option === "dog" ? "Köpek" : "Kedi"}
                  </Text>
                </AppPressable>
              ))}
            </View>

            <View className="mb-3 flex-row gap-2">
              {(["female", "male"] as const).map((option) => (
                <AppPressable
                  key={option}
                  onPress={() => setGender(option)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: gender === option }}
                  className={`flex-1 items-center rounded-xl border py-2.5 ${
                    gender === option ? "border-brand bg-brand/10" : "border-border"
                  }`}
                >
                  <Text
                    className={
                      gender === option
                        ? "font-semibold text-brand-dark"
                        : "text-text-secondary"
                    }
                  >
                    {option === "female" ? "Dişi" : "Erkek"}
                  </Text>
                </AppPressable>
              ))}
            </View>

            <AppPressable
              onPress={() => void pickPhotos()}
              className="mb-3 flex-row items-center justify-center rounded-xl border border-dashed border-brand/50 py-3"
            >
              <AppIcon name="camera" color="#E0523F" size={17} />
              <Text className="ml-2 text-[13px] font-semibold text-brand-dark">
                {photos.length > 0 ? `${photos.length} fotoğraf seçildi` : "Fotoğraf ekle"}
              </Text>
            </AppPressable>

            <View className="flex-row gap-2">
              <AppPressable
                onPress={() => {
                  setAdding(false);
                  setError(null);
                }}
                className="flex-1 items-center rounded-xl border border-border py-3"
              >
                <Text className="font-semibold text-text-primary">Vazgeç</Text>
              </AppPressable>
              <AppPressable
                onPress={() => create.mutate()}
                disabled={busy || !name.trim() || photos.length === 0}
                className="flex-1 items-center rounded-xl bg-brand py-3 disabled:opacity-50"
              >
                {create.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="font-bold text-white">Ekle</Text>
                )}
              </AppPressable>
            </View>
          </View>
        ) : (
          <AppPressable
            onPress={() => setAdding(true)}
            className="flex-row items-center justify-center rounded-xl border border-dashed border-brand/50 py-3.5"
          >
            <AppIcon name="plus" color="#E0523F" size={18} />
            <Text className="ml-2 font-semibold text-brand-dark">Yeni pet ekle</Text>
          </AppPressable>
        )}

        {error ? <Text className="mt-4 text-sm text-danger">{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
