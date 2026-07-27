import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";

import { BrandMark } from "../components/brand-mark";
import { completeOnboarding, type OnboardingPhoto } from "../core/api/onboarding";
import { isAdultDate, isPastOrTodayDate } from "../core/domain/date-validation";
import { coarsenCoordinates } from "../core/domain/distance";
import type { Coordinates, OwnerVisibility, Size, Species } from "../core/domain/types";
import { useAuthStore } from "../stores/auth";

type Step = 0 | 1 | 2;

const ownerVisibilityOptions: { value: OwnerVisibility; label: string; detail: string }[] = [
  { value: "hidden", label: "Gizli", detail: "Sadece petin görünür" },
  { value: "after_match", label: "Eşleşince", detail: "Varsayılan ve önerilen" },
  { value: "public", label: "Herkese açık", detail: "Kartta sahibin de görünür" },
];

const sizeOptions: { value: Size; label: string }[] = [
  { value: "small", label: "Küçük" },
  { value: "medium", label: "Orta" },
  { value: "large", label: "Büyük" },
];

function Choice({
  active,
  label,
  detail,
  onPress,
}: {
  active: boolean;
  label: string;
  detail?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`rounded-xl border px-4 py-3 ${
        active ? "border-brand bg-brand/10" : "border-border bg-surface"
      }`}
    >
      <Text className={`font-semibold ${active ? "text-brand-dark" : "text-text-primary"}`}>
        {label}
      </Text>
      {detail ? <Text className="mt-1 text-xs text-text-secondary">{detail}</Text> : null}
    </Pressable>
  );
}

function Field({
  label,
  ...props
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-text-primary">{label}</Text>
      <TextInput
        placeholderTextColor="#9A8B82"
        className="rounded-xl border border-border bg-surface px-4 py-3.5 text-text-primary"
        {...props}
      />
    </View>
  );
}

