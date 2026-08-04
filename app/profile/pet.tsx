import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
// SafeAreaView react-native'den DEĞİL buradan geliyor: deprecated olan
// sürüm iOS 26'da KeyboardAvoidingView zinciriyle birlikte içeriği sıfır
// yüksekliğe düşürüyor ve ekran boş render ediliyordu.
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PetAgePicker } from "../../components/pet-age-picker";
import {
  loadEditableProfile,
  savePetPhotos,
  updatePetProfile,
  type LocalProfilePhoto,
} from "../../core/api/profile";
import {
  TEMPERAMENTS,
  type EnergyLevel,
  type Size,
  type Temperament,
} from "../../core/domain/types";
import {
  PET_AGE_UNKNOWN,
  birthDateToPetAge,
  petAgeToBirthDate,
} from "../../core/domain/pet-age";
import { ensureImageLibraryAccess } from "../../core/media/image-library";
import { useAuthStore } from "../../stores/auth";

type PhotoItem =
  | { id: string; kind: "remote"; storagePath: string; uri: string }
  | ({ id: string; kind: "local" } & LocalProfilePhoto);

const sizeOptions: { value: Size; label: string }[] = [
  { value: "small", label: "Küçük" },
  { value: "medium", label: "Orta" },
  { value: "large", label: "Büyük" },
];

const temperamentLabels: Record<Temperament, string> = {
  playful: "Oyuncu",
  calm: "Sakin",
  shy: "Çekingen",
  curious: "Meraklı",
  protective: "Korumacı",
  affectionate: "Sevecen",
  independent: "Bağımsız",
};

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-sm font-semibold text-text-primary">{label}</Text>
      <TextInput
        placeholderTextColor="#9A8B82"
        className="rounded-xl border border-border bg-surface px-4 py-3.5 text-text-primary"
        {...props}
      />
    </View>
  );
}

function Toggle({
  label,
  detail,
  value,
  onValueChange,
}: {
  label: string;
  detail?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View className="flex-row items-center py-3">
      <View className="mr-4 flex-1">
        <Text className="font-semibold text-text-primary">{label}</Text>
        {detail ? (
          <Text className="mt-1 text-xs leading-4 text-text-secondary">{detail}</Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: "#E8DDD5", true: "#FFB4A8" }}
        thumbColor={value ? "#F97362" : "#FFFFFF"}
      />
    </View>
  );
}

