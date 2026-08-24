import { Modal, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { DiscoveryDeckCard } from "../core/api/discovery";
import type { EditableProfile } from "../core/api/profile";
import type { CompatibilityBreakdown } from "../core/domain/matching";
import { DiscoveryCard } from "./discovery-card";
import { AppPressable } from "./ui/pressable";

// Uyum skoru her zaman bir ÇİFT için hesaplanır; kendine karşı anlamı yok.
// `DiscoveryCard`'ın `variant="preview"` modu bu alanı zaten göstermiyor —
// buradaki değerler yalnızca tip uyumu için dolduruluyor, ekranda görünmüyor.
const NEUTRAL_COMPATIBILITY: CompatibilityBreakdown = {
  total: 0,
  energy: 0,
  species: 0,
  age: 0,
  temperament: 0,
};

function toPreviewCard(profile: EditableProfile): DiscoveryDeckCard {
  return {
    id: profile.pet.id,
    ownerId: "",
    name: profile.pet.name,
    species: profile.pet.species,
    breed: profile.pet.breed,
    birthDate: profile.pet.birthDate,
    gender: profile.pet.gender,
    isNeutered: profile.pet.isNeutered,
    size: profile.pet.size,
    energyLevel: profile.pet.energyLevel,
    temperaments: profile.pet.temperaments,
    goodWithCats: profile.pet.goodWithCats,
    goodWithDogs: profile.pet.goodWithDogs,
    goodWithKids: profile.pet.goodWithKids,
    goals: [],
    bio: profile.pet.bio,
    photoUrls: profile.pet.photos.map((photo) => photo.url),
    isActive: true,
    city: profile.city || null,
    distanceBucket: null,
    activityBucket: null,
    // Kendi kartını önizliyorsun; yeniden dolaşım kavramı burada yok.
    previouslyPassed: false,
    ownerProfileShown: profile.ownerVisibility !== "hidden",
    compatibility: NEUTRAL_COMPATIBILITY,
    owner:
      profile.ownerVisibility === "hidden"
        ? null
        : {
            displayName: profile.displayName,
            photoUrl: profile.ownerAvatar?.url ?? null,
            bio: profile.ownerBio,
            gender: profile.ownerGender,
            // Sunucu tarafı `owner_age_bucket()` SQL fonksiyonunun yeniden
            // uygulanması burada bilerek YOK — istemcide kopyalanan bir
            // bucket kuralı, ikisi ayrışınca sessizce yanlış gösterirdi.
            ageBucket: null,
            socialOpen: profile.ownerSocialOpen,
            verified: profile.verificationStatus === "approved",
            // `variant="preview"` sahip teaser'ını hiç render etmiyor
            // (kendi ilgi alanlarını kendine göstermenin anlamı yok) — bu
            // alan yalnızca tip uyumu için dolduruluyor.
            interests: profile.ownerInterests,
          },
  };
}

/**
 * "Profilimi önizle" — Profil ekranından açılan, kullanıcının kendi kartını
 * karşı tarafın Keşfet'te göreceği HALİYLE gösteren modal.
 *
 * Öncesinde kullanıcı kendi kartını hiçbir yerde göremiyordu: profil formu
 * alan alan dolduruluyordu ama sonucun nasıl birleştiği görünmezdi — swipe
 * ürününde algılanan kalitenin en büyük tek eksiğiydi. Ek veri ÇEKMİYOR:
 * `loadEditableProfile`'ın zaten döndürdüğü veriyi `DiscoveryCard`'ın
 * beklediği şekle eşliyor (`OwnerSheet`'in "ek veri çekilmiyor" kuralıyla
 * aynı gerekçe).
 */
export function ProfilePreviewModal({
  profile,
  visible,
  onClose,
}: {
  profile: EditableProfile | null | undefined;
  visible: boolean;
  onClose: () => void;
}) {
  if (!profile) return null;
  const card = toPreviewCard(profile);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-bg-primary">
        <View className="flex-row items-center justify-between border-b border-border px-5 pb-4 pt-16">
          <View>
            <Text className="text-lg font-bold text-text-primary">Profilini önizle</Text>
            <Text className="mt-0.5 text-xs text-text-secondary">
              Karşı taraf Keşfet&apos;te seni böyle görüyor
            </Text>
          </View>
          <AppPressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Kapat"
            className="h-11 w-11 items-center justify-center rounded-full bg-bg-tertiary"
          >
            <Ionicons name="close" size={18} color="#6B5D55" />
          </AppPressable>
        </View>
        <ScrollView contentContainerClassName="px-5 pb-10 pt-5">
          <DiscoveryCard card={card} variant="preview" />
        </ScrollView>
      </View>
    </Modal>
  );
}