export default function OnboardingScreen() {
  const user = useAuthStore((state) => state.user);
  const setOnboarded = useAuthStore((state) => state.setOnboarded);

  const [step, setStep] = useState<Step>(0);
  const [displayName, setDisplayName] = useState("");
  const [ownerBirthDate, setOwnerBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [ownerVisibility, setOwnerVisibility] =
    useState<OwnerVisibility>("after_match");

  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [breed, setBreed] = useState("");
  const [petBirthDate, setPetBirthDate] = useState("");
  const [size, setSize] = useState<Size>("medium");
  const [energyLevel, setEnergyLevel] = useState(3);
  const [isNeutered, setIsNeutered] = useState(false);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [photos, setPhotos] = useState<OnboardingPhoto[]>([]);

  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const progress = useMemo(() => `${step + 1} / 3`, [step]);

  const next = () => {
    setError(null);
    if (step === 0) {
      if (!isAdultDate(ownerBirthDate)) {
        return setError("Geçerli bir doğum tarihi yazmalısın ve 18 yaşında olmalısın.");
      }
      if (!city.trim()) return setError("Şehrini yazmalısın.");
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!petName.trim()) return setError("Petinin adını yazmalısın.");
      if (petBirthDate && !isPastOrTodayDate(petBirthDate)) {
        return setError("Petinin geçmişteki doğum tarihini YYYY-AA-GG biçiminde yaz.");
      }
      setStep(2);
    }
  };

  const pickPhotos = async () => {
    setError(null);
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
    if (!result.canceled) {
      setPhotos(
        result.assets.slice(0, 6).map((asset) => ({
          uri: asset.uri,
          fileName: asset.fileName ?? null,
          mimeType: asset.mimeType ?? null,
        })),
      );
    }
  };

  const useCurrentLocation = async () => {
    setLocationBusy(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Konum izni verilmedi.");
      const result = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setCoordinates(
        coarsenCoordinates({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Konum alınamadı.");
    } finally {
      setLocationBusy(false);
    }
  };

  const submit = async () => {
    if (!user) return;
    if (photos.length === 0) {
      setError("En az bir pet fotoğrafı eklemelisin.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await completeOnboarding({
        userId: user.id,
        displayName,
        ownerBirthDate,
        city,
        ownerVisibility,
        pet: {
          name: petName,
          species,
          gender,
          breed: breed.trim() || null,
          birthDate: petBirthDate || null,
          size,
          energyLevel,
          isNeutered,
          coordinates,
        },
        photos,
      });
      setOnboarded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onboarding tamamlanamadı.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg-primary"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="px-6 pb-12 pt-16"
      >
        <View className="mb-7 flex-row items-center justify-between">
          <View className="mr-4 flex-1 flex-row items-center">
            <BrandMark size={52} />
            <View className="ml-3 flex-1">
              <Text className="text-xs font-semibold uppercase tracking-widest text-brand">
                PetMatch
              </Text>
              <Text className="mt-1 text-2xl font-bold text-text-primary">
                {step === 0
                  ? "Seni tanıyalım"
                  : step === 1
                    ? "Petini tanıyalım"
                    : "Son dokunuşlar"}
              </Text>
            </View>
          </View>
          <Text className="text-sm font-semibold text-text-tertiary">{progress}</Text>
        </View>

        <View className="mb-8 h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
          <View
            className="h-full rounded-full bg-brand"
            style={{ width: `${((step + 1) / 3) * 100}%` }}
          />
        </View>

        {step === 0 ? (
          <>
            <Field
              label="Adın (opsiyonel)"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Sana nasıl hitap edelim?"
              autoCapitalize="words"
              maxLength={60}
            />
            <Text className="-mt-2 mb-4 text-xs text-text-tertiary">
              Petinin adı profilde her zaman görünür; kendi adını paylaşmak zorunda değilsin.
            </Text>
            <Field
              label="Doğum tarihin"
              value={ownerBirthDate}
              onChangeText={setOwnerBirthDate}
              placeholder="YYYY-AA-GG"
              keyboardType="numbers-and-punctuation"
              maxLength={10}
            />
            <Text className="-mt-2 mb-4 text-xs text-text-tertiary">
              PetMatch yalnızca 18 yaş ve üzeri kullanıcılar içindir.
            </Text>
            <Field
              label="Şehir"
              value={city}
              onChangeText={setCity}
              placeholder="Örn. İstanbul"
              autoCapitalize="words"
            />
            <Text className="mb-3 text-sm font-semibold text-text-primary">
              Sahip profilin ne zaman görünsün?
            </Text>
            <View className="gap-2">
              {ownerVisibilityOptions.map((option) => (
                <Choice
                  key={option.value}
                  active={ownerVisibility === option.value}
                  label={option.label}
                  detail={option.detail}
                  onPress={() => setOwnerVisibility(option.value)}
                />
              ))}
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field
              label="Petinin adı"
              value={petName}
              onChangeText={setPetName}
              placeholder="Örn. Luna"
              autoCapitalize="words"
              maxLength={40}
            />
            <Text className="mb-2 text-sm font-semibold text-text-primary">Türü</Text>
            <View className="mb-4 flex-row gap-2">
              <View className="flex-1">
                <Choice
                  active={species === "dog"}
                  label="🐕 Köpek"
                  onPress={() => setSpecies("dog")}
                />
              </View>
              <View className="flex-1">
                <Choice
                  active={species === "cat"}
                  label="🐈 Kedi"
                  onPress={() => setSpecies("cat")}
                />
              </View>
            </View>
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Field
                  label="Irk (opsiyonel)"
                  value={breed}
                  onChangeText={setBreed}
                  placeholder="Örn. Tekir"
                />
              </View>
              <View className="flex-1">
                <Field
                  label="Doğum tarihi"
                  value={petBirthDate}
                  onChangeText={setPetBirthDate}
                  placeholder="YYYY-AA-GG"
                  maxLength={10}
                />
              </View>
            </View>
            <Text className="mb-2 text-sm font-semibold text-text-primary">Cinsiyeti</Text>
            <View className="mb-4 flex-row gap-2">
              <View className="flex-1">
                <Choice
                  active={gender === "female"}
                  label="Dişi"
                  onPress={() => setGender("female")}
                />
              </View>
              <View className="flex-1">
                <Choice
                  active={gender === "male"}
                  label="Erkek"
                  onPress={() => setGender("male")}
                />
              </View>
            </View>
            <Text className="mb-2 text-sm font-semibold text-text-primary">Boyutu</Text>
            <View className="mb-4 flex-row gap-2">
              {sizeOptions.map((option) => (
                <View className="flex-1" key={option.value}>
                  <Choice
                    active={size === option.value}
                    label={option.label}
                    onPress={() => setSize(option.value)}
                  />
                </View>
              ))}
            </View>
            <Text className="mb-2 text-sm font-semibold text-text-primary">
              Enerji seviyesi: {energyLevel}/5
            </Text>
            <View className="mb-4 flex-row gap-2">
              {[1, 2, 3, 4, 5].map((level) => (
                <Pressable
                  key={level}
                  onPress={() => setEnergyLevel(level)}
                  className={`h-11 flex-1 items-center justify-center rounded-xl border ${
                    level === energyLevel
                      ? "border-brand bg-brand"
                      : "border-border bg-surface"
                  }`}
                >
                  <Text className={level === energyLevel ? "text-white" : "text-text-primary"}>
                    {level}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Choice
              active={isNeutered}
              label={isNeutered ? "Kısırlaştırıldı" : "Kısırlaştırılmadı"}
              onPress={() => setIsNeutered((value) => !value)}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text className="mb-2 text-sm font-semibold text-text-primary">
              Pet fotoğrafları
            </Text>
            <Text className="mb-4 text-sm leading-5 text-text-secondary">
              En az 1, en fazla 6 fotoğraf ekle. İlk fotoğraf profil kapağı olur.
            </Text>
            {photos.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
                <View className="flex-row gap-3">
                  {photos.map((photo, index) => (
                    <View key={`${photo.uri}-${index}`} className="relative">
                      <Image source={{ uri: photo.uri }} className="h-28 w-28 rounded-2xl" />
                      <Pressable
                        onPress={() =>
                          setPhotos((current) => current.filter((_, itemIndex) => itemIndex !== index))
                        }
                        className="absolute right-1 top-1 h-7 w-7 items-center justify-center rounded-full bg-black/60"
                      >
                        <Text className="text-white">×</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : null}
            <Pressable
              onPress={pickPhotos}
              className="mb-5 items-center rounded-xl border border-dashed border-brand bg-brand/5 px-4 py-5"
            >
              <Text className="font-semibold text-brand-dark">
                {photos.length ? "Fotoğrafları değiştir" : "Fotoğraf seç"}
              </Text>
            </Pressable>

            <Text className="mb-2 text-sm font-semibold text-text-primary">Yaklaşık konum</Text>
            <Text className="mb-4 text-sm leading-5 text-text-secondary">
              Tam konumun saklanmaz; uygulama göndermeden önce yaklaşık 1 km’lik alana yuvarlar.
            </Text>
            <Pressable
              onPress={useCurrentLocation}
              disabled={locationBusy}
              className={`items-center rounded-xl border px-4 py-4 ${
                coordinates ? "border-accent bg-accent/10" : "border-border bg-surface"
              }`}
            >
              {locationBusy ? (
                <ActivityIndicator color="#2FB8A6" />
              ) : (
                <Text className={coordinates ? "font-semibold text-accent-dark" : "font-semibold text-text-primary"}>
                  {coordinates ? "Konum hazır ✓" : "Konumumu kullan"}
                </Text>
              )}
            </Pressable>
          </>
        ) : null}

        {error ? (
          <View className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-3">
            <Text className="text-sm text-danger">{error}</Text>
          </View>
        ) : null}

        <View className="mt-8 flex-row gap-3">
          {step > 0 ? (
            <Pressable
              onPress={() => setStep((step - 1) as Step)}
              disabled={busy}
              className="flex-1 items-center rounded-xl border border-border bg-surface py-4"
            >
              <Text className="font-semibold text-text-primary">Geri</Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={step === 2 ? submit : next}
            disabled={busy}
            className="flex-[2] items-center rounded-xl bg-brand py-4 disabled:opacity-50"
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-bold text-white">{step === 2 ? "Profili tamamla" : "Devam"}</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
