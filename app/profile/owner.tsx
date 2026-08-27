import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
// SafeAreaView react-native'den DEĞİL buradan geliyor: deprecated olan
// sürüm iOS 26'da KeyboardAvoidingView zinciriyle birlikte içeriği sıfır
// yüksekliğe düşürüyor ve ekran boş render ediliyordu.
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppIcon } from "../../components/ui/icon";

import {
  loadEditableProfile,
  saveOwnerPhotos,
  saveOwnerProfile,
  submitOwnerVerification,
  submitVerificationAppeal,
  OWNER_PHOTO_MAX,
  type LocalProfilePhoto,
} from "../../core/api/profile";
import { BirthDateField } from "../../components/birth-date-field";
import { PetPhotoEditor } from "../../components/pet-photo-editor";
import { isAdultDate } from "../../core/domain/date-validation";
import { ownerAgeBucket, ownerAgeBucketChanged } from "../../core/domain/owner-age-bucket";
import { ownerInterestLabels } from "../../core/domain/labels";
import {
  CONNECTION_TAGS,
  OWNER_INTERESTS,
  type ConnectionTag,
  type OwnerInterest,
  type OwnerVisibility,
} from "../../core/domain/types";
import { useTranslation } from "../../core/i18n";
import { ensureImageLibraryAccess } from "../../core/media/image-library";
import { useAuthStore } from "../../stores/auth";
import { errorMessage } from "../../core/domain/error-message";
import { OwnerVisibilityPreview } from "../../components/owner-visibility-preview";
import { AppPressable } from "../../components/ui/pressable";
import { SectionTitle } from "../../components/ui/section";
import { ProfileFormSkeleton } from "../../components/ui/skeleton";
import { successHaptic } from "../../core/ui/haptics";
import { useUnsavedChangesGuard } from "../../core/ui/unsaved-changes-guard";

type PhotoItem =
  | { id: string; kind: "remote"; storagePath: string; uri: string }
  | ({ id: string; kind: "local" } & LocalProfilePhoto);

const visibilityOptions: {
  value: OwnerVisibility;
  label: string;
  detail: string;
  recommended?: boolean;
}[] = [
  {
    value: "public",
    label: "Keşfette görünür",
    recommended: true,
    detail:
      "Kapak fotoğrafın ve adın pet kartında çıkar. Dilediğin zaman buradan kapatabilirsin.",
  },
  {
    value: "after_match",
    label: "Yalnızca eşleşince",
    detail: "Keşfette yalnızca petin görünür; sahip bilgilerin eşleşince açılır.",
  },
  {
    value: "hidden",
    label: "Gizli",
    detail: "Keşfette yalnızca petin görünür. Eşleşseniz bile sahip bölümü çıkmaz.",
  },
];

const MAX_INTERESTS = 8;

const verificationReasonLabels: Record<string, string> = {
  unclear_photo: "Fotoğraf yeterince net değil",
  pet_not_visible: "Pet fotoğrafta net görünmüyor",
  owner_not_visible: "Sahibin yüzü net görünmüyor",
  multiple_people: "Fotoğrafta birden fazla kişi var",
  edited_photo: "Fotoğraf filtrelenmiş veya düzenlenmiş görünüyor",
  other: "Başvuru koşulları karşılanmadı",
};

const genderOptions: {
  value: "female" | "male" | "other";
  label: string;
}[] = [
  { value: "female", label: "Kadın" },
  { value: "male", label: "Erkek" },
  { value: "other", label: "Diğer" },
];

/**
 * `error`: doğrulama geri bildirimi ARTIK ALANIN YANINDA.
 * Öncesinde tek doğrulama (doğum tarihi) yalnızca kaydetme anında,
 * formun en altındaki ortak hata kutusunda görünüyordu — kullanıcı
 * hangi alanın sorunlu olduğunu metinden çıkarmak zorundaydı.
 *
 * `accessibilityLabel` şart: React Native etiketi otomatik olarak input'a
 * BAĞLAMIYOR; ekran okuyucu bu alanları adsız okuyordu.
 */
function Field({
  label,
  hint,
  error,
  ...props
}: {
  label: string;
  hint?: string;
  error?: string | null;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-sm font-semibold text-text-primary">{label}</Text>
      <TextInput
        placeholderTextColor="#B9A99F"
        accessibilityLabel={label}
        className={`rounded-xl border bg-surface px-4 py-3.5 text-text-primary ${
          error ? "border-danger" : "border-border"
        }`}
        {...props}
      />
      {error ? (
        <Text className="mt-2 text-xs font-semibold leading-4 text-danger">{error}</Text>
      ) : hint ? (
        <Text className="mt-2 text-xs leading-4 text-text-tertiary">{hint}</Text>
      ) : null}
    </View>
  );
}

