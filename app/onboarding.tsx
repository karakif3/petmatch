import { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { AppIcon } from "../components/ui/icon";

import { BirthDateField } from "../components/birth-date-field";
import { BrandMark } from "../components/brand-mark";
import { PetAgePicker } from "../components/pet-age-picker";
import { PetPhotoEditor } from "../components/pet-photo-editor";
import { Checkbox } from "../components/ui/checkbox";
import { AppPressable } from "../components/ui/pressable";
import { completeOnboarding, type OnboardingPhoto } from "../core/api/onboarding";
import { listRegions, setMyRegion } from "../core/api/regions";
import { isAdultDate } from "../core/domain/date-validation";
import { PET_AGE_UNKNOWN, petAgeToBirthDate } from "../core/domain/pet-age";
import { coarsenCoordinates } from "../core/domain/distance";
import type { Coordinates, Species } from "../core/domain/types";
import { useTranslation } from "../core/i18n";
import { ensureImageLibraryAccess } from "../core/media/image-library";
import { useAuthStore } from "../stores/auth";
import { errorMessage } from "../core/domain/error-message";

type Step = 0 | 1 | 2;
type FieldError =
  | "ownerBirthDate"
  | "region"
  | "city"
  | "petName"
  | "photos"
  | "legal"
  | "locationConsent";

// `PetPhotoEditor` (kapak seçimi + kaldırma + ekleme) `{id,uri}` şeklinde
// çalışıyor; onboarding'in gönderdiği `OnboardingPhoto` bunun üstüne
// `fileName`/`mimeType` ekliyor. `id` burada URI'nin kendisi — yerel bir
// seçim oturumu için yeterince benzersiz, ekstra bir kimlik üretmeye gerek
// yok.
type LocalPhoto = OnboardingPhoto & { id: string };

type OnboardingDraft = {
  version: 1;
  step: Step;
  displayName: string;
  ownerBirthDate: string;
  city: string;
  regionSlug: string | null;
  notifyWhenRegionOpens: boolean;
  petName: string;
  species: Species;
  gender: "male" | "female";
  petAge: string;
  coordinates: Coordinates | null;
  photos: LocalPhoto[];
};

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
    <AppPressable
      onPress={onPress}
      className={`rounded-xl border px-4 py-3 ${
        active ? "border-brand bg-brand/10" : "border-border bg-surface"
      }`}
    >
      <Text className={`font-semibold ${active ? "text-brand-dark" : "text-text-primary"}`}>
        {label}
      </Text>
      {detail ? <Text className="mt-1 text-xs text-text-secondary">{detail}</Text> : null}
    </AppPressable>
  );
}

function Field({
  label,
  error,
  ...props
}: { label: string; error?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-text-primary">{label}</Text>
      <TextInput
        placeholderTextColor="#9A8B82"
        className={`rounded-xl border bg-surface px-4 py-3.5 text-text-primary ${
          error ? "border-danger" : "border-border"
        }`}
        accessibilityHint={error}
        {...props}
      />
      {error ? <Text className="mt-2 text-xs font-semibold text-danger">{error}</Text> : null}
    </View>
  );
}

