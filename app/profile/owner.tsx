import { useEffect, useState } from "react";
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
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppIcon } from "../../components/ui/icon";

import {
  loadEditableProfile,
  saveOwnerProfile,
  submitOwnerVerification,
  submitVerificationAppeal,
  type LocalProfilePhoto,
} from "../../core/api/profile";
import { BirthDateField } from "../../components/birth-date-field";
import { isAdultDate } from "../../core/domain/date-validation";
import { ownerInterestLabels } from "../../core/domain/labels";
import { OWNER_INTERESTS, type OwnerInterest, type OwnerVisibility } from "../../core/domain/types";
import { useTranslation } from "../../core/i18n";
import { ensureImageLibraryAccess } from "../../core/media/image-library";
import { useAuthStore } from "../../stores/auth";
import { errorMessage } from "../../core/domain/error-message";
import { OwnerVisibilityPreview } from "../../components/owner-visibility-preview";
import { AppPressable } from "../../components/ui/pressable";
import { SectionTitle } from "../../components/ui/section";
import { ProfileFormSkeleton } from "../../components/ui/skeleton";
import { successHaptic } from "../../core/ui/haptics";

type AvatarState =
  | { kind: "remote"; storagePath: string; uri: string }
  | ({ kind: "local" } & LocalProfilePhoto)
  | null;