export default function PetProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => loadEditableProfile(user!.id),
    enabled: Boolean(user),
  });

  const [name, setName] = useState("");
  const [breed, setBreed] = useState("");
  // Yaş kovası olarak tutuluyor; kaydederken yaklaşık birth_date'e
  // çevriliyor. Kayıt akışıyla aynı kontrol, aynı temsil.
  const [petAge, setPetAge] = useState<string>(PET_AGE_UNKNOWN);
  const [size, setSize] = useState<Size>("medium");
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(3);
  const [isNeutered, setIsNeutered] = useState(false);
  const [temperaments, setTemperaments] = useState<Temperament[]>([]);
  const [goodWithCats, setGoodWithCats] = useState(false);
  const [goodWithDogs, setGoodWithDogs] = useState(false);
  const [goodWithKids, setGoodWithKids] = useState(false);
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.data) return;
    const pet = profile.data.pet;
    setName(pet.name);
    setBreed(pet.breed ?? "");
    setPetAge(birthDateToPetAge(pet.birthDate));
    setSize(pet.size);
    setEnergyLevel(pet.energyLevel);
    setIsNeutered(pet.isNeutered);
    setTemperaments(pet.temperaments);
    setGoodWithCats(pet.goodWithCats);
    setGoodWithDogs(pet.goodWithDogs);
    setGoodWithKids(pet.goodWithKids);
    setBio(pet.bio ?? "");
    setPhotos(
      pet.photos.map((photo) => ({
        id: photo.storagePath,
        kind: "remote",
        storagePath: photo.storagePath,
        uri: photo.url,
      })),
    );
  }, [profile.data]);

  const pickPhotos = async () => {
    setError(null);
    const available = 6 - photos.length;
    if (available < 1) {
      setError("En fazla 6 fotoğraf ekleyebilirsin.");
      return;
    }
    if (!(await ensureImageLibraryAccess())) {
      setError("Fotoğraf seçmek için galeri izni gerekiyor.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: available,
      quality: 0.85,
    });
    if (result.canceled) return;
    const selected: PhotoItem[] = result.assets.slice(0, available).map((asset, index) => ({
      id: `${asset.uri}-${Date.now()}-${index}`,
      kind: "local",
      uri: asset.uri,
      fileName: asset.fileName ?? null,
      mimeType: asset.mimeType ?? null,
    }));
    setPhotos((items) => [...items, ...selected]);
  };

  const movePhoto = (index: number, direction: -1 | 1) => {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= photos.length) return;
    setPhotos((items) => {
      const next = [...items];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const toggleTemperament = (value: Temperament) => {
    setTemperaments((values) =>
      values.includes(value)
        ? values.filter((item) => item !== value)
        : [...values, value],
    );
  };

  const save = async () => {
    if (!user || !profile.data) return;
    if (!name.trim()) return setError("Petinin adını yazmalısın.");
    if (!photos.length) return setError("En az bir pet fotoğrafı kalmalı.");

    setBusy(true);
    setError(null);
    setNotice(null);
    const pet = profile.data.pet;
    try {
      await updatePetProfile({
        petId: pet.id,
        name,
        breed,
        birthDate: petAgeToBirthDate(petAge) ?? "",
        size,
        energyLevel,
        isNeutered,
        temperaments,
        goodWithCats,
        goodWithDogs,
        goodWithKids,
        bio,
      });
      await savePetPhotos({
        userId: user.id,
        petId: pet.id,
        previousStoragePaths: pet.photos.map((photo) => photo.storagePath),
        photos: photos.map((photo) =>
          photo.kind === "remote"
            ? { kind: "remote" as const, storagePath: photo.storagePath }
            : {
                kind: "local" as const,
                uri: photo.uri,
                fileName: photo.fileName,
                mimeType: photo.mimeType,
              },
        ),
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["discovery"] }),
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
      ]);
      await profile.refetch();
      setNotice("Pet profili ve fotoğraf sırası güncellendi.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Pet profili kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  };

  if (profile.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-primary">
        <ActivityIndicator color="#F97362" size="large" />
      </SafeAreaView>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-primary px-8">
        <Text className="text-center text-lg font-bold text-text-primary">
          Pet profili yüklenemedi
        </Text>
        <Pressable onPress={() => profile.refetch()} className="mt-5 rounded-xl bg-brand px-5 py-3">
          <Text className="font-semibold text-white">Tekrar dene</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const pet = profile.data.pet;
  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center border-b border-border bg-surface px-3 py-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Geri"
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <Ionicons name="chevron-back" color="#1F1A17" size={27} />
          </Pressable>
          <View className="ml-2 flex-1">
            <Text className="text-lg font-bold text-text-primary">Pet profilini düzenle</Text>
            <Text className="mt-0.5 text-xs text-text-secondary">
              {pet.species === "dog" ? "Köpek" : "Kedi"} ·{" "}
              {pet.gender === "female" ? "Dişi" : "Erkek"}
            </Text>
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-5 pb-12 pt-5"
        >
          <View className="mb-7">
            <View className="mb-3 flex-row items-end justify-between">
              <View>
                <Text className="text-lg font-bold text-text-primary">Fotoğraflar</Text>
                <Text className="mt-1 text-xs text-text-secondary">
                  İlk fotoğraf kapak olur. Oklarla sırala.
                </Text>
              </View>
              <Text className="text-xs font-semibold text-text-tertiary">{photos.length}/6</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row gap-3">
                {photos.map((photo, index) => (
                  <View key={photo.id} className="w-32 overflow-hidden rounded-2xl border border-border bg-surface">
                    <Image source={photo.uri} contentFit="cover" style={{ width: 128, height: 128 }} />
                    {index === 0 ? (
                      <View className="absolute left-2 top-2 rounded-full bg-brand px-2 py-1">
                        <Text className="text-[10px] font-bold text-white">Kapak</Text>
                      </View>
                    ) : null}
                    <Pressable
                      onPress={() => setPhotos((items) => items.filter((item) => item.id !== photo.id))}
                      accessibilityLabel="Fotoğrafı kaldır"
                      className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-black/55"
                    >
                      <Ionicons name="trash-outline" color="#FFFFFF" size={15} />
                    </Pressable>
                    <View className="flex-row justify-center gap-2 py-2">
                      <Pressable
                        onPress={() => movePhoto(index, -1)}
                        disabled={index === 0}
                        className="h-8 w-10 items-center justify-center rounded-lg bg-bg-secondary disabled:opacity-30"
                      >
                        <Ionicons name="chevron-back" color="#6B5D55" size={18} />
                      </Pressable>
                      <Pressable
                        onPress={() => movePhoto(index, 1)}
                        disabled={index === photos.length - 1}
                        className="h-8 w-10 items-center justify-center rounded-lg bg-bg-secondary disabled:opacity-30"
                      >
                        <Ionicons name="chevron-forward" color="#6B5D55" size={18} />
                      </Pressable>
                    </View>
                  </View>
                ))}
                {photos.length < 6 ? (
                  <Pressable
                    onPress={pickPhotos}
                    disabled={busy}
                    className="h-[178px] w-32 items-center justify-center rounded-2xl border border-dashed border-brand bg-brand/5"
                  >
                    <Ionicons name="add-circle-outline" color="#F97362" size={30} />
                    <Text className="mt-2 text-xs font-bold text-brand-dark">Fotoğraf ekle</Text>
                  </Pressable>
                ) : null}
              </View>
            </ScrollView>
          </View>

          <Field label="Adı" value={name} onChangeText={setName} maxLength={40} autoCapitalize="words" />
          <Field label="Irkı (opsiyonel)" value={breed} onChangeText={setBreed} maxLength={80} autoCapitalize="words" />
          {/*
            Kayıt akışıyla AYNI kontrol. Onboarding yaşı kovalarla sorup
            yaklaşık bir birth_date türetiyor; burası ham YYYY-AA-GG metin
            alanı kalsaydı "3 yaş" seçen kullanıcı profilini açtığında
            "2023-08-04" görürdü — kendi girdiğini tanıyamazdı.
          */}
          <PetAgePicker value={petAge} onChange={setPetAge} />

          <Text className="mb-3 text-lg font-bold text-text-primary">Boyut</Text>
          <View className="mb-6 flex-row gap-2">
            {sizeOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setSize(option.value)}
                className={`flex-1 items-center rounded-xl border py-3 ${
                  size === option.value ? "border-brand bg-brand/10" : "border-border bg-surface"
                }`}
              >
                <Text className={`font-semibold ${size === option.value ? "text-brand-dark" : "text-text-primary"}`}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <View className="mb-6">
            <Text className="text-lg font-bold text-text-primary">Enerji seviyesi</Text>
            <Text className="mb-3 mt-1 text-xs text-text-secondary">1 çok sakin, 5 çok enerjik.</Text>
            <View className="flex-row gap-2">
              {([1, 2, 3, 4, 5] as EnergyLevel[]).map((value) => (
                <Pressable
                  key={value}
                  onPress={() => setEnergyLevel(value)}
                  className={`h-11 flex-1 items-center justify-center rounded-xl border ${
                    energyLevel === value ? "border-brand bg-brand" : "border-border bg-surface"
                  }`}
                >
                  <Text className={`font-bold ${energyLevel === value ? "text-white" : "text-text-primary"}`}>{value}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="mb-6 rounded-2xl border border-border bg-surface px-4">
            <Toggle label="Kısırlaştırıldı" value={isNeutered} onValueChange={setIsNeutered} />
          </View>

          <Text className="mb-3 text-lg font-bold text-text-primary">Mizaç</Text>
          <View className="mb-6 flex-row flex-wrap gap-2">
            {TEMPERAMENTS.map((value) => {
              const active = temperaments.includes(value);
              return (
                <Pressable
                  key={value}
                  onPress={() => toggleTemperament(value)}
                  className={`rounded-full border px-4 py-2.5 ${
                    active ? "border-accent bg-accent/10" : "border-border bg-surface"
                  }`}
                >
                  <Text className={`text-sm font-semibold ${active ? "text-accent-dark" : "text-text-secondary"}`}>
                    {temperamentLabels[value]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mb-3 text-lg font-bold text-text-primary">Uyumluluk</Text>
          <View className="mb-6 rounded-2xl border border-border bg-surface px-4">
            <Toggle label="Kedilerle iyi anlaşır" value={goodWithCats} onValueChange={setGoodWithCats} />
            <View className="h-px bg-border" />
            <Toggle label="Köpeklerle iyi anlaşır" value={goodWithDogs} onValueChange={setGoodWithDogs} />
            <View className="h-px bg-border" />
            <Toggle label="Çocuklarla iyi anlaşır" value={goodWithKids} onValueChange={setGoodWithKids} />
          </View>

          <Field
            label="Hakkında (opsiyonel)"
            value={bio}
            onChangeText={setBio}
            placeholder="Karakterini, sevdiği oyunları ve alışkanlıklarını anlat."
            multiline
            maxLength={500}
            textAlignVertical="top"
            className="min-h-28 rounded-xl border border-border bg-surface px-4 py-3.5 text-text-primary"
          />
          <Text className="-mt-4 mb-5 text-right text-xs text-text-tertiary">{bio.length}/500</Text>

          {error ? (
            <View className="mb-4 rounded-xl border border-danger/30 bg-danger/10 p-3">
              <Text className="text-sm text-danger">{error}</Text>
            </View>
          ) : null}
          {notice ? (
            <View className="mb-4 rounded-xl border border-accent/30 bg-accent/10 p-3">
              <Text className="text-sm text-accent-dark">{notice}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={save}
            disabled={busy || !name.trim() || !photos.length}
            className="items-center rounded-xl bg-brand py-4 disabled:opacity-50"
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-bold text-white">Pet profilini kaydet</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