export default function OnboardingScreen() {
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const setOnboarded = useAuthStore((state) => state.setOnboarded);
  const setRegionAccess = useAuthStore((state) => state.setRegionAccess);
  const setLegalRequired = useAuthStore((state) => state.setLegalRequired);
  const signOut = useAuthStore((state) => state.signOut);

  const [step, setStep] = useState<Step>(0);
  const [displayName, setDisplayName] = useState("");
  const [ownerBirthDate, setOwnerBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [regionSlug, setRegionSlug] = useState<string | null>(null);
  const [notifyWhenRegionOpens, setNotifyWhenRegionOpens] = useState(true);

  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [petAge, setPetAge] = useState<string>(PET_AGE_UNKNOWN);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);

  const [busy, setBusy] = useState(false);
  const [photoDragging, setPhotoDragging] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldError, string>>>({});
  const draftHydrated = useRef(false);

  // Bölge listesi veriden geliyor: yeni pilot bölge açmak istemci sürümü
  // gerektirmesin diye enum değil tablo.
  const regions = useQuery({ queryKey: ["regions"], queryFn: listRegions });

  const draftKey = user ? `petmatch:onboarding-draft:${user.id}` : null;
  useEffect(() => {
    if (!draftKey) return;
    let active = true;
    void AsyncStorage.getItem(draftKey)
      .then((value) => {
        if (!active || !value) return;
        const draft = JSON.parse(value) as Partial<OnboardingDraft>;
        if (draft.version !== 1) return;
        if (draft.step === 0 || draft.step === 1 || draft.step === 2) setStep(draft.step);
        if (typeof draft.displayName === "string") setDisplayName(draft.displayName);
        if (typeof draft.ownerBirthDate === "string") setOwnerBirthDate(draft.ownerBirthDate);
        if (typeof draft.city === "string") setCity(draft.city);
        if (typeof draft.regionSlug === "string" || draft.regionSlug === null) {
          setRegionSlug(draft.regionSlug);
        }
        if (typeof draft.notifyWhenRegionOpens === "boolean") {
          setNotifyWhenRegionOpens(draft.notifyWhenRegionOpens);
        }
        if (typeof draft.petName === "string") setPetName(draft.petName);
        if (draft.species === "dog" || draft.species === "cat") setSpecies(draft.species);
        if (draft.gender === "male" || draft.gender === "female") setGender(draft.gender);
        if (typeof draft.petAge === "string") setPetAge(draft.petAge);
        if (draft.coordinates) setCoordinates(draft.coordinates);
        if (Array.isArray(draft.photos)) setPhotos(draft.photos);
      })
      .catch((draftError) => console.warn("Onboarding taslağı okunamadı:", draftError))
      .finally(() => {
        if (active) draftHydrated.current = true;
      });
    return () => {
      active = false;
    };
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || !draftHydrated.current) return;
    const timeout = setTimeout(() => {
      const draft: OnboardingDraft = {
        version: 1,
        step,
        displayName,
        ownerBirthDate,
        city,
        regionSlug,
        notifyWhenRegionOpens,
        petName,
        species,
        gender,
        petAge,
        coordinates,
        photos,
      };
      void AsyncStorage.setItem(draftKey, JSON.stringify(draft)).catch((draftError) =>
        console.warn("Onboarding taslağı kaydedilemedi:", draftError),
      );
    }, 250);
    return () => clearTimeout(timeout);
  }, [city, coordinates, displayName, draftKey, gender, notifyWhenRegionOpens, ownerBirthDate, petAge, petName, photos, regionSlug, species, step]);

  const progress = useMemo(() => `${step + 1} / 3`, [step]);

  // Adım geçişi öncesinde anlıktı — çubuk bir kareden diğerine sıçrıyordu.
  // `swipeable-card.tsx`'teki aynı kalıp: hareket azaltma açıkken animasyon
  // yok, çubuk doğrudan son konumuna atlıyor.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => active && setReduceMotion(value))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const progressWidth = useSharedValue(((step + 1) / 3) * 100);
  useEffect(() => {
    const target = ((step + 1) / 3) * 100;
    progressWidth.value = reduceMotion ? target : withTiming(target, { duration: 260 });
  }, [step, reduceMotion, progressWidth]);
  const progressBarStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value}%`,
  }));

  const selectedRegion = useMemo(
    () => (regions.data ?? []).find((region) => region.slug === regionSlug) ?? null,
    [regions.data, regionSlug],
  );

  // Pilot bölgelerin şehri `regions.city`'den geliyor; yalnızca "Diğer"
  // seçilirse kullanıcıya sorulur.
  const needsManualCity = selectedRegion !== null && selectedRegion.city === null;
  const resolvedCity = needsManualCity ? city.trim() || null : selectedRegion?.city ?? null;
  const pilotRegions = useMemo(
    () => (regions.data ?? []).filter((region) => region.isPilot),
    [regions.data],
  );
  const outsideRegion = useMemo(
    () => (regions.data ?? []).find((region) => region.slug === "other") ?? null,
    [regions.data],
  );

  const clearFieldError = (field: FieldError) => {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const next = () => {
    setError(null);
    setFieldErrors({});
    if (step === 0) {
      // Takvim 18 yaş altını zaten seçtirmiyor; burada kalan tek durum
      // kullanıcının tarihe hiç dokunmamış olması.
      if (!isAdultDate(ownerBirthDate)) {
        return setFieldErrors({ ownerBirthDate: "Doğum tarihini seçmelisin." });
      }
      if (!regionSlug) return setFieldErrors({ region: "Bölgeni seçmelisin." });
      if (needsManualCity && city.trim().length < 2) {
        return setFieldErrors({ city: "Bulunduğun ilçe veya şehri yazmalısın." });
      }
      if (coordinates && !locationConsent) {
        return setFieldErrors({
          locationConsent:
            "Yaklaşık konum için açık rıza vermeli veya konumu kaldırmalısın.",
        });
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!petName.trim()) {
        return setFieldErrors({ petName: "Petinin adını yazmalısın." });
      }
      setStep(2);
    }
  };

  // Öncesinde her seçim MEVCUT fotoğrafları tamamen değiştiriyordu (ekleme
  // yoktu) ve sıralama/kapak seçimi hiç yoktu — oysa altındaki metin "ilk
  // fotoğraf kapak olur" diyordu. Artık EKLENİYOR (limit kadar boş yuvaya),
  // kapak/sıra/kaldırma `PetPhotoEditor`'a devrediliyor.
  const pickPhotos = async () => {
    setError(null);
    const remaining = 6 - photos.length;
    if (remaining <= 0) return;
    if (!(await ensureImageLibraryAccess())) {
      setError("Fotoğraf seçmek için galeri izni gerekiyor.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      quality: 0.85,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (!result.canceled) {
      setPhotos((current) => {
        const remainingNow = 6 - current.length;
        if (remainingNow <= 0) return current;
        const have = new Set(current.map((photo) => photo.uri));
        const additions: LocalPhoto[] = result.assets
          .slice(0, remainingNow)
          .filter((asset) => !have.has(asset.uri))
          .map((asset, index) => ({
            id: `${asset.uri}-${Date.now()}-${index}`,
            uri: asset.uri,
            fileName: asset.fileName ?? null,
            mimeType: asset.mimeType ?? null,
          }));
        if (!additions.length) return current;
        clearFieldError("photos");
        return [...current, ...additions].slice(0, 6);
      });
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
      clearFieldError("locationConsent");
    } catch (err) {
      setError(errorMessage(err, "Konum alınamadı."));
    } finally {
      setLocationBusy(false);
    }
  };

  const submit = async () => {
    if (!user) return;
    if (photos.length === 0) {
      setFieldErrors({ photos: "En az bir pet fotoğrafı eklemelisin." });
      return;
    }
    if (!legalAccepted) {
      setFieldErrors({
        legal: "Devam etmek için koşulları ve aydınlatma metnini onaylamalısın.",
      });
      return;
    }
    if (coordinates && !locationConsent) {
      setFieldErrors({
        locationConsent: "Yaklaşık konum için açık rıza vermeli veya konumu kaldırmalısın.",
      });
      return;
    }

    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      // Bölge ayrı dar yazma yolundan gidiyor; onboarding RPC'sinin imzasını
      // değiştirmek mevcut çağrıları kırardı.
      if (regionSlug) {
        await setMyRegion(regionSlug, {
          requestedLocation: needsManualCity ? city : undefined,
          notifyWhenOpen: needsManualCity && notifyWhenRegionOpens,
        });
      }

      await completeOnboarding({
        userId: user.id,
        displayName,
        ownerBirthDate,
        city: resolvedCity,
        pet: {
          name: petName,
          species,
          gender,
          birthDate: petAgeToBirthDate(petAge),
          coordinates,
        },
        photos,
        legal: {
          termsAccepted: legalAccepted,
          privacyNoticeAcknowledged: legalAccepted,
          locationConsent: coordinates !== null && locationConsent,
        },
      });
      if (draftKey) await AsyncStorage.removeItem(draftKey);
      setOnboarded(true);
      setRegionAccess(regionSlug === "other" ? "waitlist" : "open");
      setLegalRequired(false);
    } catch (err) {
      setError(errorMessage(err, "Onboarding tamamlanamadı."));
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
        scrollEnabled={!photoDragging}
        contentContainerClassName="px-6 pb-32 pt-12"
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
          <View className="items-center">
            <Text className="text-sm font-semibold text-text-tertiary">{progress}</Text>
            <AppPressable
              onPress={() => void signOut()}
              disabled={busy}
              accessibilityLabel="Başka hesapla giriş yap"
              accessibilityHint="Mevcut oturumu kapatır"
              className="mt-1 h-10 w-10 items-center justify-center rounded-full"
            >
              <AppIcon name="log-out" size={20} color="#6F625B" />
            </AppPressable>
          </View>
        </View>

        <View className="mb-8 h-1.5 overflow-hidden rounded-full bg-bg-tertiary">
          <Animated.View className="h-full rounded-full bg-brand" style={progressBarStyle} />
        </View>

        {step === 0 ? (
          <>
            <View className="mb-5 rounded-2xl border border-accent/30 bg-accent/10 p-4">
              <Text className="text-sm font-semibold leading-6 text-text-primary">
                {t("onboarding.connectionIntro")}
              </Text>
            </View>
            <Field
              label="Adın (opsiyonel)"
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Sana nasıl hitap edelim?"
              autoCapitalize="words"
              autoComplete="name"
              maxLength={60}
            />
            <Text className="-mt-2 mb-4 text-xs text-text-tertiary">
              Petinin adı profilde her zaman görünür; kendi adını paylaşmak zorunda değilsin.
            </Text>
            <BirthDateField
              label="Doğum tarihin"
              helper="PetMatch yalnızca 18 yaş ve üzeri kullanıcılar içindir; takvim zaten 18 yaş altını seçtirmiyor."
              value={ownerBirthDate}
              onChange={(value) => {
                setOwnerBirthDate(value);
                clearFieldError("ownerBirthDate");
              }}
              error={fieldErrors.ownerBirthDate}
            />
            <Text className="mb-2 text-sm font-semibold text-text-primary">
              Bölgen
            </Text>
            <Text className="mb-3 text-xs leading-4 text-text-tertiary">
              Yalnızca seçtiğin bölgedeki petleri görürsün. Şu anda açık
              bölgeler aşağıda; yakınında gerçek eşleşmeler olması için
              topluluğu bu bölgelerde yoğunlaştırıyoruz.
            </Text>
            <View className="mb-5 flex-row flex-wrap gap-2">
              {regions.isLoading ? <ActivityIndicator color="#F97362" /> : null}
              {pilotRegions.map((region) => {
                const active = regionSlug === region.slug;
                return (
                  <AppPressable
                    key={region.slug}
                    onPress={() => {
                      setRegionSlug(region.slug);
                      clearFieldError("region");
                    }}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={region.name}
                    className={`min-h-11 items-center justify-center rounded-xl border px-4 ${
                      active ? "border-brand bg-brand/10" : "border-border bg-surface"
                    }`}
                  >
                    <Text
                      className={`text-sm font-semibold ${
                        active ? "text-brand-dark" : "text-text-secondary"
                      }`}
                    >
                      {region.name}
                    </Text>
                  </AppPressable>
                );
              })}
            </View>
            {outsideRegion ? (
              <View className="mb-5">
                <Choice
                  active={regionSlug === outsideRegion.slug}
                  label={outsideRegion.name}
                  detail="Bulunduğun yeri kaydet; sıradaki bölgeyi taleplere göre açalım."
                  onPress={() => {
                    setRegionSlug(outsideRegion.slug);
                    clearFieldError("region");
                  }}
                />
              </View>
            ) : null}
            {regions.isError ? (
              <View className="mb-5 rounded-xl border border-danger/30 bg-danger/10 p-3">
                <Text className="text-sm text-danger">Bölgeler yüklenemedi.</Text>
                <AppPressable onPress={() => void regions.refetch()} className="mt-2 self-start py-1">
                  <Text className="font-semibold text-brand-dark">Tekrar dene</Text>
                </AppPressable>
              </View>
            ) : fieldErrors.region ? (
              <Text className="-mt-3 mb-5 text-xs font-semibold text-danger">
                {fieldErrors.region}
              </Text>
            ) : null}
            {/*
              Konum yalnızca "Bölgem listede yok" seçilince soruluyor. Pilot
              bölgelerin şehri seçim anında `regions.city` üzerinden geliyor;
              kez sormanın anlamı yoktu.
            */}
            {needsManualCity ? (
              <Field
                label="Bulunduğun ilçe veya şehir"
                error={fieldErrors.city}
                value={city}
                onChangeText={(value) => {
                  setCity(value);
                  clearFieldError("city");
                }}
                placeholder="Örn. Üsküdar veya Ankara"
                autoCapitalize="words"
              />
            ) : null}
            {needsManualCity ? (
              <View className="-mt-1 mb-5 rounded-xl border border-accent/30 bg-accent/10 p-4">
                <View className="mb-3 flex-row items-start">
                  <AppIcon name="info" size={19} color="#1E9384" />
                  <Text className="ml-2 flex-1 text-xs leading-5 text-text-secondary">
                    Bu bölgede keşfet henüz açılmadı. Kaydını tamamlayabilirsin;
                    talebin sıradaki bölgeleri belirlememize yardımcı olur.
                  </Text>
                </View>
                <Checkbox
                  checked={notifyWhenRegionOpens}
                  onChange={setNotifyWhenRegionOpens}
                >
                  <Text className="font-semibold text-text-primary">
                    Bölgem açıldığında haber ver
                  </Text>
                </Checkbox>
                <Text className="ml-8 mt-2 text-xs leading-5 text-text-tertiary">
                  Açılış iletişimi tercihin talebinle birlikte güvenli biçimde saklanır.
                </Text>
              </View>
            ) : null}

            {/*
              Konum bölgeyle AYNI blokta duruyor.
              Ayrı adımlardayken kullanıcıya "nerede yaşıyorsun" iki kez
              sorulmuş gibi geliyordu. Aynı şey değiller — bölge zorunlu ve
              Keşfet havuzunun kendisi, konum ise opsiyonel ve yalnızca
              aynı bölge içinde mesafe filtresi/sıralama için — ama bu ayrım
              ancak yan yana dururken anlaşılıyor. Konum bölgeden
              TÜRETİLEMİYOR: izni vermeyen kullanıcı yine kendi bölgesinde
              keşfeder, mesafe etiketi görmez.
            */}
            <Text className="mb-1 text-sm font-semibold text-text-primary">
              Yaklaşık konum (opsiyonel)
            </Text>
            <Text className="mb-3 text-xs leading-5 text-text-tertiary">
              Bölgen kimlerle eşleştiğini belirler. Konum vermezsen yine o
              bölgede keşfedersin; mesafe etiketi çıkmaz. Konum yalnızca aynı
              bölge içinde sıralama ve mesafe filtresi içindir. Tam konumun
              saklanmaz, uygulama göndermeden önce yaklaşık 1 km&apos;lik alana
              yuvarlar.
            </Text>
            <AppPressable
              onPress={useCurrentLocation}
              disabled={locationBusy}
              className={`min-h-12 items-center justify-center rounded-xl border px-4 ${
                coordinates ? "border-accent bg-accent/10" : "border-border bg-surface"
              }`}
            >
              {locationBusy ? (
                <ActivityIndicator color="#2FB8A6" />
              ) : (
                <Text
                  className={
                    coordinates
                      ? "font-semibold text-accent-dark"
                      : "font-semibold text-text-primary"
                  }
                >
                  {coordinates ? "Konum hazır ✓" : "Konumumu kullan"}
                </Text>
              )}
            </AppPressable>
            {coordinates ? (
              <View className="mt-3">
                <Checkbox
                  checked={locationConsent}
                  onChange={(value) => {
                    setLocationConsent(value);
                    clearFieldError("locationConsent");
                  }}
                >
                  <Text className="text-sm leading-5 text-text-secondary">
                    Yaklaşık konumumun, seçtiğim bölge içinde mesafe bazlı keşfet
                    için işlenmesine açık rıza veriyorum. Bu özellik isteğe bağlıdır.
                  </Text>
                </Checkbox>
                {fieldErrors.locationConsent ? (
                  <Text className="mt-2 text-xs font-semibold text-danger">
                    {fieldErrors.locationConsent}
                  </Text>
                ) : null}
                <AppPressable
                  onPress={() => {
                    setCoordinates(null);
                    setLocationConsent(false);
                    clearFieldError("locationConsent");
                  }}
                  className="mt-2 self-start py-1"
                >
                  <Text className="text-xs font-semibold text-text-tertiary">
                    Konumu kaldır
                  </Text>
                </AppPressable>
              </View>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Field
              label="Petinin adı"
              error={fieldErrors.petName}
              value={petName}
              onChangeText={(value) => {
                setPetName(value);
                clearFieldError("petName");
              }}
              placeholder="Örn. Luna"
              autoCapitalize="words"
              maxLength={40}
            />
            <Text className="mb-2 text-sm font-semibold text-text-primary">Türü</Text>
            <View className="mb-4 flex-row gap-2">
              <View className="flex-1">
                <Choice
                  active={species === "dog"}
                  label="Köpek"
                  onPress={() => setSpecies("dog")}
                />
              </View>
              <View className="flex-1">
                <Choice
                  active={species === "cat"}
                  label="Kedi"
                  onPress={() => setSpecies("cat")}
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
            <Text className="mb-4 text-xs leading-4 text-text-tertiary">
              Tür ve cinsiyet kayıtta kilitlenir. Petin değişirse 6 ayda bir
              profilden güncelleyebilirsin.
            </Text>

            <PetAgePicker value={petAge} onChange={setPetAge} />

            {/*
              Irk, boyut, enerji ve kısırlaştırma buradan çıkarıldı. Hepsinin
              şemada varsayılanı var; kullanıcı bunları ürünü gördükten sonra,
              keşfetteki profil tamamlama kartından dolduruyor.
            */}
            <Text className="text-xs leading-5 text-text-tertiary">
              Irk, boyut ve enerji gibi ayrıntıları sonra profilinden
              ekleyebilirsin — eşleşme önerileri onlarla daha isabetli olur.
            </Text>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text className="mb-2 text-sm font-semibold text-text-primary">
              Pet fotoğrafları
            </Text>
            <Text className="mb-4 text-sm leading-5 text-text-secondary">
              En az 1, en fazla 6 fotoğraf. Büyük kare kapak. Petinle aynı
              karede olduğun fotoğraflar karşı tarafın seni tanımasını kolaylaştırır.
            </Text>
            <PetPhotoEditor
              photos={photos}
              max={6}
              onDragActive={setPhotoDragging}
              onAdd={() => void pickPhotos()}
              // `PetPhotoEditor` yalnızca verdiğimiz diziyi filtreler/yeniden
              // sıralar, yeni nesne üretmez — bu yüzden döndürdüğü referanslar
              // hâlâ `LocalPhoto`. Tip imzası genel `EditablePhoto[]` olduğu
              // için burada güvenli bir daraltma gerekiyor.
              onChange={(next) => {
                setPhotos(next as LocalPhoto[]);
                clearFieldError("photos");
              }}
            />
            {fieldErrors.photos ? (
              <Text className="mt-2 text-xs font-semibold text-danger">
                {fieldErrors.photos}
              </Text>
            ) : null}

            <View className="mt-5 rounded-2xl border border-border bg-surface p-4">
              <Checkbox
                checked={legalAccepted}
                onChange={(value) => {
                  setLegalAccepted(value);
                  clearFieldError("legal");
                }}
              >
                <Text className="text-sm leading-5 text-text-secondary">
                  Kullanım koşullarını kabul ediyor; gizlilik politikası ve KVKK
                  aydınlatma metnini okuduğumu onaylıyorum. Sahip profilim
                  keşfette görünür başlar; dilediğim zaman ayarlardan kapatabilirim.
                </Text>
              </Checkbox>
              <AppPressable onPress={() => router.push("/(auth)/legal")} className="mt-3">
                <Text className="text-sm font-semibold text-brand">Metinleri aç</Text>
              </AppPressable>
              {fieldErrors.legal ? (
                <Text className="mt-3 text-xs font-semibold text-danger">{fieldErrors.legal}</Text>
              ) : null}

              {/*
                Konum rızası adım 1'de. Keşfet görünürlüğü checkbox'ta
                açıklanıyor; `public_profile_consent` completeOnboarding'de
                yazılıyor. Kapatmak Sahip profili ayarından.
              */}
            </View>
          </>
        ) : null}

        {error ? (
          <View className="mt-5 rounded-xl border border-danger/30 bg-danger/10 p-3">
            <Text className="text-sm text-danger">{error}</Text>
          </View>
        ) : null}

      </ScrollView>

      <View className="absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-border bg-bg-primary px-6 pb-6 pt-3">
          {step > 0 ? (
            <AppPressable
              onPress={() => setStep((step - 1) as Step)}
              disabled={busy}
              className="flex-1 items-center rounded-xl border border-border bg-surface py-4"
            >
              <Text className="font-semibold text-text-primary">Geri</Text>
            </AppPressable>
          ) : null}
          <AppPressable
            onPress={step === 2 ? submit : next}
            disabled={busy}
            className="flex-[2] items-center rounded-xl bg-brand py-4 disabled:opacity-50"
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-bold text-white">{step === 2 ? "Profili tamamla" : "Devam"}</Text>
            )}
          </AppPressable>
      </View>
    </KeyboardAvoidingView>
  );
}
