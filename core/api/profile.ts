import type { Database } from "../../types/database";
import type {
  Coordinates,
  EnergyLevel,
  OwnerVisibility,
  Size,
  Temperament,
} from "../domain/types";
import { requireSupabaseClient } from "./supabase.client";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type PetRow = Database["public"]["Tables"]["pets"]["Row"];

export type EditableProfile = {
  displayName: ProfileRow["display_name"];
  city: string;
  ownerVisibility: OwnerVisibility;
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
    goodWithCats: boolean;
    goodWithDogs: boolean;
    goodWithKids: boolean;
    bio: string | null;
    photos: ProfilePhoto[];
    photoUrl: string | null;
    hasLocation: boolean;
  };
  notifications: {
    onMatch: boolean;
    onMessage: boolean;
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
  goodWithCats: boolean;
  goodWithDogs: boolean;
  goodWithKids: boolean;
  bio: string;
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
  const [profileResult, petResult, preferencesResult] = await Promise.all([
    sb
      .from("profiles")
      .select("display_name,city,owner_visibility")
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
      .select("notify_on_match,notify_on_message")
      .eq("user_id", userId)
      .single(),
  ]);

  if (profileResult.error) throw profileResult.error;
  if (petResult.error) throw petResult.error;
  if (preferencesResult.error) throw preferencesResult.error;
  if (!petResult.data) throw new Error("Aktif pet bulunamadı.");

  const { data: photos, error: photoError } = await sb
    .from("pet_photos")
    .select("storage_path")
    .eq("pet_id", petResult.data.id)
    .order("position");
  if (photoError) throw photoError;

  return {
    displayName: profileResult.data.display_name,
    city: profileResult.data.city ?? "",
    ownerVisibility: profileResult.data.owner_visibility,
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
  };
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
