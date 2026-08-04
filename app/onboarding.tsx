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
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { BirthDateField } from "../components/birth-date-field";
import { BrandMark } from "../components/brand-mark";
import { PetAgePicker } from "../components/pet-age-picker";
import { completeOnboarding, type OnboardingPhoto } from "../core/api/onboarding";
import { listRegions, setMyRegion } from "../core/api/regions";
import { isAdultDate } from "../core/domain/date-validation";
import { PET_AGE_UNKNOWN, petAgeToBirthDate } from "../core/domain/pet-age";
import { coarsenCoordinates } from "../core/domain/distance";
import type { Coordinates, Species } from "../core/domain/types";
import { useTranslation } from "../core/i18n";
import { ensureImageLibraryAccess } from "../core/media/image-library";
import { useAuthStore } from "../stores/auth";

type Step = 0 | 1 | 2;

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
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const setOnboarded = useAuthStore((state) => state.setOnboarded);

  const [step, setStep] = useState<Step>(0);
  const [displayName, setDisplayName] = useState("");
  const [ownerBirthDate, setOwnerBirthDate] = useState("");
  const [city, setCity] = useState("");
  const [regionSlug, setRegionSlug] = useState<string | null>(null);

  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState<Species>("dog");
  const [gender, setGender] = useState<"male" | "female">("female");
  const [petAge, setPetAge] = useState<string>(PET_AGE_UNKNOWN);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [photos, setPhotos] = useState<OnboardingPhoto[]>([]);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [locationConsent, setLocationConsent] = useState(false);

  const [busy, setBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bölge listesi veriden geliyor: yeni pilot bölge açmak istemci sürümü
  // gerektirmesin diye enum değil tablo.
  const regions = useQuery({ queryKey: ["regions"], queryFn: listRegions });

  const progress = useMemo(() => `${step + 1} / 3`, [step]);

  const selectedRegion = useMemo(
    () => (regions.data ?? []).find((region) => region.slug === regionSlug) ?? null,
    [regions.data, regionSlug],
  );

  // Pilot bölgelerin şehri `regions.city`'den geliyor; yalnızca "Diğer"
  // seçilirse kullanıcıya sorulur.
  const needsManualCity = selectedRegion !== null && selectedRegion.city === null;
  const resolvedCity = needsManualCity ? city.trim() || null : selectedRegion?.city ?? null;

  const next = () => {
    setError(null);
    if (step === 0) {
      // Takvim 18 yaş altını zaten seçtirmiyor; burada kalan tek durum
      // kullanıcının tarihe hiç dokunmamış olması.
      if (!isAdultDate(ownerBirthDate)) {
        return setError("Doğum tarihini seçmelisin.");
      }
      if (!regionSlug) return setError("Bölgeni seçmelisin.");
      if (needsManualCity && !city.trim()) return setError("Şehrini yazmalısın.");
      setStep(1);
      return;
    }
    if (step === 1) {
      if (!petName.trim()) return setError("Petinin adını yazmalısın.");
      setStep(2);
    }
  };

  const pickPhotos = async () => {
    setError(null);
    if (!(await ensureImageLibraryAccess())) {
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
    if (!legalAccepted) {
      setError("Kullanım koşullarını kabul edip gizlilik/KVKK metnini okuduğunu onaylamalısın.");
      return;
    }
    if (coordinates && !locationConsent) {
      setError("Yaklaşık konumu kullanmak için ayrı açık rıza seçimini yapmalısın.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      // Bölge ayrı dar yazma yolundan gidiyor; onboarding RPC'sinin imzasını
      // değiştirmek mevcut çağrıları kırardı.
      if (regionSlug) await setMyRegion(regionSlug);

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
              onChange={setOwnerBirthDate}
            />
            <Text className="mb-2 text-sm font-semibold text-text-primary">
              Bölgen
            </Text>
            <Text className="mb-3 text-xs leading-4 text-text-tertiary">
              PetMatch şimdilik Kadıköy ve Nişantaşı&apos;nda başlıyor. Yakınında
              kimse olması için önce buralarda yoğunlaşıyoruz.
            </Text>
            <View className="mb-5 flex-row flex-wrap gap-2">
              {(regions.data ?? []).map((region) => {
                const active = regionSlug === region.slug;
                return (
                  <Pressable
                    key={region.slug}
                    onPress={() => setRegionSlug(region.slug)}
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
                  </Pressable>
                );
              })}
            </View>
            {/*
              Şehir yalnızca "Diğer" seçilince soruluyor. Pilot bölgelerin
              ikisi de İstanbul; bölge seçildiği an şehir zaten belli ve
              `regions.city` üzerinden geliyor. Hedef kitleye aynı soruyu iki
              kez sormanın anlamı yoktu.
            */}
            {needsManualCity ? (
              <Field
                label="Şehir"
                value={city}
                onChangeText={setCity}
                placeholder="Örn. Ankara"
                autoCapitalize="words"
              />
            ) : null}

            {/*
              Konum bölgeyle AYNI blokta duruyor.
              Ayrı adımlardayken kullanıcıya "nerede yaşıyorsun" iki kez
              sorulmuş gibi geliyordu. Aynı şey değiller — bölge zorunlu ve
              pilot ölçümünün anahtarı, konum ise opsiyonel ve yalnızca
              mesafeye göre sıralama için — ama bu ayrım ancak yan yana
              dururken anlaşılıyor. Konum bölgeden TÜRETİLEMİYOR: izni
              vermeyen kullanıcı pilot ölçümünden düşerdi.
            */}
            <Text className="mb-1 text-sm font-semibold text-text-primary">
              Yaklaşık konum (opsiyonel)
            </Text>
            <Text className="mb-3 text-xs leading-5 text-text-tertiary">
              Bölgen kimlerle eşleştiğini belirliyor; konum ise onları sana
              yakınlıklarına göre sıralıyor. Tam konumun saklanmaz, uygulama
              göndermeden önce yaklaşık 1 km&apos;lik alana yuvarlar.
            </Text>
            <Pressable
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
            </Pressable>
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

            {/* Konum artık adım 1'de, bölgenin yanında. Rızası burada
                kalıyor çünkü diğer yasal onaylarla birlikte alınıyor. */}

            <View className="mt-2 rounded-2xl border border-border bg-surface p-4">
              <Pressable
                onPress={() => setLegalAccepted((value) => !value)}
                className="flex-row items-start"
              >
                <Text className="mr-3 text-xl">{legalAccepted ? "☑" : "☐"}</Text>
                <Text className="flex-1 text-sm leading-5 text-text-secondary">
                  Kullanım koşullarını kabul ediyor; gizlilik politikası ve KVKK
                  aydınlatma metnini okuduğumu onaylıyorum.
                </Text>
              </Pressable>
              <Pressable onPress={() => router.push("/(auth)/legal")} className="mt-3">
                <Text className="text-sm font-semibold text-brand">Metinleri aç</Text>
              </Pressable>

              {coordinates ? (
                <Pressable
                  onPress={() => setLocationConsent((value) => !value)}
                  className="mt-4 flex-row items-start border-t border-border pt-4"
                >
                  <Text className="mr-3 text-xl">{locationConsent ? "☑" : "☐"}</Text>
                  <Text className="flex-1 text-sm leading-5 text-text-secondary">
                    Yaklaşık konumumun mesafe bazlı keşfet için işlenmesine açık rıza
                    veriyorum. Bu özellik isteğe bağlıdır.
                  </Text>
                </Pressable>
              ) : null}

              {/*
                Herkese açık profil rızası buradan kaldırıldı: kayıt akışı
                artık görünürlük sormuyor, varsayılan `after_match` kalıyor ve
                o herkese açık bir profil değil. Rıza, kullanıcı profilinden
                "Herkese açık"a geçmek istediğinde orada alınıyor — kararın
                yanında, bir ekran ötesinde değil.
              */}
            </View>
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
