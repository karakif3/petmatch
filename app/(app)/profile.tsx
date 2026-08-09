import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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
import * as Location from "expo-location";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import { ProfilePreviewModal } from "../../components/profile-preview-modal";
import { AppPressable } from "../../components/ui/pressable";
import { Row, RowSeparator, SectionCard, SectionTitle } from "../../components/ui/section";
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
import { errorMessage } from "../../core/domain/error-message";
import { warningHaptic } from "../../core/ui/haptics";

/**
 * Görünürlük ARTIK BURADA DÜZENLENMİYOR — yalnızca değeri gösteriliyor.
 *
 * Aynı ayarın üç ayrı düzenleyicisi vardı: bu ekrandaki radyo listesi,
 * sahip profili ekranı ve Keşfet başlığındaki hızlı anahtar. Üçü de aynı
 * kolonu (`profiles.owner_visibility`) yazıyordu; hangisinin en güncel
 * olduğu kullanıcı için belirsizdi ve iki ekran aynı anda açıkken son
 * kaydeden diğerini eziyordu. Tek düzenleme yeri sahip profili (ayar
 * sahibin kendisiyle ilgili), tek hızlı anahtar Keşfet (sonucun görüldüğü
 * yer); burası yalnızca durumu gösterip oraya götürüyor.
 */
const visibilityLabels: Record<OwnerVisibility, string> = {
  hidden: "Gizli",
  after_match: "Eşleşince görünür",
  public: "Herkese açık",
};

/**
 * Kart İÇİNDE bir alan satırı — kendi kenarlığı yok.
 *
 * Öncesinde her input kendi çerçevesindeydi ve alanlar arasında 20 pt
 * boşluk vardı; üç alan üç ayrı kutu gibi duruyordu. Artık tek kartın
 * içinde saç teli ayırıcılarla ayrılmış satırlar (iOS ayar dili).
 *
 * `accessibilityLabel` şart: React Native etiketi otomatik olarak input'a
 * BAĞLAMIYOR — ekran okuyucu bugüne kadar bu alanları "metin alanı" diye
 * okuyup adını hiç söylemiyordu.
 */
function FieldRow({
  label,
  hint,
  ...props
}: { label: string; hint?: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="px-4 py-3">
      <Text className="text-xs font-semibold text-text-tertiary">{label}</Text>
      <TextInput
        placeholderTextColor="#B9A99F"
        accessibilityLabel={label}
        className="mt-1 p-0 text-[16px] text-text-primary"
        {...props}
      />
      {hint ? <Text className="mt-1.5 text-xs leading-4 text-text-tertiary">{hint}</Text> : null}
    </View>
  );
}

