import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  loadEditableProfile,
  saveOwnerProfile,
  submitOwnerVerification,
  type LocalProfilePhoto,
} from "../../core/api/profile";
import { isAdultDate } from "../../core/domain/date-validation";
import type { OwnerVisibility } from "../../core/domain/types";
import { useTranslation } from "../../core/i18n";
import { useAuthStore } from "../../stores/auth";

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

const genderOptions: {
  value: "female" | "male" | "other" | null;
  label: string;
}[] = [
  { value: null, label: "Belirtmek istemiyorum" },
  { value: "female", label: "Kadın" },
  { value: "male", label: "Erkek" },
  { value: "other", label: "Diğer" },
];

function Field({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mb-5">
      <Text className="mb-2 text-sm font-semibold text-text-primary">{label}</Text>
      <TextInput
        placeholderTextColor="#9A8B82"
        className="rounded-xl border border-border bg-surface px-4 py-3.5 text-text-primary"
        {...props}
      />
      {hint ? <Text className="mt-2 text-xs leading-4 text-text-tertiary">{hint}</Text> : null}
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
  const [avatar, setAvatar] = useState<AvatarState>(null);
  const [verificationPhoto, setVerificationPhoto] =
    useState<LocalProfilePhoto | null>(null);
  const [verificationAcknowledged, setVerificationAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verificationBusy, setVerificationBusy] = useState(false);
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

  const pickAvatar = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Sahip fotoğrafı seçmek için galeri izni gerekiyor.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
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
        previousAvatarPath: profile.data.ownerAvatar?.storagePath ?? null,
        avatar:
          avatar?.kind === "remote"
            ? { kind: "remote", storagePath: avatar.storagePath }
            : avatar,
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", user.id] }),
        queryClient.invalidateQueries({ queryKey: ["discovery"] }),
      ]);
      await profile.refetch();
      setNotice("Sahip profilin güncellendi.");
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Sahip profili kaydedilemedi.",
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
      setNotice("Doğrulama fotoğrafın inceleme kuyruğuna alındı.");
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Doğrulama başvurusu gönderilemedi.",
      );
    } finally {
      setVerificationBusy(false);
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
          Sahip profili yüklenemedi
        </Text>
        <Pressable onPress={() => profile.refetch()} className="mt-5 rounded-xl bg-brand px-5 py-3">
          <Text className="font-semibold text-white">Tekrar dene</Text>
        </Pressable>
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
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Geri"
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <Ionicons name="chevron-back" color="#1F1A17" size={27} />
          </Pressable>
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
            <Pressable onPress={pickAvatar} disabled={busy} accessibilityLabel="Sahip fotoğrafını değiştir">
              {avatar ? (
                <Image source={avatar.uri} contentFit="cover" style={{ width: 124, height: 124, borderRadius: 62 }} />
              ) : (
                <View className="h-[124px] w-[124px] items-center justify-center rounded-full border border-dashed border-brand bg-brand/5">
                  <Ionicons name="person-add-outline" color="#F97362" size={38} />
                </View>
              )}
              <View className="absolute bottom-0 right-0 h-10 w-10 items-center justify-center rounded-full border-2 border-bg-primary bg-brand">
                <Ionicons name="camera" color="#FFFFFF" size={19} />
              </View>
            </Pressable>
            <Text className="mt-3 text-sm font-bold text-text-primary">
              {avatar ? "Fotoğrafı değiştir" : "Sahip fotoğrafı ekle"}
            </Text>
            {avatar ? (
              <Pressable
                onPress={() => {
                  setAvatar(null);
                  if (socialOpen) setSocialOpen(false);
                }}
                className="mt-2"
              >
                <Text className="text-xs font-semibold text-danger">Fotoğrafı kaldır</Text>
              </Pressable>
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
          <Text className="-mt-4 mb-5 text-right text-xs text-text-tertiary">{bio.length}/500</Text>
          <Field
            label="Doğum tarihin"
            value={birthDate}
            onChangeText={setBirthDate}
            placeholder="YYYY-AA-GG"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            hint="Kesin tarih gösterilmez; uygun durumda yalnızca “30’lu yaşlar” gibi bir aralık görünür."
          />

          <Text className="mb-3 text-lg font-bold text-text-primary">Cinsiyet (opsiyonel)</Text>
          <View className="mb-6 flex-row flex-wrap gap-2">
            {genderOptions.map((option) => {
              const active = gender === option.value;
              return (
                <Pressable
                  key={option.value ?? "none"}
                  onPress={() => setGender(option.value)}
                  className={`rounded-full border px-4 py-2.5 ${
                    active ? "border-brand bg-brand/10" : "border-border bg-surface"
                  }`}
                >
                  <Text className={`text-sm font-semibold ${active ? "text-brand-dark" : "text-text-secondary"}`}>
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text className="mb-3 text-lg font-bold text-text-primary">Profil görünürlüğü</Text>
          <View className="mb-7 gap-2">
            {visibilityOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => {
                  setVisibility(option.value);
                  if (option.value !== "public") setSocialOpen(false);
                }}
                className={`rounded-xl border px-4 py-3 ${
                  visibility === option.value ? "border-brand bg-brand/10" : "border-border bg-surface"
                }`}
              >
                <Text className={`font-semibold ${visibility === option.value ? "text-brand-dark" : "text-text-primary"}`}>
                  {option.label}
                </Text>
                <Text className="mt-1 text-xs leading-4 text-text-secondary">{option.detail}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="mb-3 text-lg font-bold text-text-primary">
            {t("ownerConnection.title")}
          </Text>
          <View className="mb-7 gap-2">
            <Pressable
              onPress={() => setSocialOpen(false)}
              className={`rounded-2xl border p-4 ${!socialOpen ? "border-accent bg-accent/10" : "border-border bg-surface"}`}
            >
              <View className="flex-row items-center">
                <Ionicons name="paw-outline" color={!socialOpen ? "#1E9384" : "#6B5D55"} size={24} />
                <Text className="ml-3 font-bold text-text-primary">
                  {t("ownerConnection.petOnlyTitle")}
                </Text>
              </View>
              <Text className="mt-2 text-xs leading-5 text-text-secondary">
                {t("ownerConnection.petOnlyDetail")}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                setSocialOpen(true);
                setVisibility("public");
              }}
              className={`rounded-2xl border p-4 ${socialOpen ? "border-brand bg-brand/10" : "border-border bg-surface"}`}
            >
              <View className="flex-row items-center">
                <Ionicons name="people-outline" color={socialOpen ? "#E0523F" : "#6B5D55"} size={24} />
                <Text className="ml-3 flex-1 font-bold text-text-primary">
                  {t("ownerConnection.openTitle")}
                </Text>
              </View>
              <Text className="mt-2 text-xs leading-5 text-text-secondary">
                {t("ownerConnection.openDetail")}
              </Text>
            </Pressable>
          </View>

          <Text className="mb-3 text-lg font-bold text-text-primary">Sahip + pet doğrulaması</Text>
          <View className="mb-6 rounded-2xl border border-border bg-surface p-4">
            <View className="flex-row items-center">
              <View className={`h-11 w-11 items-center justify-center rounded-full ${
                verificationStatus === "approved" ? "bg-accent/10" : "bg-bg-secondary"
              }`}>
                <Ionicons
                  name={verificationStatus === "approved" ? "shield-checkmark" : "shield-checkmark-outline"}
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
                  <Text className="mt-2 text-xs font-semibold leading-4 text-danger">
                    İnceleme notu: {profile.data.verificationReviewNote}
                  </Text>
                ) : null}
              </View>
            </View>

            {verificationStatus !== "approved" && verificationStatus !== "pending" ? (
              <>
                <View className="mt-4 rounded-xl bg-bg-secondary p-3">
                  {[
                    "Yüzün ve aktif petin net biçimde aynı karede olsun.",
                    "İyi ışık kullan; filtre, ekran görüntüsü veya eski fotoğraf kullanma.",
                    "Kimlik belgesi ya da başka bir kişinin yüzünü kadraja alma.",
                    "Fotoğraf yalnız moderasyon için kullanılır ve karardan sonra silinir.",
                  ].map((item) => (
                    <View key={item} className="mb-2 flex-row items-start last:mb-0">
                      <Ionicons name="checkmark-circle" color="#2FB8A6" size={17} />
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
                <Pressable
                  onPress={takeVerificationPhoto}
                  disabled={verificationBusy}
                  className="mt-4 items-center rounded-xl border border-accent bg-accent/5 py-3 disabled:opacity-50"
                >
                  <Text className="font-semibold text-accent-dark">
                    {verificationPhoto ? "Fotoğrafı yeniden çek" : "Birlikte fotoğraf çek"}
                  </Text>
                </Pressable>
                {verificationPhoto ? (
                  <>
                    <Pressable
                      onPress={() => setVerificationAcknowledged((value) => !value)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: verificationAcknowledged }}
                      className="mt-3 min-h-11 flex-row items-center"
                    >
                      <Ionicons
                        name={verificationAcknowledged ? "checkbox" : "square-outline"}
                        color={verificationAcknowledged ? "#2FB8A6" : "#9A8B82"}
                        size={24}
                      />
                      <Text className="ml-2 flex-1 text-xs leading-4 text-text-secondary">
                        Fotoğrafın bu başvuruyu incelemek için kullanılacağını ve karar sonrası silineceğini anlıyorum.
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={submitVerification}
                      disabled={verificationBusy || !verificationAcknowledged}
                      className="mt-2 min-h-11 items-center justify-center rounded-xl bg-accent py-3 disabled:opacity-50"
                    >
                      {verificationBusy ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <Text className="font-bold text-white">Doğrulamaya gönder</Text>
                      )}
                    </Pressable>
                  </>
                ) : null}
              </>
            ) : null}
            {verificationStatus === "approved" ? (
              <View className="mt-3 flex-row items-start rounded-xl bg-accent/5 p-3">
                <Ionicons name="information-circle-outline" color="#1E9384" size={18} />
                <Text className="ml-2 flex-1 text-xs leading-4 text-text-secondary">
                  Sahip fotoğrafını değiştirirsen rozet güvenlik nedeniyle kaldırılır ve yeniden doğrulama gerekir.
                </Text>
              </View>
            ) : null}
          </View>

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
            disabled={busy || verificationBusy}
            className="items-center rounded-xl bg-brand py-4 disabled:opacity-50"
          >
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-bold text-white">Sahip profilini kaydet</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
