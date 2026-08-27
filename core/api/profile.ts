import type { Database } from "../../types/database";
import type {
  Species,
  ConnectionTag,
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
  regionSlug: string | null;
  ownerVisibility: OwnerVisibility;
  ownerBio: string | null;
  ownerBirthDate: string;
  ownerGender: "female" | "male" | "other" | null;
  ownerSocialOpen: boolean;
  ownerInterests: OwnerInterest[];
  /** Yalnızca `ownerSocialOpen` true iken anlamlı; filtrelenmez, yalnızca sinyal (`0066`). */
  connectionTag: ConnectionTag | null;
  ownerAvatar: {
    storagePath: string;
    url: string;
  } | null;
  /** Kapak `ownerAvatar`; extras pet profilinde. En fazla 4. */
  ownerPhotos: ProfilePhoto[];
  verificationStatus: ProfileRow["verification_status"];
  verificationReviewNote: string | null;
  verificationReview: {
    itemId: string;
    reasonCode: string | null;
    appealText: string | null;
  } | null;
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
    speciesGenderChangedAt: string;
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
  species: Species;
  gender: "male" | "female";
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
  connectionTag: ConnectionTag | null;
  interests: OwnerInterest[];
  /** Galeri kapağı; `saveOwnerPhotos` sonrası position 0. */
  avatarPath: string | null;
};

/** Keşfet hapı kapak, pet profili extras. Pet galerisi 6; sahip ikincil. */
export const OWNER_PHOTO_MAX = 4;

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

function isMissingColumnError(
  error: { message?: string; code?: string },
  column: string,
): boolean {
  return error.code === "PGRST204" || (error.message ?? "").includes(column);
}

