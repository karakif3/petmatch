import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
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
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PetAgePicker } from "../../components/pet-age-picker";
import { PetPhotoEditor } from "../../components/pet-photo-editor";
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
import { sizeLabels, temperamentLabels } from "../../core/domain/labels";
import {
  PET_AGE_UNKNOWN,
  birthDateToPetAge,
  petAgeToBirthDate,
} from "../../core/domain/pet-age";
import { ensureImageLibraryAccess } from "../../core/media/image-library";
import { useAuthStore } from "../../stores/auth";
import { errorMessage } from "../../core/domain/error-message";
import { AppPressable } from "../../components/ui/pressable";
import { ProfileFormSkeleton } from "../../components/ui/skeleton";
import { successHaptic } from "../../core/ui/haptics";

type PhotoItem =
  | { id: string; kind: "remote"; storagePath: string; uri: string }
  | ({ id: string; kind: "local" } & LocalProfilePhoto);

const sizeOptions: { value: Size; label: string }[] = [
  { value: "small", label: sizeLabels.small },
  { value: "medium", label: sizeLabels.medium },
  { value: "large", label: sizeLabels.large },
];

const energyLabels: Record<EnergyLevel, string> = {
  1: "Çok sakin",
  2: "Sakin",
  3: "Dengeli",
  4: "Enerjik",
  5: "Çok enerjik",
};

type CompatibilityAnswer = boolean | null;

