import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";

import { OwnerProfileSection } from "../../components/owner-sheet";
import { PhotoCarousel } from "../../components/photo-carousel";
import { AppIcon } from "../../components/ui/icon";
import { AppPressable } from "../../components/ui/pressable";
import { loadConversationOwnerProfile } from "../../core/api/conversations";
import { loadEditableProfile } from "../../core/api/profile";
import { useAuthStore } from "../../stores/auth";
import { loadPetProfile } from "../../core/api/pet-profile";
import { formatAge } from "../../core/domain/age";
import { sizeLabels, temperamentLabels } from "../../core/domain/labels";
import { errorMessage } from "../../core/domain/error-message";

/**
 * PET PROFİL SAYFASI — ürünün tek profil yüzeyi.
 *
 * Neden petin sayfası, sahibin değil:
 *
 * 1. **Sahip görünürlüğü değişken, pet değişmez.** Sahip `hidden` /
 *    `after_match` / `public` olabiliyor; pet her zaman var. Tabanı değişken
 *    olan bir ekran boş durumlar üretmek zorunda kalırdı — dahası "sahip
 *    profili yok" diye bir boşluk göstermek, o kişinin gizlenmeyi SEÇTİĞİNİ
 *    ele verirdi. Pet tabanlı sayfada sahip bölümü ya vardır ya hiç yoktur.
 * 2. **Görünürlük kuralı tek yerde kalıyor.** Bu sayfa kuralı yeniden
 *    uygulamıyor; `get_conversation_owner_profile` ne döndürürse onu
 *    gösteriyor. Sahip tabanlı bir sayfa "bu ekran açılabilir mi" diye kuralın
 *    ikinci bir kopyasını taşımak zorunda kalırdı.
 * 3. **Dating'e evrilme yeniden yazım değil, sıralama değişikliği olur.**
 *    `connection_mode` (backlog P0-6) geldiğinde sahip bölümü petin üstüne
 *    çıkar ve hero olur — aynı rota, aynı veri, farklı bölüm sırası.
 *
 * Buraya gelinen yer bugün sohbet başlığı. Keşfet kartından giriş sonraki
 * adım: deste satırı sahip alanlarını zaten taşıyor, o yüzden oradan
 * geldiğinde `conversationId` olmadan da sahip bölümü doldurulabilir.
 */