const visibilityOptions: {
  value: OwnerVisibility;
  label: string;
  detail: string;
}[] = [
  { value: "hidden", label: "Gizli", detail: "Keşfette yalnızca petin görünür." },
  {
    value: "after_match",
    label: "Eşleşince",
    detail: "Sahip bilgilerin yalnızca eşleşmeden sonra açılır.",
  },
  {
    value: "public",
    label: "Keşfette görünür",
    detail: "Fotoğrafın ve kısa profilin pet kartında gösterilir.",
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
  value: "female" | "male" | "other" | null;
  label: string;
}[] = [
  { value: null, label: "Belirtmek istemiyorum" },
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
  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => loadEditableProfile(user!.id),
    enabled: Boolean(user),
  });

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"female" | "male" | "other" | null>(null);
  const [visibility, setVisibility] = useState<OwnerVisibility>("after_match");
  const [socialOpen, setSocialOpen] = useState(false);
  const [interests, setInterests] = useState<OwnerInterest[]>([]);
  const [avatar, setAvatar] = useState<AvatarState>(null);
  const [verificationPhoto, setVerificationPhoto] =
    useState<LocalProfilePhoto | null>(null);
  const [verificationAcknowledged, setVerificationAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
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
    setInterests(profile.data.ownerInterests);
    setAvatar(
      profile.data.ownerAvatar
        ? {
            kind: "remote",
            storagePath: profile.data.ownerAvatar.storagePath,
            uri: profile.data.ownerAvatar.url,
          }
        : null,
    );
  }, [profile.data]);

  /* Başarı mesajı kendiliğinden kaybolur, hata kalır (bkz. profil ekranı). */
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);

  const pickAvatar = async () => {
    setError(null);
    if (!(await ensureImageLibraryAccess())) {
      setError("Sahip fotoğrafı seçmek için galeri izni gerekiyor.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (result.canceled) return;
    const photo = result.assets[0];
    setAvatar({
      kind: "local",
      uri: photo.uri,
      fileName: photo.fileName ?? null,
      mimeType: photo.mimeType ?? null,
    });
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
   * "Tanışmaya açığım" seçeneğinin ön koşulları (bkz. docs/goal-model.md §2:
   * açık olması için ad + sahip fotoğrafı + `public` görünürlük zorunlu).
   * Kaydetme anında tek bir hata cümlesi yerine, seçenek görünürken
   * eksik kalemler tek tek gösteriliyor.
   */
  const missingConnectionRequirements = [
    displayName.trim() ? null : "Adın",
    avatar ? null : "Sahip fotoğrafın",
    visibility === "public" ? null : "Görünürlük: herkese açık",
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

  const dirty =
    Boolean(profile.data) &&
    (displayName !== (profile.data!.displayName ?? "") ||
      bio !== (profile.data!.ownerBio ?? "") ||
      birthDate !== profile.data!.ownerBirthDate ||
      gender !== profile.data!.ownerGender ||
      visibility !== profile.data!.ownerVisibility ||
      socialOpen !== profile.data!.ownerSocialOpen ||
      !sameInterests ||
      avatar?.kind === "local" ||
      Boolean(profile.data!.ownerAvatar) !== Boolean(avatar) ||
      Boolean(verificationPhoto) ||
      verificationAcknowledged);

  const resetForm = () => {
    if (!profile.data) return;
    setDisplayName(profile.data.displayName ?? "");
    setBio(profile.data.ownerBio ?? "");
    setBirthDate(profile.data.ownerBirthDate);
    setGender(profile.data.ownerGender);
    setVisibility(profile.data.ownerVisibility);
    setSocialOpen(profile.data.ownerSocialOpen);
    setInterests(profile.data.ownerInterests);
    setAvatar(
      profile.data.ownerAvatar
        ? {
            kind: "remote",
            storagePath: profile.data.ownerAvatar.storagePath,
            uri: profile.data.ownerAvatar.url,
          }
        : null,
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
  const goBack = () => {
    if (!dirty) {
      router.back();
      return;
    }
    Alert.alert(
      "Kaydedilmemiş değişiklikler var",
      "Çıkarsan bu turdaki değişiklikler kaybolur.",
      [
        { text: "Düzenlemeye dön", style: "cancel" },
        { text: "Çık ve vazgeç", style: "destructive", onPress: () => router.back() },
      ],
    );
  };

  const save = async () => {
    if (!user || !profile.data) return;
    if (!isAdultDate(birthDate)) {
      setError("Geçerli bir doğum tarihi yazmalısın ve 18 yaşında olmalısın.");
      return;
    }
    if (socialOpen && (!displayName.trim() || !avatar || visibility !== "public")) {
      setError(t("ownerConnection.prerequisitesError"));
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await saveOwnerProfile({
        userId: user.id,
        displayName,
        bio,
        birthDate,
        gender,
        ownerVisibility: visibility,
        ownerSocialOpen: socialOpen,
        interests,
        previousAvatarPath: profile.data.ownerAvatar?.storagePath ?? null,
        avatar:
          avatar?.kind === "remote"
            ? { kind: "remote", storagePath: avatar.storagePath }
            : avatar,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["discovery"] }),
        // Keşfet'teki "Profilini tamamla" şeridi bu sorgudan besleniyor;
        // invalidate edilmezse kullanıcı eksiği DOLDURDUKTAN sonra bile
        // aynı sayıyı görüyordu (sekme ekranı mount kalıyor, `staleTime`
        // dolsa bile kendiliğinden tazelenmiyor).
        queryClient.invalidateQueries({ queryKey: ["profile-completion", user.id] }),
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
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-5 pb-12 pt-5"
        >
          <View className="mb-7 items-center">
            <AppPressable onPress={pickAvatar} disabled={busy} accessibilityLabel="Sahip fotoğrafını değiştir">
              {avatar ? (
                <Image source={avatar.uri} contentFit="cover" style={{ width: 124, height: 124, borderRadius: 62 }} />
              ) : (
                <View className="h-[124px] w-[124px] items-center justify-center rounded-full border border-dashed border-brand bg-brand/5">
                  <AppIcon name="user-plus" color="#F97362" size={38} />
                </View>
              )}
              <View className="absolute bottom-0 right-0 h-10 w-10 items-center justify-center rounded-full border-2 border-bg-primary bg-brand">
                <AppIcon name="camera" color="#FFFFFF" size={19} />
              </View>
            </AppPressable>
            <Text className="mt-3 text-sm font-bold text-text-primary">
              {avatar ? "Fotoğrafı değiştir" : "Sahip fotoğrafı ekle"}
            </Text>
            {avatar ? (
              <AppPressable
                onPress={() => {
                  setAvatar(null);
                  if (socialOpen) setSocialOpen(false);
                }}
                className="mt-2"
              >
                <Text className="text-xs font-semibold text-danger">Fotoğrafı kaldır</Text>
              </AppPressable>
            ) : null}
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
            helper="Kesin tarih gösterilmez; uygun durumda yalnızca “30’lu yaşlar” gibi bir aralık görünür."
          />

          <SectionTitle>Cinsiyet (opsiyonel)</SectionTitle>
          <View className="mb-6 flex-row flex-wrap gap-2">
            {genderOptions.map((option) => {
              const active = gender === option.value;
              return (
                <AppPressable
                  key={option.value ?? "none"}
                  onPress={() => setGender(option.value)}
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

          <SectionTitle>Profil görünürlüğü</SectionTitle>
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
                    if (option.value !== "public") setSocialOpen(false);
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
                    <Text
                      className={`font-semibold ${active ? "text-brand-dark" : "text-text-primary"}`}
                    >
                      {option.label}
                    </Text>
                    <Text className="mt-1 text-xs leading-4 text-text-secondary">
                      {option.detail}
                    </Text>
                  </View>
                </AppPressable>
              );
            })}
          </View>

          <OwnerVisibilityPreview
            visibility={visibility}
            petName={profile.data?.pet.name ?? "petin"}
            owner={{
              displayName: displayName.trim() || null,
              photoUrl: avatar?.uri ?? null,
              bio: bio.trim() || null,
              // Yaş/cinsiyet sunucuda karşılıklı açıklama kuralına bağlı;
              // önizleme onları taklit etmiyor, dipnotta açıklıyor.
              gender: null,
              ageBucket: null,
              socialOpen,
              verified: profile.data?.verificationStatus === "approved",
            }}
          />

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
                setVisibility("public");
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
                  Sen ve aktif petin aynı karede görünmeli. Başvurular genellikle 24 saat içinde incelenir.
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
                  Sahip fotoğrafını değiştirirsen rozet güvenlik nedeniyle kaldırılır ve yeniden doğrulama gerekir.
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
