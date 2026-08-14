import type { Database } from "../../types/database";
import type {
  Coordinates,
  EnergyLevel,
  OwnerInterest,
  OwnerVisibility,
  Size,
  Temperament,
} from "../domain/types";
import { STORAGE_BUCKETS } from "./config";
import { requireSupabaseClient } from "./supabase.client";
import { trackProductEvent } from "./observability";
import { recordOptionalConsent } from "./legal";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type PetRow = Database["public"]["Tables"]["pets"]["Row"];

export type EditableProfile = {
  displayName: ProfileRow["display_name"];
  city: string;
  ownerVisibility: OwnerVisibility;
  ownerBio: string | null;
  ownerBirthDate: string;
  ownerGender: "female" | "male" | "other" | null;
  ownerSocialOpen: boolean;
  ownerInterests: OwnerInterest[];
  ownerAvatar: {
    storagePath: string;
    url: string;
  } | null;
  verificationStatus: ProfileRow["verification_status"];
  verificationReviewNote: string | null;
  pet: {
    id: string;
    name: string;
    species: PetRow["species"];
    gender: PetRow["gender"];
    breed: string | null;
    birthDate: string | null;
    size: Size;
    energyLevel: EnergyLevel;
    isNeutered: boolean;
    temperaments: Temperament[];
    goodWithCats: boolean | null;
    goodWithDogs: boolean | null;
    goodWithKids: boolean | null;
    bio: string | null;
    photos: ProfilePhoto[];
    photoUrl: string | null;
    hasLocation: boolean;
  };
  notifications: {
    onMatch: boolean;
    onMessage: boolean;
  };
  ownerFilters: {
    requirePhoto: boolean;
    requireSocial: boolean;
    requireVerified: boolean;
  };
};

export type ProfilePhoto = {
  storagePath: string;
  url: string;
};

export type LocalProfilePhoto = {
  uri: string;
  fileName: string | null;
  mimeType: string | null;
};

export type PetProfileUpdate = {
  petId: string;
  name: string;
  breed: string;
  birthDate: string;
  size: Size;
  energyLevel: EnergyLevel;
  isNeutered: boolean;
  temperaments: Temperament[];
  goodWithCats: boolean | null;
  goodWithDogs: boolean | null;
  goodWithKids: boolean | null;
  bio: string;
};

export type OwnerProfileUpdate = {
  userId: string;
  displayName: string;
  bio: string;
  birthDate: string;
  gender: "female" | "male" | "other" | null;
  ownerVisibility: OwnerVisibility;
  ownerSocialOpen: boolean;
  interests: OwnerInterest[];
  previousAvatarPath: string | null;
  avatar:
    | { kind: "remote"; storagePath: string }
    | ({ kind: "local" } & LocalProfilePhoto)
    | null;
};

export type ProfileUpdate = {
  displayName: string;
  city: string;
  ownerVisibility: OwnerVisibility;
  petName: string;
  coordinates: Coordinates | null;
};

function publicPhotoUrl(path: string | null): string | null {
  if (!path) return null;
  return requireSupabaseClient().storage.from("pet-photos").getPublicUrl(path).data.publicUrl;
}

function energyLevel(value: number): EnergyLevel {
  return Math.min(5, Math.max(1, Math.round(value))) as EnergyLevel;
}

function profilePhoto(storagePath: string): ProfilePhoto {
  return { storagePath, url: publicPhotoUrl(storagePath)! };
}