export async function loadEditableProfile(userId: string): Promise<EditableProfile> {
  const sb = requireSupabaseClient();
  const [profileResult, petResult, preferencesResult, verificationResult] = await Promise.all([
    sb
      .from("profiles")
      .select(
        "display_name,city,owner_visibility,bio,birth_date,gender,avatar_url,owner_social_open,connection_tag,interests,verification_status,region_slug",
      )
      .eq("id", userId)
      .single(),
    sb
      .from("pets")
      .select(
        "id,name,species,gender,breed,birth_date,size,energy_level,is_neutered,temperaments,good_with_cats,good_with_dogs,good_with_kids,bio,latitude,longitude,created_at,species_gender_changed_at",
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
      .select("id,note,rejection_reason_code,appeal_text")
      .eq("created_by", userId)
      .eq("kind", "verification")
      .eq("status", "rejected")
      .order("reviewed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (profileResult.error) throw profileResult.error;
  let pet = petResult;
  if (pet.error && isMissingColumnError(pet.error, "species_gender_changed_at")) {
    pet = await sb
      .from("pets")
      .select(
        "id,name,species,gender,breed,birth_date,size,energy_level,is_neutered,temperaments,good_with_cats,good_with_dogs,good_with_kids,bio,latitude,longitude,created_at",
      )
      .eq("owner_id", userId)
      .eq("is_active", true)
      .maybeSingle();
  }
  if (pet.error) throw pet.error;
  if (preferencesResult.error) throw preferencesResult.error;
  if (verificationResult.error) throw verificationResult.error;
  if (!pet.data) throw new Error("Aktif pet bulunamadı.");

  const [{ data: photos, error: photoError }, ownerPhotoRows] = await Promise.all([
    sb
      .from("pet_photos")
      .select("storage_path")
      .eq("pet_id", pet.data.id)
      .order("position"),
    sb
      .from("owner_photos")
      .select("storage_path")
      .eq("owner_id", userId)
      .order("position"),
  ]);
  if (photoError) throw photoError;
  if (ownerPhotoRows.error) {
    const missingTable =
      ownerPhotoRows.error.code === "PGRST205" ||
      (ownerPhotoRows.error.message ?? "").includes("owner_photos");
    if (!missingTable) throw ownerPhotoRows.error;
  }

  const ownerPhotoPaths = (ownerPhotoRows.data ?? []).map((row) => row.storage_path);
  const fallbackAvatar = profileResult.data.avatar_url;
  const signedOwnerPaths =
    ownerPhotoPaths.length > 0
      ? ownerPhotoPaths
      : fallbackAvatar
        ? [fallbackAvatar]
        : [];
  const ownerSigned =
    signedOwnerPaths.length > 0
      ? await sb.storage
          .from(STORAGE_BUCKETS.ownerAvatars)
          .createSignedUrls(signedOwnerPaths, 60 * 60)
      : { data: null, error: null };
  if (ownerSigned.error) throw ownerSigned.error;
  const ownerPhotos: ProfilePhoto[] = signedOwnerPaths.flatMap((storagePath, index) => {
    const url = ownerSigned.data?.[index]?.signedUrl;
    return url ? [{ storagePath, url }] : [];
  });

  return {
    displayName: profileResult.data.display_name,
    city: profileResult.data.city ?? "",
    regionSlug: profileResult.data.region_slug,
    ownerVisibility: profileResult.data.owner_visibility,
    ownerBio: profileResult.data.bio,
    ownerBirthDate: profileResult.data.birth_date ?? "",
    ownerGender: profileResult.data.gender as EditableProfile["ownerGender"],
    ownerSocialOpen: profileResult.data.owner_social_open,
    connectionTag: profileResult.data.connection_tag as ConnectionTag | null,
    ownerInterests: profileResult.data.interests as OwnerInterest[],
    ownerAvatar: ownerPhotos[0] ?? null,
    ownerPhotos,
    verificationStatus: profileResult.data.verification_status,
    verificationReviewNote: verificationResult.data?.note ?? null,
    verificationReview: verificationResult.data
      ? {
          itemId: verificationResult.data.id,
          reasonCode: verificationResult.data.rejection_reason_code,
          appealText: verificationResult.data.appeal_text,
        }
      : null,
    pet: {
      id: pet.data.id,
      name: pet.data.name,
      species: pet.data.species,
      gender: pet.data.gender,
      breed: pet.data.breed,
      birthDate: pet.data.birth_date,
      size: pet.data.size,
      energyLevel: energyLevel(pet.data.energy_level),
      isNeutered: pet.data.is_neutered,
      temperaments: pet.data.temperaments as Temperament[],
      goodWithCats: pet.data.good_with_cats,
      goodWithDogs: pet.data.good_with_dogs,
      goodWithKids: pet.data.good_with_kids,
      bio: pet.data.bio,
      photos: (photos ?? []).map(({ storage_path }) => profilePhoto(storage_path)),
      photoUrl: publicPhotoUrl(photos?.[0]?.storage_path ?? null),
      hasLocation: pet.data.latitude !== null && pet.data.longitude !== null,
      speciesGenderChangedAt:
        "species_gender_changed_at" in pet.data && pet.data.species_gender_changed_at
          ? pet.data.species_gender_changed_at
          : pet.data.created_at,
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

export async function submitVerificationAppeal(
  moderationItemId: string,
  appealText: string,
): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("submit_verification_appeal", {
    p_item_id: moderationItemId,
    p_appeal_text: appealText.trim(),
  });
  if (error) throw error;
}

export async function saveOwnerPhotos(input: {
  userId: string;
  previousStoragePaths: string[];
  photos: ({ kind: "remote"; storagePath: string } | ({ kind: "local" } & LocalProfilePhoto))[];
}): Promise<string | null> {
  if (input.photos.length > OWNER_PHOTO_MAX) {
    throw new Error(`En fazla ${OWNER_PHOTO_MAX} sahip fotoğrafı ekleyebilirsin.`);
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
      const storagePath = `${input.userId}/${nonce}.${extension}`;
      const response = await fetch(photo.uri);
      const { error } = await sb.storage
        .from(STORAGE_BUCKETS.ownerAvatars)
        .upload(storagePath, await response.arrayBuffer(), {
          contentType: photo.mimeType ?? "image/jpeg",
          upsert: false,
        });
      if (error) throw error;
      uploadedPaths.push(storagePath);
      orderedPaths.push(storagePath);
    }

    const { error } = await sb.rpc("replace_owner_photo_order", {
      p_storage_paths: orderedPaths,
    });
    if (error) throw error;
  } catch (error) {
    if (uploadedPaths.length) {
      await sb.storage.from(STORAGE_BUCKETS.ownerAvatars).remove(uploadedPaths);
    }
    throw error;
  }

  const stalePaths = input.previousStoragePaths.filter(
    (path) => !orderedPaths.includes(path),
  );
  if (stalePaths.length) {
    const { error } = await sb.storage
      .from(STORAGE_BUCKETS.ownerAvatars)
      .remove(stalePaths);
    if (error) throw error;
  }

  return orderedPaths[0] ?? null;
}

export async function loadOwnerPhotos(ownerId: string): Promise<ProfilePhoto[]> {
  const sb = requireSupabaseClient();
  const { data, error } = await sb
    .from("owner_photos")
    .select("storage_path")
    .eq("owner_id", ownerId)
    .order("position");
  if (error) {
    const missingTable =
      error.code === "PGRST205" || (error.message ?? "").includes("owner_photos");
    if (!missingTable) throw error;
    return [];
  }
  const paths = (data ?? []).map((row) => row.storage_path);
  if (!paths.length) return [];
  const signed = await sb.storage
    .from(STORAGE_BUCKETS.ownerAvatars)
    .createSignedUrls(paths, 60 * 60);
  if (signed.error) throw signed.error;
  return paths.flatMap((storagePath, index) => {
    const url = signed.data?.[index]?.signedUrl;
    return url ? [{ storagePath, url }] : [];
  });
}

export async function saveOwnerProfile(input: OwnerProfileUpdate): Promise<void> {
  const sb = requireSupabaseClient();

  await recordOptionalConsent(
    "public_profile_consent",
    input.ownerVisibility === "public",
  );

  const { error } = await sb.rpc("update_my_owner_details", {
    p_display_name: input.displayName,
    p_bio: input.bio,
    p_birth_date: input.birthDate,
    p_gender: input.gender ?? (null as unknown as string),
    p_owner_visibility: input.ownerVisibility,
    p_avatar_path: input.avatarPath ?? (null as unknown as string),
    p_owner_social_open: input.ownerSocialOpen,
    p_interests: input.interests,
    p_connection_tag: input.connectionTag ?? (null as unknown as string),
  });
  if (error) throw error;
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
  if (input.requirePhoto) {
    const { data: me, error: profileError } = await requireSupabaseClient()
      .from("profiles")
      .select("avatar_url,owner_visibility")
      .single();
    if (profileError) throw profileError;
    if (!me.avatar_url || me.owner_visibility !== "public") {
      throw new Error(
        "Yalnızca fotoğraflı sahipleri görmek için kendi sahip fotoğrafını herkese açık paylaşmalısın.",
      );
    }
  }
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
    p_species: input.species,
    p_gender: input.gender,
    p_breed: breed || "",
    p_birth_date: input.birthDate || (null as unknown as string),
    p_size: input.size,
    p_energy_level: input.energyLevel,
    p_is_neutered: input.isNeutered,
    p_temperaments: input.temperaments,
    // Postgres function parameters accept null, but generated RPC types cannot
    // express parameter nullability. Null is the domain value for "unknown".
    p_good_with_cats: input.goodWithCats ?? (null as unknown as boolean),
    p_good_with_dogs: input.goodWithDogs ?? (null as unknown as boolean),
    p_good_with_kids: input.goodWithKids ?? (null as unknown as boolean),
    p_bio: bio || "",
  });
  if (error) {
    if (
      error.message.includes(
        "species and gender can change at most once every 6 months",
      )
    ) {
      throw new Error("Tür ve cinsiyet en fazla 6 ayda bir değiştirilebilir.");
    }
    throw error;
  }

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
