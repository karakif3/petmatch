import type { Coordinates, Species } from "../domain/types";
import { recordLegalAcceptances } from "./legal";
import { trackProductEvent } from "./observability";
import { requestNotificationDelivery } from "./notifications";
import { requireSupabaseClient } from "./supabase.client";

export type OnboardingPhoto = {
  uri: string;
  fileName: string | null;
  mimeType: string | null;
};

/**
 * Kayıt yalnızca ZORUNLU olanı ister.
 *
 * Irk, boyut, enerji, kısırlaştırma ve sahip görünürlüğü buradan çıkarıldı;
 * hepsinin ya şemada makul bir varsayılanı var (`size='medium'`,
 * `energy_level=3`, `is_neutered=false`, `owner_visibility='public'`) ya
 * da null olabiliyor. Kullanıcı bunları profilinden, ürünü gördükten sonra
 * dolduruyor. Görünürlük keşfette açık başlar; kapatmak ayarlardan.
 *
 * Burada alanları YAZMAMAK bilinçli: mevcut bir peti güncellerken de aynı
 * yol işlediği için, kullanıcının profilden yaptığı seçimler kayıt akışı
 * tekrar çalıştığında ezilmiyor.
 */
export type OnboardingInput = {
  userId: string;
  displayName: string | null;
  ownerBirthDate: string;
  /** Pilot bölgelerde bölgeden türetiliyor; "Diğer"de kullanıcı yazıyor. */
  city: string | null;
  pet: {
    name: string;
    species: Species;
    gender: "male" | "female";
    birthDate: string | null;
    coordinates: Coordinates | null;
  };
  photos: OnboardingPhoto[];
  legal: {
    termsAccepted: boolean;
    privacyNoticeAcknowledged: boolean;
    locationConsent: boolean;
  };
};

function fileExtension(photo: OnboardingPhoto): string {
  const fromName = photo.fileName?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (photo.mimeType === "image/png") return "png";
  if (photo.mimeType === "image/webp") return "webp";
  return "jpg";
}

/**
 * Tekrar çalıştırılabilir onboarding kaydı.
 *
 * Fotoğraf yüklemesi yarıda kalırsa profil onboard edilmiş sayılmaz. Kullanıcı
 * tekrar deneyince mevcut aktif pet güncellenir ve aynı fotoğraf konumları
 * upsert edilir; yarım kayıt ikinci bir aktif pet üretmez.
 */
export async function completeOnboarding(input: OnboardingInput): Promise<string> {
  const sb = requireSupabaseClient();
  if (input.photos.length < 1 || input.photos.length > 6) {
    throw new Error("1–6 pet fotoğrafı eklemelisin.");
  }
  await recordLegalAcceptances({
    ...input.legal,
    // Checkbox metni keşfette görünür başladığını söylüyor; rıza burada.
    publicProfileConsent: true,
  });

  const city = input.city?.trim() || null;

  const { data: existingPet, error: existingPetError } = await sb
    .from("pets")
    .select("id")
    .eq("owner_id", input.userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (existingPetError) throw existingPetError;

  const { error: profileError } = await sb
    .from("profiles")
    .update({
      display_name: input.displayName?.trim() || null,
      birth_date: input.ownerBirthDate,
      city,
      // İlk kayıt: keşfette görünür. Tekrar çalışan akış profilden seçileni ezmez.
      ...(existingPet ? {} : { owner_visibility: "public" as const }),
    })
    .eq("id", input.userId);
  if (profileError) throw profileError;

  const petValues = {
    name: input.pet.name.trim(),
    species: input.pet.species,
    gender: input.pet.gender,
    birth_date: input.pet.birthDate,
    goals: ["playdate" as const],
    city,
    latitude: input.pet.coordinates?.latitude ?? null,
    longitude: input.pet.coordinates?.longitude ?? null,
    is_active: true,
  };

  let petId = existingPet?.id;
  if (petId) {
    const { error } = await sb.from("pets").update(petValues).eq("id", petId);
    if (error) throw error;
  } else {
    const { data, error } = await sb
      .from("pets")
      .insert({ ...petValues, owner_id: input.userId })
      .select("id")
      .single();
    if (error) throw error;
    petId = data.id;
  }

  const { data: previousPhotos, error: previousPhotosError } = await sb
    .from("pet_photos")
    .select("storage_path,position")
    .eq("pet_id", petId);
  if (previousPhotosError) throw previousPhotosError;

  const nextStoragePaths: string[] = [];
  for (const [position, photo] of input.photos.entries()) {
    const extension = fileExtension(photo);
    const storagePath = `${input.userId}/${petId}/${position}.${extension}`;
    nextStoragePaths.push(storagePath);
    const response = await fetch(photo.uri);

    const { error: uploadError } = await sb.storage
      .from("pet-photos")
      .upload(storagePath, await response.arrayBuffer(), {
        contentType: photo.mimeType ?? "image/jpeg",
        upsert: true,
      });
    if (uploadError) throw uploadError;

    const { error: photoError } = await sb.from("pet_photos").upsert(
      { pet_id: petId, storage_path: storagePath, position },
      { onConflict: "pet_id,position" },
    );
    if (photoError) throw photoError;
  }

  const staleStoragePaths = (previousPhotos ?? [])
    .map((photo) => photo.storage_path)
    .filter((path) => !nextStoragePaths.includes(path));
  if (staleStoragePaths.length > 0) {
    const { error: storageCleanupError } = await sb.storage
      .from("pet-photos")
      .remove(staleStoragePaths);
    if (storageCleanupError) throw storageCleanupError;
  }

  const { error: photoCleanupError } = await sb
    .from("pet_photos")
    .delete()
    .eq("pet_id", petId)
    .gte("position", input.photos.length);
  if (photoCleanupError) throw photoCleanupError;

  const { error: finishError } = await sb.rpc("mark_onboarding_complete");
  if (finishError) throw finishError;
  void trackProductEvent("onboarding_completed");
  void requestNotificationDelivery({ type: "new_candidate", petId }).catch(
    (error) => console.error("Yeni pet bildirimi başlatılamadı:", error),
  );

  return petId;
}