export async function loadEditableProfile(userId: string): Promise<EditableProfile> {
  const sb = requireSupabaseClient();
  const [profileResult, petResult, preferencesResult, verificationResult] = await Promise.all([
    sb
      .from("profiles")
      .select(
        "display_name,city,owner_visibility,bio,birth_date,gender,avatar_url,owner_social_open,interests,verification_status",
      )
      .eq("id", userId)
      .single(),
    sb
      .from("pets")
      .select(
        "id,name,species,gender,breed,birth_date,size,energy_level,is_neutered,temperaments,good_with_cats,good_with_dogs,good_with_kids,bio,latitude,longitude",
      )
      .eq("owner_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    sb
      .from("discovery_preferences")
      .select(
        "notify_on_match,notify_on_message,require_owner_photo,require_owner_social,require_verified_owner",
      )
      .eq("user_id", userId)
      .single(),
    sb
      .from("moderation_items")
      .select("note")
      .eq("created_by", userId)
      .eq("kind", "verification")
      .eq("status", "rejected")
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (petResult.error) throw petResult.error;
  if (preferencesResult.error) throw preferencesResult.error;
  if (verificationResult.error) throw verificationResult.error;
  if (!petResult.data) throw new Error("Aktif pet bulunamadı.");

  const [{ data: photos, error: photoError }, avatarResult] = await Promise.all([
    sb
      .from("pet_photos")
      .select("storage_path")
      .eq("pet_id", petResult.data.id)
      .order("position"),
    profileResult.data.avatar_url
      ? sb.storage
          .from(STORAGE_BUCKETS.ownerAvatars)
          .createSignedUrl(profileResult.data.avatar_url, 60 * 60)
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (photoError) throw photoError;
  if (avatarResult.error) throw avatarResult.error;

  return {
    displayName: profileResult.data.display_name,
    city: profileResult.data.city ?? "",
    ownerVisibility: profileResult.data.owner_visibility,
    ownerBio: profileResult.data.bio,
    ownerBirthDate: profileResult.data.birth_date ?? "",
    ownerGender: profileResult.data.gender as EditableProfile["ownerGender"],
    ownerSocialOpen: profileResult.data.owner_social_open,
    ownerInterests: profileResult.data.interests as OwnerInterest[],
    ownerAvatar:
      profileResult.data.avatar_url && avatarResult.data
        ? {
            storagePath: profileResult.data.avatar_url,
            url: avatarResult.data.signedUrl,
          }
        : null,
    verificationStatus: profileResult.data.verification_status,
    verificationReviewNote: verificationResult.data?.note ?? null,
    pet: {
      id: petResult.data.id,
      name: petResult.data.name,
      species: petResult.data.species,
      gender: petResult.data.gender,
      breed: petResult.data.breed,
      birthDate: petResult.data.birth_date,
      size: petResult.data.size,
      energyLevel: energyLevel(petResult.data.energy_level),
      isNeutered: petResult.data.is_neutered,
      temperaments: petResult.data.temperaments as Temperament[],
      goodWithCats: petResult.data.good_with_cats,
      goodWithDogs: petResult.data.good_with_dogs,
      goodWithKids: petResult.data.good_with_kids,
      bio: petResult.data.bio,
      photos: (photos ?? []).map(({ storage_path }) => profilePhoto(storage_path)),
      photoUrl: publicPhotoUrl(photos?.[0]?.storage_path ?? null),
      hasLocation:
        petResult.data.latitude !== null && petResult.data.longitude !== null,
    },
    notifications: {
      onMatch: preferencesResult.data.notify_on_match,
      onMessage: preferencesResult.data.notify_on_message,
    },
    ownerFilters: {
      requirePhoto: preferencesResult.data.require_owner_photo,
      requireSocial: preferencesResult.data.require_owner_social,
      requireVerified: preferencesResult.data.require_verified_owner,
    },
  };
}

export async function saveOwnerProfile(input: OwnerProfileUpdate): Promise<void> {
  const sb = requireSupabaseClient();
  const uploadedPaths: string[] = [];
  let avatarPath = input.avatar?.kind === "remote" ? input.avatar.storagePath : null;

  await recordOptionalConsent(
    "public_profile_consent",
    input.ownerVisibility === "public",
  );

  try {
    if (input.avatar?.kind === "local") {
      const extension = fileExtension(input.avatar);
      avatarPath = `${input.userId}/avatar-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 10)}.${extension}`;
      const response = await fetch(input.avatar.uri);
      const { error } = await sb.storage
        .from(STORAGE_BUCKETS.ownerAvatars)
        .upload(avatarPath, await response.arrayBuffer(), {
          contentType: input.avatar.mimeType ?? "image/jpeg",
          upsert: false,
        });
      if (error) throw error;
      uploadedPaths.push(avatarPath);
    }

    const { error } = await sb.rpc("update_my_owner_details", {
      p_display_name: input.displayName,
      p_bio: input.bio,
      p_birth_date: input.birthDate,
      p_gender: input.gender ?? (null as unknown as string),
      p_owner_visibility: input.ownerVisibility,
      p_avatar_path: avatarPath ?? (null as unknown as string),
      p_owner_social_open: input.ownerSocialOpen,
      p_interests: input.interests,
    });
    if (error) throw error;
  } catch (error) {
    if (uploadedPaths.length) {
      await sb.storage.from(STORAGE_BUCKETS.ownerAvatars).remove(uploadedPaths);
    }
    throw error;
  }

  if (
    input.previousAvatarPath &&
    input.previousAvatarPath !== avatarPath
  ) {
    const { error } = await sb.storage
      .from(STORAGE_BUCKETS.ownerAvatars)
      .remove([input.previousAvatarPath]);
    if (error) throw error;
  }
}

export async function submitOwnerVerification(input: {
  userId: string;
  petId: string;
  photo: LocalProfilePhoto;
}): Promise<string> {
  const sb = requireSupabaseClient();
  const extension = fileExtension(input.photo);
  const storagePath = `${input.userId}/${input.petId}/${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${extension}`;

  const response = await fetch(input.photo.uri);
  const { error: uploadError } = await sb.storage
    .from(STORAGE_BUCKETS.verificationPhotos)
    .upload(storagePath, await response.arrayBuffer(), {
      contentType: input.photo.mimeType ?? "image/jpeg",
      upsert: false,
    });
  if (uploadError) {
    if (
      uploadError.message.toLowerCase().includes("size") ||
      uploadError.message.toLowerCase().includes("limit")
    ) {
      throw new Error("Doğrulama fotoğrafı en fazla 6 MB olabilir. Lütfen yeniden çek.");
    }
    throw uploadError;
  }

  const { data, error } = await sb.rpc("submit_verification", {
    p_pet_id: input.petId,
    p_photo_path: storagePath,
  });
  if (error) {
    await sb.storage.from(STORAGE_BUCKETS.verificationPhotos).remove([storagePath]);
    if (error.message.includes("already pending")) {
      throw new Error("Zaten inceleme bekleyen bir doğrulama başvurun var.");
    }
    if (error.message.includes("submission limit")) {
      throw new Error(
        "24 saat içinde en fazla üç doğrulama fotoğrafı gönderebilirsin. Lütfen daha sonra tekrar dene.",
      );
    }
    throw error;
  }
  void trackProductEvent("verification_submitted");
  return data;
}

export async function updateOwnerDiscoveryFilters(input: {
  requirePhoto: boolean;
  requireSocial: boolean;
  requireVerified: boolean;
}): Promise<void> {
  const { error } = await requireSupabaseClient().rpc(
    "update_owner_discovery_filters",
    {
      p_require_owner_photo: input.requirePhoto,
      p_require_owner_social: input.requireSocial,
      p_require_verified_owner: input.requireVerified,
    },
  );
  if (error) throw error;
}

export async function updatePetProfile(input: PetProfileUpdate): Promise<string> {
  const name = input.name.trim();
  const breed = input.breed.trim();
  const bio = input.bio.trim();
  if (!name || name.length > 40) {
    throw new Error("Petinin adı 1–40 karakter olmalı.");
  }
  if (breed.length > 80) throw new Error("Irk en fazla 80 karakter olabilir.");
  if (bio.length > 500) throw new Error("Hakkında alanı en fazla 500 karakter olabilir.");

  const { data, error } = await requireSupabaseClient().rpc("update_my_pet_profile", {
    p_pet_id: input.petId,
    p_name: name,
    p_breed: breed || "",
    p_birth_date: input.birthDate || (null as unknown as string),
    p_size: input.size,
    p_energy_level: input.energyLevel,
    p_is_neutered: input.isNeutered,
    p_temperaments: input.temperaments,
    p_good_with_cats: input.goodWithCats,
    p_good_with_dogs: input.goodWithDogs,
    p_good_with_kids: input.goodWithKids,
    p_bio: bio || "",
  });
  if (error) throw error;

  // Kullanıcı bu formu kaydettiyse boyut/enerji/kısırlaştırma artık
  // varsayılan değil, seçilmiş sayılır — profil tamamlama kartı bu adımı
  // eksik göstermeyi bıraksın (0040).
  const { error: markError } = await requireSupabaseClient().rpc(
    "mark_pet_details_completed",
    { p_pet_id: input.petId },
  );
  if (markError) throw markError;

  return data;
}

function fileExtension(photo: LocalProfilePhoto): string {
  const fromName = photo.fileName?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (photo.mimeType === "image/png") return "png";
  if (photo.mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function savePetPhotos(input: {
  userId: string;
  petId: string;
  previousStoragePaths: string[];
  photos: ({ kind: "remote"; storagePath: string } | ({ kind: "local" } & LocalProfilePhoto))[];
}): Promise<void> {
  if (input.photos.length < 1 || input.photos.length > 6) {
    throw new Error("1–6 pet fotoğrafı eklemelisin.");
  }

  const sb = requireSupabaseClient();
  const uploadedPaths: string[] = [];
  const orderedPaths: string[] = [];
  try {
    for (const [index, photo] of input.photos.entries()) {
      if (photo.kind === "remote") {
        orderedPaths.push(photo.storagePath);
        continue;
      }
      const extension = fileExtension(photo);
      const nonce = `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 10)}`;
      const storagePath = `${input.userId}/${input.petId}/${nonce}.${extension}`;
      const response = await fetch(photo.uri);
      const { error } = await sb.storage
        .from("pet-photos")
        .upload(storagePath, await response.arrayBuffer(), {
          contentType: photo.mimeType ?? "image/jpeg",
          upsert: false,
        });
      if (error) throw error;
      uploadedPaths.push(storagePath);
      orderedPaths.push(storagePath);
    }

    const { error } = await sb.rpc("replace_pet_photo_order", {
      p_pet_id: input.petId,
      p_storage_paths: orderedPaths,
    });
    if (error) throw error;
  } catch (error) {
    if (uploadedPaths.length) {
      await sb.storage.from("pet-photos").remove(uploadedPaths);
    }
    throw error;
  }

  const stalePaths = input.previousStoragePaths.filter(
    (path) => !orderedPaths.includes(path),
  );
  if (stalePaths.length) {
    const { error } = await sb.storage.from("pet-photos").remove(stalePaths);
    if (error) throw error;
  }
}

export async function updateEditableProfile(input: ProfileUpdate): Promise<string> {
  const petName = input.petName.trim();
  const city = input.city.trim();
  const displayName = input.displayName.trim();

  if (!petName || petName.length > 40) {
    throw new Error("Petinin adı 1–40 karakter olmalı.");
  }
  if (!city) throw new Error("Şehir boş bırakılamaz.");
  if (displayName.length > 60) throw new Error("Adın en fazla 60 karakter olabilir.");

  if (input.coordinates) {
    await recordOptionalConsent("location_consent", true);
  }
  await recordOptionalConsent(
    "public_profile_consent",
    input.ownerVisibility === "public",
  );

  const { data, error } = await requireSupabaseClient().rpc("update_my_profile", {
    p_city: city,
    p_display_name: displayName,
    // PostgreSQL fonksiyon parametreleri nullable olsa da üretilen istemci
    // tipi bunu yansıtmaz. Konum güncellenmiyorsa sunucu bu iki değeri yok sayar.
    p_latitude: input.coordinates?.latitude ?? 0,
    p_longitude: input.coordinates?.longitude ?? 0,
    p_owner_visibility: input.ownerVisibility,
    p_pet_name: petName,
    p_update_location: Boolean(input.coordinates),
  });
  if (error) throw error;
  return data;
}

/**
 * Yalnızca sahip görünürlüğünü değiştirir (Keşfet başlığındaki hızlı toggle).
 *
 * `update_my_profile` / `update_my_owner_details` RPC'leri formun TAMAMINI
 * ister (ad, şehir, pet adı, doğum tarihi…); tek alanı çevirmek için o
 * yükü taşımak, formda olmayan alanları istemci tarafında yeniden
 * kurgulamak demekti. Tek alanlık yazma doğrudan tabloya gidiyor —
 * `profiles_update_self` RLS politikası (0003) bunu zaten kendi satırıyla
 * sınırlıyor.
 *
 * Rıza kaydı burada da alınıyor: "herkese açık" bir onay durumudur, hangi
 * yüzeyden açıldığından bağımsız olarak kaydedilmeli.
 */
export async function updateOwnerVisibility(input: {
  userId: string;
  visibility: OwnerVisibility;
}): Promise<void> {
  await recordOptionalConsent(
    "public_profile_consent",
    input.visibility === "public",
  );
  const { error } = await requireSupabaseClient()
    .from("profiles")
    .update({ owner_visibility: input.visibility })
    .eq("id", input.userId);
  if (error) throw error;
}

export async function updateNotificationPreferences(input: {
  onMatch: boolean;
  onMessage: boolean;
}): Promise<void> {
  const { error } = await requireSupabaseClient().rpc(
    "update_notification_preferences",
    {
      p_notify_on_match: input.onMatch,
      p_notify_on_message: input.onMessage,
    },
  );
  if (error) throw error;
}