export default function OwnerProfileScreen() {
  const t = useTranslation();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ focus?: string | string[] }>();
  const focus = Array.isArray(params.focus) ? params.focus[0] : params.focus;
  const scrollRef = useRef<ScrollView>(null);
  const [visibilityOffset, setVisibilityOffset] = useState<number | null>(null);
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => loadEditableProfile(user!.id),
    enabled: Boolean(user),
  });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"female" | "male" | "other" | null>(null);
  const [visibility, setVisibility] = useState<OwnerVisibility>("public");
  const [socialOpen, setSocialOpen] = useState(false);
  const [connectionTag, setConnectionTag] = useState<ConnectionTag | null>(null);
  const [interests, setInterests] = useState<OwnerInterest[]>([]);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [verificationPhoto, setVerificationPhoto] =
    useState<LocalProfilePhoto | null>(null);
  const [verificationAcknowledged, setVerificationAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoDragging, setPhotoDragging] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationExpanded, setVerificationExpanded] = useState(false);
  const [appealText, setAppealText] = useState("");
  const [appealBusy, setAppealBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.displayName ?? "");
    setBio(profile.data.ownerBio ?? "");
    setBirthDate(profile.data.ownerBirthDate);
    setGender(profile.data.ownerGender);
    setVisibility(profile.data.ownerVisibility);
    setSocialOpen(profile.data.ownerSocialOpen);
    setConnectionTag(profile.data.connectionTag);
    setInterests(profile.data.ownerInterests);
    setPhotos(
      (profile.data.ownerPhotos.length
        ? profile.data.ownerPhotos
        : profile.data.ownerAvatar
          ? [profile.data.ownerAvatar]
          : []
      ).map((photo, index) => ({
        id: `${photo.storagePath}#${index}`,
        kind: "remote" as const,
        storagePath: photo.storagePath,
        uri: photo.url,
      })),
    );
  }, [profile.data]);

  useEffect(() => {
    if (focus !== "visibility" || visibilityOffset === null) return;
    const handle = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, visibilityOffset - 12),
        animated: true,
      });
    });
    return () => cancelAnimationFrame(handle);
  }, [focus, visibilityOffset]);

  /* Başarı mesajı kendiliğinden kaybolur, hata kalır (bkz. profil ekranı). */
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const pickFromLibrary = async (available: number) => {
    if (!(await ensureImageLibraryAccess())) {
      setError("Sahip fotoğrafı seçmek için galeri izni gerekiyor.");
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

  const pickFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Sahip fotoğrafı çekmek için kamera izni gerekiyor.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.85,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
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
    setError(null);
    const available = OWNER_PHOTO_MAX - photos.length;
    if (available < 1) {
      setError(`En fazla ${OWNER_PHOTO_MAX} sahip fotoğrafı ekleyebilirsin.`);
      return;
    }
    Alert.alert("Fotoğraf ekle", undefined, [
      { text: "Vazgeç", style: "cancel" },
      { text: "Galeriden seç", onPress: () => void pickFromLibrary(available) },
      { text: "Fotoğraf çek", onPress: () => void pickFromCamera() },
    ]);
  };

  const takeVerificationPhoto = async () => {
    setError(null);
    setNotice(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setError("Doğrulama fotoğrafı çekmek için kamera izni gerekiyor.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.72,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled) return;
    const photo = result.assets[0];
    setVerificationPhoto({
      uri: photo.uri,
      fileName: photo.fileName ?? null,
      mimeType: photo.mimeType ?? null,
    });
  };

  const toggleInterest = (interest: OwnerInterest) => {
    setInterests((current) =>
      current.includes(interest)
        ? current.filter((value) => value !== interest)
        : current.length >= MAX_INTERESTS
          ? current
          : [...current, interest],
    );
  };

  /**
   * "Tanışmaya açığım" seçeneğinin ön koşulları — ad + sahip fotoğrafı +
   * GİZLİ OLMAYAN bir görünürlük (`0066`). Önceki kural yalnızca `public`'e
   * izin veriyordu; "eşleşince görünür + açık" da artık geçerli — pet
   * uyumu önce, romantik sinyal yalnızca eşleşince ortaya çıksın diyen
   * makul bir tercih. Kaydetme anında tek bir hata cümlesi yerine, seçenek
   * görünürken eksik kalemler tek tek gösteriliyor.
   */
  const missingConnectionRequirements = [
    displayName.trim() ? null : "Adın",
    photos.length ? null : "Sahip fotoğrafın",
    visibility === "hidden" ? "Görünürlük: gizli olmasın" : null,
  ].filter((item): item is string => item !== null);

  /**
   * Kirli durum: kaydet düğmesi artık sayfanın en altında sabit değil,
   * yalnızca gerçekten bir şey değiştiğinde beliren bir alt şeritte.
   *
   * Öncesinde 8 alanlık formun en altına inip "Kaydet"e basmak gerekiyordu
   * ve düğme her zaman aynı görünüyordu — kullanıcı bir şey değiştirip
   * değiştirmediğini de, kaydedip kaydetmediğini de bilmiyordu. Aynı
   * sorunu profil ekranında da düzeltmiştik (bkz. experience-roadmap §16).
   */
  const sameInterests =
    profile.data !== undefined &&
    interests.length === profile.data.ownerInterests.length &&
    interests.every((item) => profile.data!.ownerInterests.includes(item));

  const savedPhotos = profile.data?.ownerPhotos.length
    ? profile.data.ownerPhotos
    : profile.data?.ownerAvatar
      ? [profile.data.ownerAvatar]
      : [];
  const photosMatch =
    profile.data !== undefined &&
    photos.length === savedPhotos.length &&
    photos.every(
      (photo, index) =>
        photo.kind === "remote" &&
        photo.storagePath === savedPhotos[index]?.storagePath,
    );

  const dirty =
    Boolean(profile.data) &&
    (displayName !== (profile.data!.displayName ?? "") ||
      bio !== (profile.data!.ownerBio ?? "") ||
      birthDate !== profile.data!.ownerBirthDate ||
      gender !== profile.data!.ownerGender ||
      visibility !== profile.data!.ownerVisibility ||
      socialOpen !== profile.data!.ownerSocialOpen ||
      connectionTag !== profile.data!.connectionTag ||
      !sameInterests ||
      !photosMatch ||
      Boolean(verificationPhoto) ||
      verificationAcknowledged);

  useUnsavedChangesGuard(
    dirty,
    "Çıkarsan bu turdaki değişiklikler kaybolur.",
  );

  const resetForm = () => {
    if (!profile.data) return;
    setDisplayName(profile.data.displayName ?? "");
    setBio(profile.data.ownerBio ?? "");
    setBirthDate(profile.data.ownerBirthDate);
    setGender(profile.data.ownerGender);
    setVisibility(profile.data.ownerVisibility);
    setSocialOpen(profile.data.ownerSocialOpen);
    setConnectionTag(profile.data.connectionTag);
    setInterests(profile.data.ownerInterests);
    setPhotos(
      (profile.data.ownerPhotos.length
        ? profile.data.ownerPhotos
        : profile.data.ownerAvatar
          ? [profile.data.ownerAvatar]
          : []
      ).map((photo, index) => ({
        id: `${photo.storagePath}#${index}`,
        kind: "remote" as const,
        storagePath: photo.storagePath,
        uri: photo.url,
      })),
    );
    setVerificationPhoto(null);
    setVerificationAcknowledged(false);
    setError(null);
    setNotice(null);
  };

  /**
   * Kaydedilmemiş değişiklikle geri gitmek SESSİZCE veri kaybettiriyordu.
   * Profil sekmesinde bu risk yoktu (sekme ekranı mount kalıyor, state
   * duruyor); burası bir yığın ekranı, geri basınca unmount oluyor.
   */
  const goBack = () => router.back();

  const persistSave = async () => {
    if (!user || !profile.data) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const previousPaths = savedPhotos.map((photo) => photo.storagePath);
      const coverPath = photosMatch
        ? photos[0]?.kind === "remote"
          ? photos[0].storagePath
          : null
        : await saveOwnerPhotos({
            userId: user.id,
            previousStoragePaths: previousPaths,
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
      await saveOwnerProfile({
        userId: user.id,
        displayName,
        bio,
        birthDate,
        gender,
        ownerVisibility: visibility,
        ownerSocialOpen: socialOpen,
        connectionTag: socialOpen ? connectionTag : null,
        interests,
        avatarPath: coverPath,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["discovery"] }),
        // Keşfet'teki "Profilini tamamla" şeridi bu sorgudan besleniyor;
        // invalidate edilmezse kullanıcı eksiği DOLDURDUKTAN sonra bile
        // aynı sayıyı görüyordu (sekme ekranı mount kalıyor, `staleTime`
        // dolsa bile kendiliğinden tazelenmiyor).
        queryClient.invalidateQueries({ queryKey: ["profile-completion", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["owner-photos"] }),
      ]);
      await profile.refetch();
      successHaptic();
      setNotice("Sahip profilin güncellendi.");
    } catch (saveError) {
      setError(
        errorMessage(saveError, "Sahip profili kaydedilemedi."),
      );
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!user || !profile.data) return;
    if (!isAdultDate(birthDate)) {
      setError("Geçerli bir doğum tarihi yazmalısın ve 18 yaşında olmalısın.");
      return;
    }
    if (socialOpen && (!displayName.trim() || !photos.length || visibility === "hidden")) {
      setError(t("ownerConnection.prerequisitesError"));
      return;
    }

    if (ownerAgeBucketChanged(profile.data.ownerBirthDate, birthDate)) {
      const previous = ownerAgeBucket(profile.data.ownerBirthDate);
      const next = ownerAgeBucket(birthDate);
      Alert.alert(
        "Yaş aralığın değişecek",
        `Karşı taraf “${previous}” yerine “${next}” görecek. Kesin yıl hâlâ gizli.`,
        [
          { text: "Vazgeç", style: "cancel" },
          { text: "Kaydet", onPress: () => void persistSave() },
        ],
      );
      return;
    }

    await persistSave();
  };

  const submitVerification = async () => {
    if (!user || !profile.data || !verificationPhoto) return;
    if (!verificationAcknowledged) {
      setError("Doğrulama fotoğrafının inceleme koşullarını onaylamalısın.");
      return;
    }
    setVerificationBusy(true);
    setError(null);
    setNotice(null);
    try {
      await submitOwnerVerification({
        userId: user.id,
        petId: profile.data.pet.id,
        photo: verificationPhoto,
      });
      setVerificationPhoto(null);
      setVerificationAcknowledged(false);
      await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      await profile.refetch();
      successHaptic();
      setNotice("Doğrulama fotoğrafın inceleme kuyruğuna alındı.");
    } catch (verificationError) {
      setError(
        errorMessage(verificationError, "Doğrulama başvurusu gönderilemedi."),
      );
    } finally {
      setVerificationBusy(false);
    }
  };

  const submitAppeal = async () => {
    const review = profile.data?.verificationReview;
    if (!review || appealText.trim().length < 10) {
      setError("İtiraz açıklaması en az 10 karakter olmalı.");
      return;
    }
    setAppealBusy(true);
    setError(null);
    try {
      await submitVerificationAppeal(review.itemId, appealText);
      setAppealText("");
      await profile.refetch();
      setNotice("İtirazın moderasyon ekibine iletildi.");
    } catch (appealError) {
      setError(errorMessage(appealError, "İtiraz gönderilemedi."));
    } finally {
      setAppealBusy(false);
    }
  };

  if (profile.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-primary">
        <ProfileFormSkeleton variant="owner" />
      </SafeAreaView>
    );
  }
  if (profile.isError || !profile.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-primary px-8">
        <Text className="text-center text-lg font-bold text-text-primary">
          Sahip profili yüklenemedi
        </Text>
        <AppPressable onPress={() => profile.refetch()} className="mt-5 rounded-xl bg-brand px-5 py-3">
          <Text className="font-semibold text-white">Tekrar dene</Text>
        </AppPressable>
      </SafeAreaView>
    );
  }

  const verificationStatus = profile.data.verificationStatus;
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
            <AppIcon name="chevron-left" color="#1F1A17" size={27} />
          </AppPressable>
          <View className="ml-2 flex-1">
            <Text className="text-lg font-bold text-text-primary">Sahip profili</Text>
            <Text className="mt-0.5 text-xs text-text-secondary">
              Ne kadarının görünür olacağı her zaman senin kontrolünde.
            </Text>
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          scrollEnabled={!photoDragging}
          contentContainerClassName={dirty ? "px-5 pb-28 pt-5" : "px-5 pb-12 pt-5"}
        >
          <View className="mb-7">
            <View className="mb-2 flex-row items-baseline justify-between">
              <Text className="text-sm font-semibold text-text-primary">Sahip fotoğrafları</Text>
              <Text className="text-xs text-text-tertiary">
                {photos.length}/{OWNER_PHOTO_MAX}
              </Text>
            </View>
            <PetPhotoEditor
              photos={photos}
              max={OWNER_PHOTO_MAX}
              busy={busy}
              coverAspect={1}
              emptyHint="Kapak keşfet hapında görünür"
              coverHint="Kapak keşfet hapında. Diğer fotoğraflar pet profilinde."
              restHint="Kapak keşfet hapında. Çarpı ile sil; basılı tutup sürükleyerek sırayı değiştir."
              includeSelfHint={false}
              onDragActive={setPhotoDragging}
              onChange={(next) => {
                setPhotos(next as typeof photos);
                if (next.length === 0 && socialOpen) setSocialOpen(false);
              }}
              onAdd={pickPhotos}
            />
          </View>

          <Field
            label="Adın"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Sana nasıl hitap edelim?"
            autoCapitalize="words"
            maxLength={60}
            hint={t("ownerConnection.nameHint")}
          />
          <Field
            label="Kısa bio (opsiyonel)"
            value={bio}
            onChangeText={setBio}
            placeholder="Petinle sevdiğiniz aktiviteleri ve buluşma tarzınızı anlat."
            multiline
            maxLength={500}
            textAlignVertical="top"
            className="min-h-28 rounded-xl border border-border bg-surface px-4 py-3.5 text-text-primary"
          />
          {/* Sayaç alanın kendi bloğunun içinde; öncesinde `-mt-4` ile
              yukarı çekiliyordu — Field'in iç boşluğuna bağımlı, kırılgan. */}
          <Text className="-mt-3 mb-5 text-right text-xs text-text-tertiary">
            {bio.length}/500
          </Text>
          <BirthDateField
            label="Doğum tarihin"
            value={birthDate}
            onChange={setBirthDate}
            helper="Kesin tarih gösterilmez. Keşfette görünürken “25–29 yaş” gibi bir aralık, karşı taraf gizli olsa da çıkar."
          />

          <SectionTitle>Cinsiyet (opsiyonel)</SectionTitle>
          <View className="mb-6 flex-row flex-wrap gap-2">
            {genderOptions.map((option) => {
              const active = gender === option.value;
              return (
                <AppPressable
                  key={option.value ?? "none"}
                  onPress={() => setGender(active ? null : option.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, checked: active }}
                  className={`min-h-11 justify-center rounded-full border px-4 ${
                    active ? "border-brand bg-brand/10" : "border-border bg-surface"
                  }`}
                >
                  <Text className={`text-sm font-semibold ${active ? "text-brand-dark" : "text-text-secondary"}`}>
                    {option.label}
                  </Text>
                </AppPressable>
              );
            })}
          </View>

          <View className="mb-1 flex-row items-baseline justify-between">
            <SectionTitle>İlgi alanların (opsiyonel)</SectionTitle>
            <Text className="text-xs text-text-tertiary">
              {interests.length}/{MAX_INTERESTS}
            </Text>
          </View>
          <Text className="mb-3 text-xs leading-4 text-text-secondary">
            Sahip-sahip uyumunu anlamlı kılar; en fazla {MAX_INTERESTS} tane seçebilirsin.
          </Text>
          <View className="mb-7 flex-row flex-wrap gap-2">
            {OWNER_INTERESTS.map((interest) => {
              const active = interests.includes(interest);
              return (
                <AppPressable
                  key={interest}
                  onPress={() => toggleInterest(interest)}
                  disabled={!active && interests.length >= MAX_INTERESTS}
                  accessibilityRole="checkbox"
                  accessibilityState={{ selected: active, checked: active }}
                  className={`min-h-11 justify-center rounded-full border px-4 disabled:opacity-40 ${
                    active ? "border-brand bg-brand/10" : "border-border bg-surface"
                  }`}
                >
                  <Text className={`text-sm font-semibold ${active ? "text-brand-dark" : "text-text-secondary"}`}>
                    {ownerInterestLabels[interest]}
                  </Text>
                </AppPressable>
              );
            })}
          </View>
          {interests.length >= MAX_INTERESTS ? (
            <Text className="-mt-5 mb-7 text-xs font-semibold text-text-secondary">
              {MAX_INTERESTS} ilgi alanı sınırına ulaştın. Değiştirmek için önce birini kaldır.
            </Text>
          ) : null}

          <View
            onLayout={(event) => {
              setVisibilityOffset(event.nativeEvent.layout.y);
            }}
            className={
              focus === "visibility"
                ? "-mx-2 mb-2 rounded-2xl border border-brand/30 bg-brand/5 px-2 pt-3"
                : undefined
            }
          >
          <SectionTitle>Profil görünürlüğü</SectionTitle>
          <Text className="mb-3 text-xs leading-4 text-text-secondary">
            Keşfet’te ayrı bir gizleme tuşu yok. Dilediğin zaman buradan
            kapatabilirsin.
          </Text>
          <OwnerVisibilityPreview
            visibility={visibility}
            petName={profile.data?.pet.name ?? "petin"}
            owner={{
              displayName: displayName.trim() || null,
              photoUrl: photos[0]?.uri ?? null,
              extraPhotoUrls: photos.slice(1).map((photo) => photo.uri),
              bio: bio.trim() || null,
              gender,
              ageBucket: ownerAgeBucket(birthDate || null),
              socialOpen,
              verified: profile.data?.verificationStatus === "approved",
              interests,
              connectionTag: socialOpen ? connectionTag : null,
            }}
            unsaved={visibility !== profile.data?.ownerVisibility}
          />
          <View className="mb-7 gap-2">
            {/*
              Seçili durum artık YALNIZCA RENKLE anlatılmıyor: solda bir
              radyo işareti var. Renk körlüğünde marka rengiyle kenarlık
              rengi ayırt edilemiyordu; `accessibilityRole="radio"` da
              yoktu, ekran okuyucu üç seçeneği sıradan düğme okuyordu.
            */}
            {visibilityOptions.map((option) => {
              const active = visibility === option.value;
              return (
                <AppPressable
                  key={option.value}
                  onPress={() => {
                    setVisibility(option.value);
                    // Yalnızca `hidden` "açık"la çelişiyor (`0066`) — varlığını
                    // hiç göstermeyip aynı anda tanışmaya açık olmak içsel
                    // çelişki. `after_match` serbest: pet uyumu önce, sinyal
                    // yalnızca eşleşince ortaya çıksın diyen makul bir tercih.
                    if (option.value === "hidden") setSocialOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active, checked: active }}
                  className={`flex-row items-start rounded-xl border px-4 py-3 ${
                    active ? "border-brand bg-brand/10" : "border-border bg-surface"
                  }`}
                >
                  <AppIcon
                    name={active ? "circle-dot" : "circle"}
                    color={active ? "#E0523F" : "#B9A99F"}
                    size={20}
                  />
                  <View className="ml-3 flex-1">
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text
                        className={`font-semibold ${active ? "text-brand-dark" : "text-text-primary"}`}
                      >
                        {option.label}
                      </Text>
                      {option.recommended ? (
                        <View className="rounded-full bg-brand/15 px-2 py-0.5">
                          <Text className="text-[10px] font-bold text-brand-dark">
                            Önerilen
                          </Text>
                        </View>
                      ) : null}
                    </View>
                    {active ? (
                      <Text className="mt-1 text-xs leading-4 text-text-secondary">
                        {option.detail}
                      </Text>
                    ) : null}
                    {option.value === "hidden" && socialOpen ? (
                      <Text className="mt-1 text-xs font-semibold text-brand-dark">
                        Seçersen “yeni insanlarla tanışmak istiyorum” seçeneği kapanır.
                      </Text>
                    ) : null}
                  </View>
                </AppPressable>
              );
            })}
          </View>
          </View>

          <SectionTitle>{t("ownerConnection.title")}</SectionTitle>
          <View className="mb-7 gap-2">
            <AppPressable
              onPress={() => setSocialOpen(false)}
              accessibilityRole="radio"
              accessibilityState={{ selected: !socialOpen, checked: !socialOpen }}
              className={`rounded-2xl border p-4 ${!socialOpen ? "border-accent bg-accent/10" : "border-border bg-surface"}`}
            >
              <View className="flex-row items-center">
                <AppIcon name="paw-print" color={!socialOpen ? "#1E9384" : "#6B5D55"} size={24} />
                <Text className="ml-3 flex-1 font-bold text-text-primary">
                  {t("ownerConnection.petOnlyTitle")}
                </Text>
                {!socialOpen ? (
                  <AppIcon name="circle-check" color="#1E9384" size={20} />
                ) : null}
              </View>
              <Text className="mt-2 text-xs leading-5 text-text-secondary">
                {t("ownerConnection.petOnlyDetail")}
              </Text>
            </AppPressable>
            <AppPressable
              onPress={() => {
                setSocialOpen(true);
                // Yalnızca `hidden`'dan çıkar; `after_match`'i olduğu gibi
                // bırak — "public"e zorlamak, eşleşme öncesi gizli kalıp
                // tanışmaya açık olmak isteyeni dışlıyordu (`0066`).
                if (visibility === "hidden") setVisibility("after_match");
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: socialOpen, checked: socialOpen }}
              className={`rounded-2xl border p-4 ${socialOpen ? "border-brand bg-brand/10" : "border-border bg-surface"}`}
            >
              <View className="flex-row items-center">
                <AppIcon name="users" color={socialOpen ? "#E0523F" : "#6B5D55"} size={24} />
                <Text className="ml-3 flex-1 font-bold text-text-primary">
                  {t("ownerConnection.openTitle")}
                </Text>
                {socialOpen ? (
                  <AppIcon name="circle-check" color="#E0523F" size={20} />
                ) : null}
              </View>
              <Text className="mt-2 text-xs leading-5 text-text-secondary">
                {t("ownerConnection.openDetail")}
              </Text>
              {/*
                Ön koşullar SEÇİM ANINDA söyleniyor.
                Öncesinde kullanıcı bu seçeneği işaretliyor, formu
                dolduruyor, en altta "Kaydet"e basıyor ve ancak orada
                "önce ad + fotoğraf + herkese açık profil gerekiyor"
                hatasını görüyordu — eksiğin ne olduğu da tek bir cümlede
                toplu haldeydi. Eksik olan kalemler burada tek tek ve
                seçenek görünürken duruyor.
              */}
              {socialOpen && missingConnectionRequirements.length > 0 ? (
                <View className="mt-3 gap-1 rounded-xl bg-bg-secondary p-3">
                  <Text className="text-[11px] font-bold text-text-primary">
                    Açık kalması için gerekenler
                  </Text>
                  {missingConnectionRequirements.map((requirement) => (
                    <View key={requirement} className="flex-row items-center gap-1.5">
                      <AppIcon name="circle" color="#9A8B82" size={11} />
                      <Text className="text-[11px] text-text-secondary">{requirement}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </AppPressable>

            {/*
              FİLTRELEMEYEN, opsiyonel bir sinyal — havuzu bölmeden retention
              sorununu (eşleşme sonrası "bu kişi ne bekliyor" belirsizliği)
              hafifletir. Serbest metin değil, sabit taksonomi: moderasyon
              yükü istemiyoruz (`0066`).
            */}
            {socialOpen ? (
              <View className="mt-1 rounded-xl border border-border bg-surface p-3.5">
                <Text className="text-xs font-bold text-text-primary">
                  {t("ownerConnection.tagTitle")}
                </Text>
                <Text className="mt-1 text-[11px] leading-4 text-text-tertiary">
                  {t("ownerConnection.tagDetail")}
                </Text>
                <View className="mt-2.5 flex-row flex-wrap gap-2">
                  {CONNECTION_TAGS.map((tag) => {
                    const active = connectionTag === tag;
                    const label =
                      tag === "new_friends"
                        ? t("ownerConnection.tagNewFriends")
                        : tag === "open_minded"
                          ? t("ownerConnection.tagOpenMinded")
                          : t("ownerConnection.tagNotSureYet");
                    return (
                      <AppPressable
                        key={tag}
                        onPress={() => setConnectionTag(active ? null : tag)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ selected: active, checked: active }}
                        className={`min-h-9 justify-center rounded-full border px-3.5 ${
                          active ? "border-accent bg-accent/10" : "border-border bg-bg-secondary"
                        }`}
                      >
                        <Text
                          className={`text-xs font-semibold ${active ? "text-accent-dark" : "text-text-secondary"}`}
                        >
                          {label}
                        </Text>
                      </AppPressable>
                    );
                  })}
                </View>
              </View>
            ) : null}
          </View>

          <SectionTitle>Sahip + pet doğrulaması</SectionTitle>
          <View className="mb-6 rounded-2xl border border-border bg-surface p-4">
            <View className="flex-row items-center">
              <View className={`h-11 w-11 items-center justify-center rounded-full ${
                verificationStatus === "approved" ? "bg-accent/10" : "bg-bg-secondary"
              }`}>
                <AppIcon
                  // Ionicons'ta bu ayrım dolu/outline ile yapılıyordu. Lucide'da
                  // `shield-check`'i doldurmak içindeki çeki görünmez yapar; ayrım
                  // şekil düzeyine taşındı: onaylıysa çekli kalkan, değilse düz.
                  name={verificationStatus === "approved" ? "shield-check" : "shield"}
                  color={verificationStatus === "approved" ? "#2FB8A6" : "#9A8B82"}
                  size={24}
                />
              </View>
              <View className="ml-3 flex-1">
                <Text className="font-bold text-text-primary">
                  {verificationStatus === "approved"
                    ? "Doğrulanmış sahip"
                    : verificationStatus === "pending"
                      ? "İnceleme bekliyor"
                      : verificationStatus === "rejected"
                        ? "Yeniden doğrulama gerekli"
                        : "Henüz doğrulanmadı"}
                </Text>
                <Text className="mt-1 text-xs leading-4 text-text-secondary">
                  Profil galerisinden ayrı, birlikte çekilmiş bir kare. Sen ve aktif petin aynı karede, yüzlerin net görünsün. Bu fotoğraf profilde yayınlanmaz; yalnızca inceleme içindir.
                </Text>
                {verificationStatus === "rejected" &&
                profile.data.verificationReviewNote ? (
                  <View className="mt-3 rounded-xl bg-danger/5 p-3">
                    {profile.data.verificationReview?.reasonCode ? (
                      <Text className="text-xs font-bold leading-4 text-danger">
                        {verificationReasonLabels[profile.data.verificationReview.reasonCode] ?? "Başvuru koşulları karşılanmadı"}
                      </Text>
                    ) : null}
                    <Text className="mt-1 text-xs leading-4 text-text-secondary">
                      {profile.data.verificationReviewNote}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>

            {verificationStatus !== "approved" &&
            verificationStatus !== "pending" &&
            !verificationExpanded ? (
              <AppPressable
                onPress={() => setVerificationExpanded(true)}
                accessibilityRole="button"
                className="mt-4 min-h-11 items-center justify-center rounded-xl border border-accent bg-accent/5 px-4"
              >
                <Text className="font-semibold text-accent-dark">Doğrulamayı başlat</Text>
              </AppPressable>
            ) : null}

            {verificationStatus !== "approved" &&
            verificationStatus !== "pending" &&
            verificationExpanded ? (
              <>
                <View className="mt-4 rounded-xl bg-bg-secondary p-3">
                  {[
                    "Yüzün ve aktif petin net biçimde aynı karede olsun.",
                    "İyi ışık kullan; filtre, ekran görüntüsü veya eski fotoğraf kullanma.",
                    "Kimlik belgesi ya da başka bir kişinin yüzünü kadraja alma.",
                    "Fotoğraf yalnız moderasyon için kullanılır ve karardan sonra silinir.",
                  ].map((item) => (
                    <View key={item} className="mb-2 flex-row items-start last:mb-0">
                      <AppIcon name="circle-check" color="#2FB8A6" size={17} />
                      <Text className="ml-2 flex-1 text-xs leading-4 text-text-secondary">
                        {item}
                      </Text>
                    </View>
                  ))}
                </View>
                {verificationPhoto ? (
                  <Image
                    source={verificationPhoto.uri}
                    contentFit="cover"
                    style={{ width: "100%", aspectRatio: 1.4, borderRadius: 14, marginTop: 16 }}
                  />
                ) : null}
                <AppPressable
                  onPress={takeVerificationPhoto}
                  disabled={verificationBusy}
                  className="mt-4 items-center rounded-xl border border-accent bg-accent/5 py-3 disabled:opacity-50"
                >
                  <Text className="font-semibold text-accent-dark">
                    {verificationPhoto ? "Fotoğrafı yeniden çek" : "Birlikte fotoğraf çek"}
                  </Text>
                </AppPressable>
                {verificationPhoto ? (
                  <>
                    <AppPressable
                      onPress={() => setVerificationAcknowledged((value) => !value)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: verificationAcknowledged }}
                      className="mt-3 min-h-11 flex-row items-center"
                    >
                      <AppIcon
                        name={verificationAcknowledged ? "square-check-big" : "square"}
                        color={verificationAcknowledged ? "#2FB8A6" : "#9A8B82"}
                        size={24}
                      />
                      <Text className="ml-2 flex-1 text-xs leading-4 text-text-secondary">
                        Fotoğrafın bu başvuruyu incelemek için kullanılacağını ve karar sonrası silineceğini anlıyorum.
                      </Text>
                    </AppPressable>
                    <AppPressable
                      onPress={submitVerification}
                      disabled={verificationBusy || !verificationAcknowledged}
                      className="mt-2 min-h-11 items-center justify-center rounded-xl bg-accent py-3 disabled:opacity-50"
                    >
                      {verificationBusy ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text className="font-bold text-white">Doğrulamaya gönder</Text>
                      )}
                    </AppPressable>
                  </>
                ) : null}
                <AppPressable
                  onPress={() => {
                    setVerificationExpanded(false);
                    setVerificationPhoto(null);
                    setVerificationAcknowledged(false);
                  }}
                  accessibilityRole="button"
                  className="mt-3 min-h-11 items-center justify-center"
                >
                  <Text className="text-sm font-semibold text-text-secondary">Şimdilik kapat</Text>
                </AppPressable>
              </>
            ) : null}
            {verificationStatus === "approved" ? (
              <View className="mt-3 flex-row items-start rounded-xl bg-accent/5 p-3">
                <AppIcon name="info" color="#1E9384" size={18} />
                <Text className="ml-2 flex-1 text-xs leading-4 text-text-secondary">
                  Rozet, birlikte çektiğin doğrulama fotoğrafına bağlı. Profil galerisini değiştirmek rozeti düşürmez.
                </Text>
              </View>
            ) : null}
            {verificationStatus === "rejected" && profile.data.verificationReview ? (
              profile.data.verificationReview.appealText ? (
                <View className="mt-3 rounded-xl bg-bg-secondary p-3">
                  <Text className="text-xs font-bold text-text-primary">İtirazın alındı</Text>
                  <Text className="mt-1 text-xs leading-4 text-text-secondary">
                    {profile.data.verificationReview.appealText}
                  </Text>
                </View>
              ) : (
                <View className="mt-3">
                  <TextInput
                    value={appealText}
                    onChangeText={setAppealText}
                    placeholder="Karara neden itiraz ettiğini açıkla"
                    placeholderTextColor="#9A8B82"
                    multiline
                    maxLength={1000}
                    className="min-h-24 rounded-xl border border-border bg-bg-primary px-3 py-3 text-text-primary"
                  />
                  <AppPressable
                    onPress={() => void submitAppeal()}
                    disabled={appealBusy || appealText.trim().length < 10}
                    className="mt-2 min-h-11 items-center justify-center rounded-xl border border-brand px-4 disabled:opacity-40"
                  >
                    {appealBusy ? <ActivityIndicator color="#F97362" /> : <Text className="font-semibold text-brand-dark">Karara itiraz et</Text>}
                  </AppPressable>
                </View>
              )
            ) : null}
          </View>

        </ScrollView>

        {/*
          Sonuç mesajları kaydet şeridinin YANINDA. Öncesinde kaydet
          düğmesiyle birlikte sayfanın en altındaydı; kullanıcı kaydettikten
          sonra klavye kapanınca ekran kayıyor ve mesaj çoğu zaman
          görünmüyordu. Başarı mesajı kendiliğinden kayboluyor, hata
          kalıyor (biri bildirim, diğeri görev).
        */}
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
              disabled={busy || verificationBusy || !isAdultDate(birthDate)}
              accessibilityRole="button"
              className="min-h-[50px] flex-[2] items-center justify-center rounded-xl bg-brand disabled:opacity-50"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-bold text-white">Kaydet</Text>
              )}
            </AppPressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
