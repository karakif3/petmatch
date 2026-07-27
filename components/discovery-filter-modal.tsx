import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type {
  DiscoveryDeck,
  DiscoveryFilterSettings,
  OwnerDiscoveryFilterInput,
} from "../core/api/discovery";

const distanceOptions = [5, 10, 25, 50, 100] as const;

const genderOptions: {
  value: "female" | "male" | "other";
  label: string;
}[] = [
  { value: "female", label: "Kadın" },
  { value: "male", label: "Erkek" },
  { value: "other", label: "Diğer" },
];

function Toggle({
  label,
  detail,
  value,
  disabled = false,
  onValueChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  disabled?: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View className={`flex-row items-center py-3 ${disabled ? "opacity-45" : ""}`}>
      <View className="mr-4 flex-1">
        <Text className="font-semibold text-text-primary">{label}</Text>
        <Text className="mt-1 text-xs leading-4 text-text-secondary">{detail}</Text>
      </View>
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ false: "#E8DDD5", true: "#FFB4A8" }}
        thumbColor={value ? "#F97362" : "#FFFFFF"}
      />
    </View>
  );
}

export function DiscoveryFilterModal({
  visible,
  ownerSettings,
  filterSettings,
  localFilters,
  busy,
  onClose,
  onConfigureOwner,
  onApply,
}: {
  visible: boolean;
  ownerSettings: DiscoveryDeck["ownerSettings"];
  filterSettings: DiscoveryFilterSettings;
  localFilters: OwnerDiscoveryFilterInput;
  busy: boolean;
  onClose: () => void;
  onConfigureOwner: () => void;
  onApply: (
    persistent: DiscoveryFilterSettings,
    local: OwnerDiscoveryFilterInput,
  ) => void;
}) {
  const [requirePhoto, setRequirePhoto] = useState(false);
  const [requireSocial, setRequireSocial] = useState(false);
  const [requireVerified, setRequireVerified] = useState(false);
  const [species, setSpecies] = useState<("cat" | "dog")[]>([]);
  const [maxDistanceKm, setMaxDistanceKm] = useState(25);
  const [minPetAge, setMinPetAge] = useState("");
  const [maxPetAge, setMaxPetAge] = useState("");
  const [requireVisibleOwner, setRequireVisibleOwner] = useState(false);
  const [notifyOnNewCandidates, setNotifyOnNewCandidates] = useState(false);
  const [genders, setGenders] =
    useState<OwnerDiscoveryFilterInput["genders"]>([]);
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setRequirePhoto(ownerSettings.requirePhoto);
    setRequireSocial(ownerSettings.requireSocial);
    setRequireVerified(ownerSettings.requireVerified);
    setSpecies(filterSettings.species);
    setMaxDistanceKm(filterSettings.maxDistanceKm);
    setMinPetAge(filterSettings.minPetAgeYears?.toString() ?? "");
    setMaxPetAge(filterSettings.maxPetAgeYears?.toString() ?? "");
    setRequireVisibleOwner(filterSettings.requireVisibleOwner);
    setNotifyOnNewCandidates(filterSettings.notifyOnNewCandidates);
    setGenders(localFilters.genders);
    setMinAge(localFilters.minAge?.toString() ?? "");
    setMaxAge(localFilters.maxAge?.toString() ?? "");
    setError(null);
  }, [filterSettings, localFilters, ownerSettings, visible]);

  const canFilterOwnerDetails =
    ownerSettings.visibility === "public" && ownerSettings.gender !== null;

  const toggleGender = (value: "female" | "male" | "other") => {
    setGenders((items) =>
      items.includes(value) ? items.filter((item) => item !== value) : [...items, value],
    );
  };

  const apply = () => {
    const parsedPetMin = minPetAge.trim() ? Number(minPetAge) : null;
    const parsedPetMax = maxPetAge.trim() ? Number(maxPetAge) : null;
    if (species.length === 0) {
      setError("En az bir pet türü seçmelisin.");
      return;
    }
    if (
      (parsedPetMin !== null && (!Number.isFinite(parsedPetMin) || parsedPetMin < 0 || parsedPetMin > 40)) ||
      (parsedPetMax !== null && (!Number.isFinite(parsedPetMax) || parsedPetMax < 0 || parsedPetMax > 40))
    ) {
      setError("Pet yaş aralığı 0–40 yıl arasında olmalı.");
      return;
    }
    if (parsedPetMin !== null && parsedPetMax !== null && parsedPetMin > parsedPetMax) {
      setError("En düşük pet yaşı, en yüksek yaştan büyük olamaz.");
      return;
    }
    const parsedMin = minAge.trim() ? Number(minAge) : null;
    const parsedMax = maxAge.trim() ? Number(maxAge) : null;
    if (
      (parsedMin !== null && (!Number.isInteger(parsedMin) || parsedMin < 18 || parsedMin > 99)) ||
      (parsedMax !== null && (!Number.isInteger(parsedMax) || parsedMax < 18 || parsedMax > 99))
    ) {
      setError("Sahip yaş aralığı 18–99 arasında tam sayı olmalı.");
      return;
    }
    if (parsedMin !== null && parsedMax !== null && parsedMin > parsedMax) {
      setError("En düşük yaş, en yüksek yaştan büyük olamaz.");
      return;
    }
    onApply(
      {
        species,
        maxDistanceKm,
        minPetAgeYears: parsedPetMin,
        maxPetAgeYears: parsedPetMax,
        requireVisibleOwner,
        requirePhoto,
        requireSocial,
        requireVerified,
        notifyOnNewCandidates,
      },
      {
        genders: canFilterOwnerDetails ? genders : [],
        minAge: ownerSettings.visibility === "public" ? parsedMin : null,
        maxAge: ownerSettings.visibility === "public" ? parsedMax : null,
      },
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/40"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="max-h-[92%] rounded-t-3xl bg-bg-primary px-5 pb-8 pt-4">
          <View className="mb-2 flex-row items-center justify-between">
            <View>
              <Text className="text-xl font-bold text-text-primary">Keşfet filtreleri</Text>
              <Text className="mt-1 text-xs text-text-secondary">
                Pet uyumu her zaman temel sıralama sinyalidir.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              disabled={busy}
              className="h-10 w-10 items-center justify-center rounded-full bg-bg-secondary"
            >
              <Ionicons name="close" color="#1F1A17" size={22} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <Text className="mb-2 mt-4 text-lg font-bold text-text-primary">Petler</Text>
            <Text className="mb-2 text-sm font-semibold text-text-primary">Tür</Text>
            <View className="mb-5 flex-row gap-2">
              {([
                ["dog", "🐕 Köpek"],
                ["cat", "🐈 Kedi"],
              ] as const).map(([value, label]) => {
                const active = species.includes(value);
                return (
                  <Pressable
                    key={value}
                    onPress={() =>
                      setSpecies((items) =>
                        items.includes(value)
                          ? items.filter((item) => item !== value)
                          : [...items, value],
                      )
                    }
                    className={`flex-1 items-center rounded-xl border py-3 ${
                      active ? "border-brand bg-brand/10" : "border-border bg-surface"
                    }`}
                  >
                    <Text className={active ? "font-semibold text-brand-dark" : "font-semibold text-text-secondary"}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text className="mb-2 text-sm font-semibold text-text-primary">
              En uzak mesafe · {maxDistanceKm} km
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
              <View className="flex-row gap-2">
                {distanceOptions.map((distance) => (
                  <Pressable
                    key={distance}
                    onPress={() => setMaxDistanceKm(distance)}
                    className={`rounded-full border px-4 py-2 ${
                      maxDistanceKm === distance
                        ? "border-accent bg-accent/10"
                        : "border-border bg-surface"
                    }`}
                  >
                    <Text className={maxDistanceKm === distance ? "font-semibold text-accent-dark" : "text-text-secondary"}>
                      {distance} km
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>

            <Text className="mb-2 text-sm font-semibold text-text-primary">
              Pet yaş aralığı (yıl)
            </Text>
            <View className="mb-5 flex-row gap-3">
              <TextInput
                value={minPetAge}
                onChangeText={setMinPetAge}
                placeholder="Min. 0"
                placeholderTextColor="#9A8B82"
                keyboardType="decimal-pad"
                className="flex-1 rounded-xl border border-border bg-surface px-4 py-3.5 text-text-primary"
              />
              <TextInput
                value={maxPetAge}
                onChangeText={setMaxPetAge}
                placeholder="Maks. 40"
                placeholderTextColor="#9A8B82"
                keyboardType="decimal-pad"
                className="flex-1 rounded-xl border border-border bg-surface px-4 py-3.5 text-text-primary"
              />
            </View>

            <Text className="mb-1 mt-4 text-lg font-bold text-text-primary">
              Sahip profili
            </Text>
            <View className="rounded-2xl border border-border bg-surface px-4">
              <Toggle
                label="Sahibi görünür profiller"
                detail="Sahip profilini en az eşleşmeden sonra paylaşan petleri göster."
                value={requireVisibleOwner}
                onValueChange={setRequireVisibleOwner}
              />
              <View className="h-px bg-border" />
              <Toggle
                label="Sahip fotoğrafı görünenler"
                detail="Keşfette fotoğrafını açıkça paylaşan pet sahiplerini göster."
                value={requirePhoto}
                onValueChange={setRequirePhoto}
              />
              <View className="h-px bg-border" />
              <Toggle
                label="Sosyalleşmeye açık sahipler"
                detail="Pet buluşmasında kendisi de sosyalleşmeye açık olanları göster."
                value={requireSocial}
                disabled={!ownerSettings.socialOpen}
                onValueChange={(value) => {
                  setRequireSocial(value);
                  if (value) setRequirePhoto(true);
                }}
              />
              <View className="h-px bg-border" />
              <Toggle
                label="Yalnız doğrulanmış sahipler"
                detail="Sahip + pet birlikte fotoğraf doğrulaması onaylanmış profiller."
                value={requireVerified}
                onValueChange={setRequireVerified}
              />
            </View>

            {!ownerSettings.socialOpen ? (
              <Pressable
                onPress={onConfigureOwner}
                className="mt-3 flex-row items-center rounded-xl bg-brand/10 px-4 py-3"
              >
                <Ionicons name="information-circle-outline" color="#E0523F" size={21} />
                <Text className="ml-2 flex-1 text-xs font-semibold leading-4 text-brand-dark">
                  Sosyalleşme filtresi karşılıklıdır. Önce kendi sahip profilini etkinleştir.
                </Text>
                <Ionicons name="chevron-forward" color="#E0523F" size={18} />
              </Pressable>
            ) : null}

            <Text className="mb-1 mt-6 text-lg font-bold text-text-primary">
              Kimlerle buluşmakta rahatsın?
            </Text>
            <Text className="mb-3 text-xs leading-5 text-text-secondary">
              Yaş ve cinsiyet seçimleri hesabında saklanmaz. Bu filtreler yalnızca
              kendi bilgilerini karşılıklı paylaşan profiller arasında çalışır.
            </Text>

            {canFilterOwnerDetails ? (
              <>
                <Text className="mb-2 text-sm font-semibold text-text-primary">Cinsiyet</Text>
                <View className="mb-4 flex-row flex-wrap gap-2">
                  {genderOptions.map((option) => {
                    const active = genders.includes(option.value);
                    return (
                      <Pressable
                        key={option.value}
                        onPress={() => toggleGender(option.value)}
                        className={`rounded-full border px-4 py-2.5 ${
                          active ? "border-accent bg-accent/10" : "border-border bg-surface"
                        }`}
                      >
                        <Text className={`text-sm font-semibold ${active ? "text-accent-dark" : "text-text-secondary"}`}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <Pressable
                onPress={onConfigureOwner}
                className="mb-4 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <Text className="text-xs leading-5 text-text-secondary">
                  Cinsiyet filtresi için kendi görünür sahip profilinde cinsiyetini
                  paylaşmalısın. Ayarlamak için dokun.
                </Text>
              </Pressable>
            )}

            {ownerSettings.visibility === "public" ? (
              <>
                <Text className="mb-2 text-sm font-semibold text-text-primary">
                  Sahip yaş aralığı
                </Text>
                <View className="flex-row gap-3">
                  <TextInput
                    value={minAge}
                    onChangeText={setMinAge}
                    placeholder="Min. 18"
                    placeholderTextColor="#9A8B82"
                    keyboardType="number-pad"
                    maxLength={2}
                    className="flex-1 rounded-xl border border-border bg-surface px-4 py-3.5 text-text-primary"
                  />
                  <TextInput
                    value={maxAge}
                    onChangeText={setMaxAge}
                    placeholder="Maks. 99"
                    placeholderTextColor="#9A8B82"
                    keyboardType="number-pad"
                    maxLength={2}
                    className="flex-1 rounded-xl border border-border bg-surface px-4 py-3.5 text-text-primary"
                  />
                </View>
              </>
            ) : (
              <Text className="rounded-xl border border-border bg-surface px-4 py-3 text-xs leading-5 text-text-secondary">
                Yaş filtresi için kendi sahip profilini keşfette görünür yapmalısın.
              </Text>
            )}

            {error ? (
              <View className="mt-4 rounded-xl border border-danger/30 bg-danger/10 p-3">
                <Text className="text-sm text-danger">{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => {
                setSpecies(["cat", "dog"]);
                setMaxDistanceKm(25);
                setMinPetAge("");
                setMaxPetAge("");
                setRequireVisibleOwner(false);
                setRequirePhoto(false);
                setRequireSocial(false);
                setRequireVerified(false);
                setNotifyOnNewCandidates(false);
                setGenders([]);
                setMinAge("");
                setMaxAge("");
                setError(null);
              }}
              disabled={busy}
              className="mt-5 items-center rounded-xl border border-border bg-surface py-3 disabled:opacity-50"
            >
              <Text className="font-semibold text-text-secondary">Tüm filtreleri sıfırla</Text>
            </Pressable>

            <Pressable
              onPress={apply}
              disabled={busy}
              className="mt-5 items-center rounded-xl bg-brand py-4 disabled:opacity-50"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-bold text-white">Filtreleri uygula</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