export default function PetProfileScreen() {
  const { petId, conversationId, preview } = useLocalSearchParams<{
    petId: string;
    conversationId?: string;
    /** "1" ise kullanıcı KENDİ profiline karşı tarafın gözünden bakıyor. */
    preview?: string;
  }>();
  const isPreview = preview === "1";
  const user = useAuthStore((state) => state.user);
  const [photoIndex, setPhotoIndex] = useState(0);

  const pet = useQuery({
    queryKey: ["pet-profile", petId],
    queryFn: () => loadPetProfile(petId),
    enabled: Boolean(petId),
  });

  // Sahip bölümü yalnızca konuşma bağlamında: görünürlük kuralı konuşmaya
  // bağlı (`after_match` aktif sohbette açılıyor).
  const owner = useQuery({
    queryKey: ["conversation-owner", conversationId],
    queryFn: () => loadConversationOwnerProfile(conversationId!),
    enabled: Boolean(conversationId) && !isPreview,
  });

  /*
   * ÖNİZLEMEDE sahip verisi konuşmadan değil kendi profilinden geliyor —
   * ortada bir konuşma yok. Görünürlük kuralı burada İSTEMCİDE uygulanmıyor:
   * bölüm her durumda gösterilip üstüne "kim görüyor" etiketi konuyor.
   * Sebep, kullanıcının sorduğu sorunun tam olarak bu olması: "ayarı açtım,
   * peki karşı taraf ne görüyor?" Bölümü sessizce gizlemek o soruyu
   * yanıtsız bırakıyordu.
   */
  const myProfile = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => loadEditableProfile(user!.id),
    enabled: isPreview && Boolean(user),
  });

  const previewOwner = myProfile.data
    ? {
        displayName: myProfile.data.displayName,
        photoUrl: myProfile.data.ownerAvatar?.url ?? null,
        bio: myProfile.data.ownerBio,
        // Yaş kovası ve karşılıklı açıklama kuralı sunucuda; istemcide
        // yeniden uygulanmıyor (bkz. görünürlük önizlemesi).
        gender: null,
        ageBucket: null,
        socialOpen: myProfile.data.ownerSocialOpen,
        verified: myProfile.data.verificationStatus === "approved",
      }
    : null;
  const previewVisibility = myProfile.data?.ownerVisibility ?? "after_match";

  const age = pet.data ? formatAge(pet.data.birthDate) : null;
  const facts = pet.data
    ? [pet.data.breed, age, sizeLabels[pet.data.size]].filter(Boolean).join(" · ")
    : "";

  const compatibility = pet.data
    ? (
        [
          ["Kedilerle", pet.data.goodWithCats],
          ["Köpeklerle", pet.data.goodWithDogs],
          ["Çocuklarla", pet.data.goodWithKids],
        ] as const
      ).filter(([, value]) => value !== null)
    : [];

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <View className="flex-row items-center border-b border-border bg-surface px-3 py-2.5">
        <AppPressable
          onPress={() => router.back()}
          accessibilityLabel="Geri"
          className="h-11 w-11 items-center justify-center rounded-full"
        >
          <AppIcon name="chevron-left" color="#1F1A17" size={27} />
        </AppPressable>
        <Text className="ml-1 text-lg font-bold text-text-primary" numberOfLines={1}>
          {pet.data?.name ?? "Profil"}
        </Text>
        {isPreview ? (
          <View className="ml-2 rounded-full bg-accent/15 px-2.5 py-1">
            <Text className="text-[11px] font-bold text-accent-dark">Önizleme</Text>
          </View>
        ) : null}
      </View>

      {pet.isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#F97362" />
        </View>
      ) : pet.isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-sm text-text-secondary">
            {errorMessage(pet.error, "Profil yüklenemedi.")}
          </Text>
        </View>
      ) : !pet.data ? (
        /*
         * RLS boş döndürdüyse tek anlamı var: bu peti görme hakkı kalmamış
         * (eşleşme kaldırıldı ya da engellendi). Ekran bunu teknik bir hata
         * gibi değil, olduğu gibi söylüyor.
         */
        <View className="flex-1 items-center justify-center px-8">
          <AppIcon name="lock" color="#C4B7AE" size={32} />
          <Text className="mt-3 text-center text-sm text-text-secondary">
            Bu profil artık görünmüyor. Eşleşme kaldırılmış olabilir.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerClassName="pb-12">
          <PhotoCarousel
            photoUrls={pet.data.photoUrls}
            aspectRatio={3 / 4}
            index={photoIndex}
            onIndexChange={setPhotoIndex}
          />

          <View className="px-5 pt-5">
            <View className="flex-row items-center gap-2">
              <Text className="text-2xl font-bold text-text-primary">{pet.data.name}</Text>
              <AppIcon
                name={pet.data.gender === "female" ? "venus" : "mars"}
                color={pet.data.gender === "female" ? "#E0523F" : "#5B7FC7"}
                size={19}
              />
            </View>
            {facts ? (
              <Text className="mt-1 text-sm text-text-secondary">{facts}</Text>
            ) : null}

            <View className="mt-4 flex-row flex-wrap gap-2">
              <Chip>Enerji {pet.data.energyLevel}/5</Chip>
              {pet.data.isNeutered ? <Chip>Kısırlaştırılmış</Chip> : null}
            </View>

            {pet.data.temperaments.length > 0 ? (
              <Section title="Mizaç">
                <View className="flex-row flex-wrap gap-2">
                  {pet.data.temperaments.map((temperament) => (
                    <Chip key={temperament}>{temperamentLabels[temperament]}</Chip>
                  ))}
                </View>
              </Section>
            ) : null}

            {compatibility.length > 0 ? (
              <Section title="Uyumluluk">
                <View className="gap-2">
                  {compatibility.map(([label, value]) => (
                    <View key={label} className="flex-row items-center gap-2">
                      <AppIcon
                        name={value ? "circle-check" : "ban"}
                        color={value ? "#2FB8A6" : "#C4B7AE"}
                        size={16}
                      />
                      <Text className="text-sm text-text-secondary">
                        {label} {value ? "iyi geçinir" : "geçinemez"}
                      </Text>
                    </View>
                  ))}
                </View>
              </Section>
            ) : null}

            {pet.data.bio ? (
              <Section title="Hakkında">
                <Text className="text-sm leading-6 text-text-secondary">{pet.data.bio}</Text>
              </Section>
            ) : null}

            {isPreview && previewOwner ? (
              <View className="mt-8 border-t border-border pt-6">
                <Text className="mb-2 text-xs font-bold uppercase tracking-wide text-text-tertiary">
                  Sahibi
                </Text>
                {/*
                  Önizlemenin ASIL işi bu satır. Kullanıcı görünürlük ayarını
                  değiştiriyor ama sonucunu göremiyordu; sahip bloğunu
                  "kendi bilgini kendine göstermenin anlamı yok" diye
                  gizlemek de tam tersi bir mantıktı — önizlemenin tek
                  amacı KARŞI TARAFIN ne gördüğü.
                */}
                <View className="mb-4 rounded-xl bg-bg-secondary px-3 py-2.5">
                  <Text className="text-xs leading-4 text-text-secondary">
                    {previewVisibility === "public"
                      ? // Metinler pet adına EK ALMAYACAK şekilde kuruldu: "Luna'in"
                        // gibi bir ek istemcide üretilemez (ünlü uyumu + kesme
                        // işareti); i18n.md'deki Türkçe tuzak notu da bunu söylüyor.
                        "Herkes görüyor: Keşfet kartında adın ve fotoğrafın da görünüyor."
                      : previewVisibility === "after_match"
                        ? `Yalnızca eşleştiklerin görüyor. Keşfet kartında yalnızca ${pet.data.name} çıkar; sen eşleşmeden sonra burada ve sohbette görünürsün.`
                        : "Gizli: sahip bilgin ne Keşfet kartında ne burada görünüyor."}
                  </Text>
                </View>
                {previewVisibility === "hidden" ? null : (
                  <OwnerProfileSection owner={previewOwner} petName={pet.data.name} />
                )}
              </View>
            ) : owner.data ? (
              <View className="mt-8 border-t border-border pt-6">
                <Text className="mb-4 text-xs font-bold uppercase tracking-wide text-text-tertiary">
                  Sahibi
                </Text>
                <OwnerProfileSection
                  owner={{
                    displayName: owner.data.displayName,
                    photoUrl: owner.data.photoUrl,
                    bio: owner.data.bio,
                    gender: owner.data.gender,
                    ageBucket: owner.data.ageBucket,
                    socialOpen: owner.data.socialOpen,
                    verified: owner.data.verified,
                  }}
                  petName={pet.data.name}
                />
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-full border border-border bg-surface px-3 py-1.5">
      <Text className="text-xs font-semibold text-text-secondary">{children}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-6">
      <Text className="mb-2.5 text-sm font-bold text-text-primary">{title}</Text>
      {children}
    </View>
  );
}
