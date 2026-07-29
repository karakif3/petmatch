import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import {
  loadEditableProfile,
  updateEditableProfile,
  updateNotificationPreferences,
} from "../../core/api/profile";
import { deleteAccount } from "../../core/api/safety";
import {
  registerForPushNotifications,
  unregisterCurrentPushToken,
} from "../../core/api/notifications";
import { coarsenCoordinates } from "../../core/domain/distance";
import type { Coordinates, OwnerVisibility } from "../../core/domain/types";
import { useAuthStore } from "../../stores/auth";

const visibilityOptions: {
  value: OwnerVisibility;
  label: string;
  detail: string;
}[] = [
  { value: "hidden", label: "Gizli", detail: "Yalnızca petin görünür" },
  { value: "after_match", label: "Eşleşince", detail: "Adın eşleşmeden sonra görünür" },
  { value: "public", label: "Herkese açık", detail: "Adın keşfet aşamasında görünür" },
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

function NotificationToggle({
  label,
  detail,
  value,
  onValueChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <View className="flex-row items-center py-3">
      <View className="mr-4 flex-1">
        <Text className="font-semibold text-text-primary">{label}</Text>
        <Text className="mt-1 text-xs leading-4 text-text-secondary">{detail}</Text>
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

export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => loadEditableProfile(user!.id),
    enabled: Boolean(user),
  });

  const [displayName, setDisplayName] = useState("");
  const [petName, setPetName] = useState("");
  const [city, setCity] = useState("");
  const [ownerVisibility, setOwnerVisibility] =
    useState<OwnerVisibility>("after_match");
  const [notifyOnMatch, setNotifyOnMatch] = useState(true);
  const [notifyOnMessage, setNotifyOnMessage] = useState(true);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.displayName ?? "");
    setPetName(profile.data.pet.name);
    setCity(profile.data.city);
    setOwnerVisibility(profile.data.ownerVisibility);
    setNotifyOnMatch(profile.data.notifications.onMatch);
    setNotifyOnMessage(profile.data.notifications.onMessage);
    setCoordinates(null);
  }, [profile.data]);

  const refreshLocation = async () => {
    setLocationBusy(true);
    setError(null);
    setNotice(null);
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
      setNotice("Yeni yaklaşık konum alındı. Uygulamak için değişiklikleri kaydet.");
    } catch (locationError) {
      setError(
        locationError instanceof Error ? locationError.message : "Konum alınamadı.",
      );
    } finally {
      setLocationBusy(false);
    }
  };

  const save = async () => {
    setSaveBusy(true);
    setError(null);
    setNotice(null);
    try {
      await Promise.all([
        updateEditableProfile({
          displayName,
          petName,
          city,
          ownerVisibility,
          coordinates,
        }),
        updateNotificationPreferences({
          onMatch: notifyOnMatch,
          onMessage: notifyOnMessage,
        }),
      ]);

      let notificationMessage = "";
      try {
        if (notifyOnMatch || notifyOnMessage) {
          const registration = await registerForPushNotifications();
          notificationMessage = ` ${registration.message}`;
        } else {
          await unregisterCurrentPushToken();
          notificationMessage = " Bu cihaz için bildirimler kapatıldı.";
        }
      } catch (notificationError) {
        setError(
          notificationError instanceof Error
            ? notificationError.message
            : "Bildirim ayarı cihaza uygulanamadı.",
        );
      }

      setCoordinates(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["discovery", user?.id] }),
      ]);
      setNotice(`Profilin güncellendi.${notificationMessage}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Profil güncellenemedi.");
    } finally {
      setSaveBusy(false);
    }
  };

  const removeAccount = async () => {
    setDeleteBusy(true);
    setError(null);
    setNotice(null);
    try {
      await deleteAccount();
      queryClient.clear();
      await signOut();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Hesap silinemedi.",
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const confirmAccountDeletion = () => {
    Alert.alert(
      "Hesabını silmek istiyor musun?",
      "Profilin, petlerin, fotoğrafların, eşleşmelerin ve mesajların kalıcı olarak silinir.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Devam et",
          style: "destructive",
          onPress: () =>
            Alert.alert(
              "Bu işlem geri alınamaz",
              "Hesabı ve tüm verileri şimdi kalıcı olarak sil?",
              [
                { text: "Vazgeç", style: "cancel" },
                {
                  text: "Hesabımı sil",
                  style: "destructive",
                  onPress: () => void removeAccount(),
                },
              ],
            ),
        },
      ],
    );
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
        <Ionicons name="cloud-offline-outline" color="#E5484D" size={46} />
        <Text className="mt-4 text-xl font-bold text-text-primary">Profil yüklenemedi</Text>
        <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
          {profile.error instanceof Error
            ? profile.error.message
            : "Bağlantını kontrol edip tekrar dene."}
        </Text>
        <Pressable
          onPress={() => profile.refetch()}
          className="mt-5 rounded-xl bg-brand px-5 py-3"
        >
          <Text className="font-semibold text-white">Tekrar dene</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-5 pb-10 pt-4"
          refreshControl={
            <RefreshControl
              refreshing={profile.isRefetching}
              onRefresh={() => profile.refetch()}
              tintColor="#F97362"
            />
          }
        >
          <Text className="text-2xl font-bold text-text-primary">Profil</Text>
          <Text className="mt-1 text-sm text-text-secondary">{user?.email ?? "—"}</Text>

          <View className="my-6 flex-row items-center rounded-2xl border border-border bg-surface p-4">
            {profile.data.pet.photoUrl ? (
              <Image
                source={profile.data.pet.photoUrl}
                contentFit="cover"
                style={{ width: 82, height: 82, borderRadius: 22 }}
              />
            ) : (
              <View className="h-[82px] w-[82px] items-center justify-center rounded-[22px] bg-bg-tertiary">
                <Ionicons name="paw" color="#C4B7AE" size={36} />
              </View>
            )}
            <View className="ml-4 flex-1">
              <Text className="text-xl font-bold text-text-primary">
                {profile.data.pet.name}
              </Text>
              <Text className="mt-1 text-sm text-text-secondary">
                {profile.data.pet.species === "dog" ? "Köpek" : "Kedi"} · Aktif profil
              </Text>
              <Pressable
                onPress={() => router.push("/profile/pet")}
                className="mt-3 self-start flex-row items-center rounded-lg bg-brand/10 px-3 py-2"
              >
                <Ionicons name="create-outline" color="#E0523F" size={16} />
                <Text className="ml-1.5 text-xs font-bold text-brand-dark">
                  Pet profilini düzenle
                </Text>
              </Pressable>
            </View>
          </View>

          <Text className="mb-4 text-lg font-bold text-text-primary">Temel bilgiler</Text>
          <Pressable
            onPress={() => router.push("/profile/owner")}
            className="mb-5 flex-row items-center rounded-2xl border border-border bg-surface p-4"
          >
            {profile.data.ownerAvatar ? (
              <Image
                source={profile.data.ownerAvatar.url}
                contentFit="cover"
                style={{ width: 58, height: 58, borderRadius: 29 }}
              />
            ) : (
              <View className="h-[58px] w-[58px] items-center justify-center rounded-full bg-bg-tertiary">
                <Ionicons name="person-outline" color="#9A8B82" size={26} />
              </View>
            )}
            <View className="ml-3 flex-1">
              <Text className="font-bold text-text-primary">Sahip profilini düzenle</Text>
              <Text className="mt-1 text-xs leading-4 text-text-secondary">
                Fotoğraf, bio, yaş/cinsiyet paylaşımı, tanışma amacı ve doğrulama
              </Text>
            </View>
            <Ionicons name="chevron-forward" color="#9A8B82" size={21} />
          </Pressable>
          <Field
            label="Senin adın (opsiyonel)"
            hint="Boş bırakırsan sahip adı karşı tarafa gösterilmez."
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Sana nasıl hitap edelim?"
            autoCapitalize="words"
            maxLength={60}
          />
          <Field
            label="Petinin adı"
            hint="Pet adı profil kartında her zaman görünür."
            value={petName}
            onChangeText={setPetName}
            placeholder="Örn. Luna"
            autoCapitalize="words"
            maxLength={40}
          />
          <Field
            label="Şehir"
            value={city}
            onChangeText={setCity}
            placeholder="Örn. İstanbul"
            autoCapitalize="words"
          />

          <Text className="mb-3 text-lg font-bold text-text-primary">Sahip görünürlüğü</Text>
          <View className="mb-6 gap-2">
            {visibilityOptions.map((option) => (
              <Pressable
                key={option.value}
                onPress={() => setOwnerVisibility(option.value)}
                className={`rounded-xl border px-4 py-3 ${
                  ownerVisibility === option.value
                    ? "border-brand bg-brand/10"
                    : "border-border bg-surface"
                }`}
              >
                <Text
                  className={`font-semibold ${
                    ownerVisibility === option.value
                      ? "text-brand-dark"
                      : "text-text-primary"
                  }`}
                >
                  {option.label}
                </Text>
                <Text className="mt-1 text-xs text-text-secondary">{option.detail}</Text>
              </Pressable>
            ))}
          </View>

          <Text className="mb-3 text-lg font-bold text-text-primary">Yaklaşık konum</Text>
          <View className="mb-6 rounded-2xl border border-border bg-surface p-4">
            <View className="flex-row items-center">
              <View className="h-11 w-11 items-center justify-center rounded-full bg-accent/10">
                <Ionicons name="location" color="#2FB8A6" size={22} />
              </View>
              <View className="ml-3 flex-1">
                <Text className="font-semibold text-text-primary">
                  {coordinates
                    ? "Yeni konum hazır"
                    : profile.data.pet.hasLocation
                      ? "Konum kayıtlı"
                      : "Konum eklenmedi"}
                </Text>
                <Text className="mt-1 text-xs leading-4 text-text-secondary">
                  Tam adres saklanmaz; koordinatlar yaklaşık 1 km’lik alana yuvarlanır.
                </Text>
              </View>
            </View>
            <Pressable
              onPress={refreshLocation}
              disabled={locationBusy || saveBusy}
              className="mt-4 items-center rounded-xl border border-accent bg-accent/5 py-3 disabled:opacity-50"
            >
              {locationBusy ? (
                <ActivityIndicator color="#2FB8A6" />
              ) : (
                <Text className="font-semibold text-accent-dark">
                  {profile.data.pet.hasLocation ? "Konumu yenile" : "Konumumu kullan"}
                </Text>
              )}
            </Pressable>
          </View>

          <Text className="mb-3 text-lg font-bold text-text-primary">Bildirimler</Text>
          <View className="mb-6 rounded-2xl border border-border bg-surface px-4 py-1">
            <NotificationToggle
              label="Yeni eşleşmeler"
              detail="Karşılıklı beğeni olduğunda haber ver."
              value={notifyOnMatch}
              onValueChange={setNotifyOnMatch}
            />
            <View className="h-px bg-border" />
            <NotificationToggle
              label="Yeni mesajlar"
              detail="Eşleşmelerinden yeni mesaj geldiğinde haber ver."
              value={notifyOnMessage}
              onValueChange={setNotifyOnMessage}
            />
            <Text className="pb-3 text-xs leading-4 text-text-tertiary">
              {Platform.OS === "web"
                ? "Cihaz izni iOS veya Android uygulamasında verilir."
                : "İlk etkinleştirmede cihazın bildirim izni istenir."}
            </Text>
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
            disabled={saveBusy || locationBusy || !petName.trim() || !city.trim()}
            className="items-center rounded-xl bg-brand py-4 disabled:opacity-50"
          >
            {saveBusy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="font-bold text-white">Değişiklikleri kaydet</Text>
            )}
          </Pressable>

          <Pressable
            onPress={signOut}
            disabled={saveBusy || deleteBusy}
            className="mt-8 items-center rounded-xl border border-border py-4"
          >
            <Text className="font-semibold text-danger">Çıkış yap</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/(auth)/legal")}
            className="mt-4 items-center rounded-xl border border-border py-4"
          >
            <Text className="font-semibold text-text-primary">Yasal ve gizlilik merkezi</Text>
          </Pressable>

          <View className="mt-8 rounded-2xl border border-danger/20 bg-danger/5 p-4">
            <Text className="font-bold text-danger">Hesabı sil</Text>
            <Text className="mt-2 text-xs leading-5 text-text-secondary">
              Hesabınla birlikte pet profilleri, fotoğraflar, eşleşmeler ve mesajlar
              kalıcı olarak kaldırılır.
            </Text>
            <Pressable
              onPress={confirmAccountDeletion}
              disabled={saveBusy || deleteBusy}
              className="mt-4 items-center rounded-xl border border-danger py-3 disabled:opacity-50"
            >
              {deleteBusy ? (
                <ActivityIndicator color="#E5484D" />
              ) : (
                <Text className="font-bold text-danger">Hesabımı kalıcı olarak sil</Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