function Field({
  label,
  error,
  ...props
}: { label: string; error?: string | null } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-sm font-semibold text-text-primary">{label}</Text>
      <TextInput
        placeholderTextColor="#9A8B82"
        accessibilityLabel={label}
        className={`rounded-xl border bg-surface px-4 py-3.5 text-text-primary ${
          error ? "border-danger" : "border-border"
        }`}
        {...props}
      />
      {error ? <Text className="mt-1.5 text-xs font-semibold text-danger">{error}</Text> : null}
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

function CompatibilityControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: CompatibilityAnswer;
  onChange: (value: CompatibilityAnswer) => void;
}) {
  const options: { value: CompatibilityAnswer; label: string }[] = [
    { value: true, label: "Evet" },
    { value: false, label: "Hayır" },
    { value: null, label: "Bilmiyorum" },
  ];

  return (
    <View className="px-4 py-3.5">
      <Text className="mb-2.5 font-semibold text-text-primary">{label}</Text>
      <View className="flex-row rounded-xl bg-bg-secondary p-1">
        {options.map((option) => {
          const active = value === option.value;
          return (
            <AppPressable
              key={String(option.value)}
              onPress={() => onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, checked: active }}
              className={`min-h-10 flex-1 items-center justify-center rounded-lg px-2 ${
                active ? "bg-surface" : "bg-transparent"
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  active ? "text-brand-dark" : "text-text-secondary"
                }`}
              >
                {option.label}
              </Text>
            </AppPressable>
          );
        })}
      </View>
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
  const [goodWithCats, setGoodWithCats] = useState<CompatibilityAnswer>(null);
  const [goodWithDogs, setGoodWithDogs] = useState<CompatibilityAnswer>(null);
  const [goodWithKids, setGoodWithKids] = useState<CompatibilityAnswer>(null);
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [photosError, setPhotosError] = useState<string | null>(null);
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

  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const photosMatch =
    profile.data !== undefined &&
    photos.length === profile.data.pet.photos.length &&
    photos.every(
      (photo, index) =>
        photo.kind === "remote" &&
        photo.storagePath === profile.data!.pet.photos[index]?.storagePath,
    );

  const dirty =
    Boolean(profile.data) &&
    (name !== profile.data!.pet.name ||
      breed !== (profile.data!.pet.breed ?? "") ||
      petAge !== birthDateToPetAge(profile.data!.pet.birthDate) ||
      size !== profile.data!.pet.size ||
      energyLevel !== profile.data!.pet.energyLevel ||
      isNeutered !== profile.data!.pet.isNeutered ||
      temperaments.length !== profile.data!.pet.temperaments.length ||
      temperaments.some((item) => !profile.data!.pet.temperaments.includes(item)) ||
      goodWithCats !== profile.data!.pet.goodWithCats ||
      goodWithDogs !== profile.data!.pet.goodWithDogs ||
      goodWithKids !== profile.data!.pet.goodWithKids ||
      bio !== (profile.data!.pet.bio ?? "") ||
      !photosMatch);

  const resetForm = () => {
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
        kind: "remote" as const,
        storagePath: photo.storagePath,
        uri: photo.url,
      })),
    );
    setNameError(null);
    setPhotosError(null);
    setError(null);
    setNotice(null);
  };

  const goBack = () => {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert(
      "Kaydedilmemiş değişiklikler var",
      "Çıkarsan bu turdaki pet profili değişiklikleri kaybolur.",
      [
        { text: "Düzenlemeye dön", style: "cancel" },
        { text: "Çık ve vazgeç", style: "destructive", onPress: () => router.back() },
      ],
    );
  };

  const pickFromLibrary = async (available: number) => {
    if (!(await ensureImageLibraryAccess())) {
      setPhotosError("Fotoğraf seçmek için galeri izni gerekiyor.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: available,
      quality: 0.85,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
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

  // Doğrulama akışındaki (`app/profile/owner.tsx`) kamera deseniyle aynı:
  // izin doğrudan burada istenir, önceden istenmez.
  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setPhotosError("Fotoğraf çekmek için kamera izni gerekiyor.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
    });
    if (result.canceled) return;
    const photo = result.assets[0];
    setPhotos((items) => [
      ...items,
      {
        id: `${photo.uri}-${Date.now()}`,
        kind: "local",
        uri: photo.uri,
        fileName: photo.fileName ?? null,
        mimeType: photo.mimeType ?? null,
      },
    ]);
  };

  const pickPhotos = () => {
    setPhotosError(null);
    const available = 6 - photos.length;
    if (available < 1) {
      setPhotosError("En fazla 6 fotoğraf ekleyebilirsin.");
      return;
    }
    Alert.alert("Fotoğraf ekle", undefined, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Galeriden seç", onPress: () => void pickFromLibrary(available) },
      { text: "Fotoğraf çek", onPress: () => void pickFromCamera() },
    ]);
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
    setNameError(null);
    setPhotosError(null);
    if (!name.trim()) return setNameError("Petinin adını yazmalısın.");
    if (!photos.length) return setPhotosError("En az bir pet fotoğrafı kalmalı.");

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
        // Keşfet'teki "Profilini tamamla" şeridi bu sorgudan besleniyor
        // (bkz. aynı düzeltme `app/profile/owner.tsx`'te).
        queryClient.invalidateQueries({ queryKey: ["profile-completion", user.id] }),
      ]);
      await profile.refetch();
      successHaptic();
      setNotice("Pet profili ve fotoğraf sırası güncellendi.");
    } catch (saveError) {
      setError(errorMessage(saveError, "Pet profili kaydedilemedi."));
    } finally {
      setBusy(false);
    }
  };

  if (profile.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-primary">
        <ProfileFormSkeleton variant="pet" />
      </SafeAreaView>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-primary px-8">
        <Text className="text-center text-lg font-bold text-text-primary">
          Pet profili yüklenemedi
        </Text>
        <AppPressable onPress={() => profile.refetch()} className="mt-5 rounded-xl bg-brand px-5 py-3">
          <Text className="font-semibold text-white">Tekrar dene</Text>
        </AppPressable>
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
          <AppPressable
            onPress={goBack}
            accessibilityLabel="Geri"
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Ionicons name="chevron-back" color="#1F1A17" size={27} />
          </AppPressable>
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
          contentContainerClassName={dirty ? "px-5 pb-28 pt-5" : "px-5 pb-12 pt-5"}
        >
          <View className="mb-7">
            <View className="mb-3 flex-row items-end justify-between">
              <Text className="text-lg font-bold text-text-primary">Fotoğraflar</Text>
              <Text className="text-xs font-semibold text-text-tertiary">
                {photos.length}/6
              </Text>
            </View>
            <PetPhotoEditor
              photos={photos}
              max={6}
              busy={busy}
              onChange={(next) =>
                setPhotos(next as typeof photos)
              }
              onAdd={pickPhotos}
            />
            {photosError ? (
              <Text className="mt-2 text-xs font-semibold text-danger">{photosError}</Text>
            ) : null}
          </View>

          <Field
            label="Adı"
            value={name}
            onChangeText={setName}
            maxLength={40}
            autoCapitalize="words"
            error={nameError}
          />
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
              <AppPressable
                key={option.value}
                onPress={() => setSize(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected: size === option.value, checked: size === option.value }}
                className={`flex-1 items-center rounded-xl border py-3 ${
                  size === option.value ? "border-brand bg-brand/10" : "border-border bg-surface"
                }`}
              >
                <Text className={`font-semibold ${size === option.value ? "text-brand-dark" : "text-text-primary"}`}>
                  {option.label}
                </Text>
              </AppPressable>
            ))}
          </View>

          <View className="mb-6">
            <Text className="text-lg font-bold text-text-primary">Enerji seviyesi</Text>
            <Text className="mb-3 mt-1 text-xs font-semibold text-brand-dark">
              {energyLabels[energyLevel]}
            </Text>
            <View className="flex-row gap-2">
              {([1, 2, 3, 4, 5] as EnergyLevel[]).map((value) => (
                <AppPressable
                  key={value}
                  onPress={() => setEnergyLevel(value)}
                  accessibilityRole="radio"
                  accessibilityLabel={`Enerji seviyesi ${value}: ${energyLabels[value]}`}
                  accessibilityState={{ selected: energyLevel === value, checked: energyLevel === value }}
                  className={`h-11 flex-1 items-center justify-center rounded-xl border ${
                    energyLevel === value ? "border-brand bg-brand" : "border-border bg-surface"
                  }`}
                >
                  <Text className={`font-bold ${energyLevel === value ? "text-white" : "text-text-primary"}`}>{value}</Text>
                </AppPressable>
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
                <AppPressable
                  key={value}
                  onPress={() => toggleTemperament(value)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: active }}
                  className={`rounded-full border px-4 py-2.5 ${
                    active ? "border-accent bg-accent/10" : "border-border bg-surface"
                  }`}
                >
                  <Text className={`text-sm font-semibold ${active ? "text-accent-dark" : "text-text-secondary"}`}>
                    {temperamentLabels[value]}
                  </Text>
                </AppPressable>
              );
            })}
          </View>

          <Text className="mb-3 text-lg font-bold text-text-primary">Uyumluluk</Text>
          <View className="mb-6 overflow-hidden rounded-2xl border border-border bg-surface">
            <CompatibilityControl
              label="Kedilerle iyi anlaşır mı?"
              value={goodWithCats}
              onChange={setGoodWithCats}
            />
            <View className="h-px bg-border" />
            <CompatibilityControl
              label="Köpeklerle iyi anlaşır mı?"
              value={goodWithDogs}
              onChange={setGoodWithDogs}
            />
            <View className="h-px bg-border" />
            <CompatibilityControl
              label="Çocuklarla iyi anlaşır mı?"
              value={goodWithKids}
              onChange={setGoodWithKids}
            />
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

        </ScrollView>

        {error || notice ? (
          <View className="px-5 pb-2">
            <View
              className={`rounded-xl border p-3 ${
                error ? "border-danger/30 bg-danger/10" : "border-accent/30 bg-accent/10"
              }`}
            >
              <Text className={`text-sm ${error ? "text-danger" : "text-accent-dark"}`}>
                {error ?? notice}
              </Text>
            </View>
          </View>
        ) : null}

        {dirty ? (
          <View className="flex-row gap-3 border-t border-border bg-surface px-5 pb-2 pt-3">
            <AppPressable
              onPress={resetForm}
              disabled={busy}
              accessibilityRole="button"
              className="min-h-[50px] flex-1 items-center justify-center rounded-xl border border-border disabled:opacity-50"
            >
              <Text className="font-semibold text-text-secondary">Vazgeç</Text>
            </AppPressable>
            <AppPressable
              onPress={save}
              disabled={busy || !name.trim() || !photos.length}
              accessibilityRole="button"
              className="min-h-[50px] flex-[2] items-center justify-center rounded-xl bg-brand disabled:opacity-50"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-bold text-white">Değişiklikleri kaydet</Text>
              )}
            </AppPressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