function NotificationToggle({
  icon,
  label,
  detail,
  value,
  onValueChange,
}: {
  icon: "heart" | "chatbubble-ellipses";
  label: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
}) {
  return (
    <Row
      icon={icon}
      iconColor="#E0523F"
      iconBackground="bg-brand/10"
      title={label}
      detail={detail}
      // Satırın TAMAMI anahtarı çeviriyor: önceden yalnızca ~50×30 pt'lik
      // `Switch` dokunulabilirdi, satırın geri kalanı ölüydü.
      onPress={() => onValueChange(!value)}
      accessory={
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: "#E8DDD5", true: "#F97362" }}
          thumbColor={value ? "#F97362" : "#FFFFFF"}
        />
      }
    />
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
  const [notifyOnMatch, setNotifyOnMatch] = useState(true);
  const [notifyOnMessage, setNotifyOnMessage] = useState(true);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [locationBusy, setLocationBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [notificationError, setNotificationError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Kaydet düğmesi önceden formun en altındaydı, her zaman aynı görünümde —
  // kullanıcı bir şey değiştirip değiştirmediğini, kaydedip kaydetmediğini
  // bilmiyordu. Kirli-durum karşılaştırması yalnızca yüklenmiş veriye göre
  // anlamlı; veri gelmeden `false` kalır.
  const dirty =
    Boolean(profile.data) &&
    (displayName !== (profile.data!.displayName ?? "") ||
      petName !== profile.data!.pet.name ||
      city !== profile.data!.city ||
      notifyOnMatch !== profile.data!.notifications.onMatch ||
      notifyOnMessage !== profile.data!.notifications.onMessage ||
      coordinates !== null);

  useEffect(() => {
    if (!profile.data) return;
    setDisplayName(profile.data.displayName ?? "");
    setPetName(profile.data.pet.name);
    setCity(profile.data.city);
    setNotifyOnMatch(profile.data.notifications.onMatch);
    setNotifyOnMessage(profile.data.notifications.onMessage);
    setCoordinates(null);
  }, [profile.data]);

  /*
   * Başarı mesajı kendiliğinden kayboluyor, hata KALIYOR.
   * Gerekçe: "Profilin güncellendi" bir bildirim, kullanıcı okuduktan
   * sonra ekranın altını kaplamaya devam etmesinin bir değeri yok. Hata
   * ise bir görev — kullanıcı bir şey yapana kadar durmalı.
   */
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(null), 5000);
    return () => clearTimeout(timeout);
  }, [notice]);

  /** Kirli formu sunucudaki son hâline döndürür (kaydet şeridindeki "Vazgeç"). */
  const discardChanges = () => {
    if (!profile.data) return;
    setDisplayName(profile.data.displayName ?? "");
    setPetName(profile.data.pet.name);
    setCity(profile.data.city);
    setNotifyOnMatch(profile.data.notifications.onMatch);
    setNotifyOnMessage(profile.data.notifications.onMessage);
    setCoordinates(null);
    setError(null);
    setNotice(null);
    setLocationError(null);
  };

  const refreshLocation = async () => {
    setLocationBusy(true);
    setLocationError(null);
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
      setLocationError(
        errorMessage(locationError, "Konum alınamadı."),
      );
    } finally {
      setLocationBusy(false);
    }
  };

  const save = async () => {
    setSaveBusy(true);
    setError(null);
    setLocationError(null);
    setNotificationError(null);
    setNotice(null);
    try {
      await Promise.all([
        updateEditableProfile({
          displayName,
          petName,
          city,
          // Bu ekran görünürlüğü DÜZENLEMİYOR (bkz. `visibilityLabels`);
          // sunucudaki mevcut değer olduğu gibi geri gönderiliyor, yoksa
          // RPC zorunlu parametreyi alamaz.
          ownerVisibility: profile.data!.ownerVisibility,
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
        setNotificationError(
          errorMessage(notificationError, "Bildirim ayarı cihaza uygulanamadı."),
        );
      }

      setCoordinates(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["profile", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["discovery", user?.id] }),
      ]);
      setNotice(`Profilin güncellendi.${notificationMessage}`);
    } catch (saveError) {
      setError(errorMessage(saveError, "Profil güncellenemedi."));
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
        errorMessage(deleteError, "Hesap silinemedi."),
      );
    } finally {
      setDeleteBusy(false);
    }
  };

  const confirmAccountDeletion = () => {
    warningHaptic();
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
          {errorMessage(profile.error, "Bağlantını kontrol edip tekrar dene.")}
        </Text>
        <AppPressable
          onPress={() => profile.refetch()}
          className="mt-5 rounded-xl bg-brand px-5 py-3"
        >
          <Text className="font-semibold text-white">Tekrar dene</Text>
        </AppPressable>
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
          contentContainerClassName={dirty ? "px-5 pb-28 pt-4" : "px-5 pb-10 pt-4"}
          refreshControl={
            <RefreshControl
              refreshing={profile.isRefetching}
              onRefresh={() => profile.refetch()}
              tintColor="#F97362"
            />
          }
        >
          <Text className="text-2xl font-bold text-text-primary">Profil</Text>

          {/*
            KİMLİK KARTI — ekranın tepesinde tek bir "sen ve petin" bloğu.
            Öncesinde pet kartı, sahip satırı ve e-posta ekranın üç ayrı
            yerine dağılmıştı; kullanıcı "bu ekran kimin?" sorusunu tek
            bakışta cevaplayamıyordu. İki avatar üst üste binerek ikisinin
            bir çift olduğunu söylüyor.
          */}
          <View className="mt-5 items-center">
            <View className="flex-row items-end">
              {profile.data.pet.photoUrl ? (
                <Image
                  source={profile.data.pet.photoUrl}
                  contentFit="cover"
                  style={{ width: 92, height: 92, borderRadius: 46 }}
                />
              ) : (
                <View className="h-[92px] w-[92px] items-center justify-center rounded-full bg-bg-tertiary">
                  <Ionicons name="paw" color="#C4B7AE" size={38} />
                </View>
              )}
              <View className="-ml-5">
                {profile.data.ownerAvatar ? (
                  <Image
                    source={profile.data.ownerAvatar.url}
                    contentFit="cover"
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 23,
                      borderWidth: 3,
                      borderColor: "#FFFBF7",
                    }}
                  />
                ) : (
                  <View className="h-[46px] w-[46px] items-center justify-center rounded-full border-[3px] border-bg-primary bg-bg-tertiary">
                    <Ionicons name="person" color="#B9A99F" size={20} />
                  </View>
                )}
              </View>
            </View>
            <Text className="mt-3 text-[22px] font-bold text-text-primary">
              {profile.data.pet.name}
            </Text>
            <Text className="mt-0.5 text-[13px] text-text-secondary">
              {profile.data.pet.species === "dog" ? "Köpek" : "Kedi"}
              {profile.data.displayName ? ` · ${profile.data.displayName}` : ""}
            </Text>

            <AppPressable
              onPress={() => setPreviewVisible(true)}
              accessibilityRole="button"
              accessibilityHint="Kartını karşı tarafın gördüğü haliyle açar"
              className="mt-4 flex-row items-center rounded-full border border-brand/30 bg-brand/5 px-5 py-2.5"
            >
              <Ionicons name="eye-outline" color="#E0523F" size={17} />
              <Text className="ml-2 text-[13px] font-bold text-brand-dark">
                Profilimi önizle
              </Text>
            </AppPressable>
          </View>

          <View className="mt-7">
            <SectionTitle>Profiller</SectionTitle>
            <SectionCard>
              <Row
                icon="paw"
                iconColor="#E0523F"
                iconBackground="bg-brand/10"
                title="Pet profili"
                detail="Irk, yaş, boyut, enerji, mizaç, fotoğraflar"
                onPress={() => router.push("/profile/pet")}
              />
              <RowSeparator />
              <Row
                icon="person"
                iconColor="#1E9384"
                iconBackground="bg-accent/10"
                title="Sahip profili"
                detail="Fotoğraf, bio, yaş/cinsiyet paylaşımı, tanışma amacı"
                onPress={() => router.push("/profile/owner")}
              />
              <RowSeparator />
              {/*
                Görünürlük burada YALNIZCA GÖSTERİLİYOR; düzenleme sahip
                profilinde. Gerekçe `visibilityLabels`'ın üstünde.
              */}
              <Row
                icon="eye"
                iconColor="#1E9384"
                iconBackground="bg-accent/10"
                title="Sahip görünürlüğü"
                value={visibilityLabels[profile.data.ownerVisibility]}
                onPress={() => router.push("/profile/owner")}
                accessibilityHint="Sahip profilinde değiştirilir"
              />
            </SectionCard>
          </View>

          <SectionTitle>Temel bilgiler</SectionTitle>
          <SectionCard>
            <FieldRow
              label="Senin adın (opsiyonel)"
              hint="Boş bırakırsan sahip adı karşı tarafa gösterilmez."
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Sana nasıl hitap edelim?"
              autoCapitalize="words"
              maxLength={60}
              returnKeyType="next"
            />
            <RowSeparator inset={false} />
            <FieldRow
              label="Petinin adı"
              hint="Pet adı profil kartında her zaman görünür."
              value={petName}
              onChangeText={setPetName}
              placeholder="Örn. Luna"
              autoCapitalize="words"
              maxLength={40}
              returnKeyType="next"
            />
            <RowSeparator inset={false} />
            <FieldRow
              label="Şehir"
              value={city}
              onChangeText={setCity}
              placeholder="Örn. İstanbul"
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
            />
          </SectionCard>

          <SectionTitle>Yaklaşık konum</SectionTitle>
          <SectionCard>
            <Row
              icon="location"
              iconColor="#1E9384"
              iconBackground="bg-accent/10"
              title={
                coordinates
                  ? "Yeni konum hazır"
                  : profile.data.pet.hasLocation
                    ? "Konum kayıtlı"
                    : "Konum eklenmedi"
              }
              detail="Tam adres saklanmaz; koordinatlar yaklaşık 1 km’lik alana yuvarlanır."
            />
            <RowSeparator inset={false} />
            <AppPressable
              onPress={refreshLocation}
              disabled={locationBusy || saveBusy}
              accessibilityRole="button"
              className="min-h-[52px] items-center justify-center disabled:opacity-50"
            >
              {locationBusy ? (
                <ActivityIndicator color="#2FB8A6" />
              ) : (
                <Text className="text-[15px] font-semibold text-accent-dark">
                  {profile.data.pet.hasLocation ? "Konumu yenile" : "Konumumu kullan"}
                </Text>
              )}
            </AppPressable>
            {locationError ? (
              <>
                <RowSeparator inset={false} />
                <Text className="px-4 py-3 text-xs font-semibold text-danger">
                  {locationError}
                </Text>
              </>
            ) : null}
          </SectionCard>

          <SectionTitle>Bildirimler</SectionTitle>
          <SectionCard>
            <NotificationToggle
              icon="heart"
              label="Yeni eşleşmeler"
              detail="Karşılıklı beğeni olduğunda haber ver."
              value={notifyOnMatch}
              onValueChange={setNotifyOnMatch}
            />
            <RowSeparator />
            <NotificationToggle
              icon="chatbubble-ellipses"
              label="Yeni mesajlar"
              detail="Eşleşmelerinden yeni mesaj geldiğinde haber ver."
              value={notifyOnMessage}
              onValueChange={setNotifyOnMessage}
            />
            <RowSeparator inset={false} />
            <Text className="px-4 py-3 text-xs leading-4 text-text-tertiary">
              {Platform.OS === "web"
                ? "Cihaz izni iOS veya Android uygulamasında verilir."
                : "İlk etkinleştirmede cihazın bildirim izni istenir."}
            </Text>
            {notificationError ? (
              <Text className="px-4 pb-3 text-xs font-semibold text-danger">
                {notificationError}
              </Text>
            ) : null}
          </SectionCard>

          <SectionTitle>Hesap</SectionTitle>
          <SectionCard>
            <Row
              icon="mail"
              title="E-posta"
              value={user?.email ?? "—"}
            />
            <RowSeparator />
            <Row
              icon="document-text"
              title="Yasal ve gizlilik merkezi"
              onPress={() => router.push("/(auth)/legal")}
            />
            <RowSeparator />
            {/*
              Kırmızı yalnızca YIKICI eylemler için (hesap silme aşağıda).
              Çıkış yapmak geri alınabilir; kırmızı burada yanlış sinyal
              veriyordu.
            */}
            <Row
              icon="log-out"
              title="Çıkış yap"
              hideChevron
              onPress={signOut}
              disabled={saveBusy || deleteBusy}
            />
          </SectionCard>

          {/*
            Yıkıcı bölge en altta ve GÖRSEL OLARAK AYRI: kendi başlığı,
            kendi rengi. Kaydet/çıkış gibi geri alınabilir eylemlerle aynı
            kartta durmamalı.
          */}
          <SectionTitle>Tehlikeli bölge</SectionTitle>
          <View className="mb-8 overflow-hidden rounded-2xl border border-danger/20 bg-danger/5">
            <View className="px-4 pb-3 pt-4">
              <Text className="text-[15px] font-bold text-danger">Hesabı sil</Text>
              <Text className="mt-1.5 text-xs leading-5 text-text-secondary">
                Hesabınla birlikte pet profilleri, fotoğraflar, eşleşmeler ve mesajlar
                kalıcı olarak kaldırılır. Bu işlem geri alınamaz.
              </Text>
            </View>
            <AppPressable
              onPress={confirmAccountDeletion}
              disabled={saveBusy || deleteBusy}
              accessibilityRole="button"
              className="min-h-[52px] items-center justify-center border-t border-danger/20 disabled:opacity-50"
            >
              {deleteBusy ? (
                <ActivityIndicator color="#E5484D" />
              ) : (
                <Text className="text-[15px] font-bold text-danger">
                  Hesabımı kalıcı olarak sil
                </Text>
              )}
            </AppPressable>
          </View>
        </ScrollView>

        {/*
          Sonuç mesajları KAYDET ŞERİDİNİN yanında.
          Öncesinde form ortasında duruyorlardı: kullanıcı en alttaki
          şeritten kaydediyor, "Profilin güncellendi" ise ekranın yukarı
          tarafında beliriyordu — çoğu zaman görünmüyordu bile.
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
            {/*
              "Vazgeç" bilerek var: kirli bir formdan çıkmanın tek yolu
              alanları tek tek eski hâline getirmekti. Yıkıcı değil —
              yalnızca sunucudaki son değerlere döner.
            */}
            <AppPressable
              onPress={discardChanges}
              disabled={saveBusy}
              accessibilityRole="button"
              className="min-h-[50px] flex-1 items-center justify-center rounded-xl border border-border disabled:opacity-50"
            >
              <Text className="font-semibold text-text-secondary">Vazgeç</Text>
            </AppPressable>
            <AppPressable
              onPress={save}
              disabled={saveBusy || locationBusy || !petName.trim() || !city.trim()}
              accessibilityRole="button"
              className="min-h-[50px] flex-[2] items-center justify-center rounded-xl bg-brand disabled:opacity-50"
            >
              {saveBusy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-bold text-white">Değişiklikleri kaydet</Text>
              )}
            </AppPressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>

      <ProfilePreviewModal
        profile={profile.data}
        visible={previewVisible}
        onClose={() => setPreviewVisible(false)}
      />
    </SafeAreaView>
  );
}
