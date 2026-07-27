import type { Database } from "../../types/database";
import type { Coordinates, OwnerVisibility } from "../domain/types";
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
    photoUrl: string | null;
    hasLocation: boolean;
  };
  notifications: {
    onMatch: boolean;
    onMessage: boolean;
  };
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
      .select("id,name,species,latitude,longitude")
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

  const { data: photo, error: photoError } = await sb
    .from("pet_photos")
    .select("storage_path")
    .eq("pet_id", petResult.data.id)
    .order("position")
    .limit(1)
    .maybeSingle();
  if (photoError) throw photoError;

  return {
    displayName: profileResult.data.display_name,
    city: profileResult.data.city ?? "",
    ownerVisibility: profileResult.data.owner_visibility,
    pet: {
      id: petResult.data.id,
      name: petResult.data.name,
      species: petResult.data.species,
      photoUrl: publicPhotoUrl(photo?.storage_path ?? null),
      hasLocation:
        petResult.data.latitude !== null && petResult.data.longitude !== null,
    },
    notifications: {
      onMatch: preferencesResult.data.notify_on_match,
      onMessage: preferencesResult.data.notify_on_message,
    },
  };
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
