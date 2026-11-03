import { mapWithConcurrency, UPLOAD_CONCURRENCY } from "../domain/image-upload";
import type { Coordinates, Species } from "../domain/types";
import { prepareImageForUpload } from "../media/prepare-upload";
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

/**
 * Tekrar çalıştırılabilir onboarding kaydı.
 *
 * Fotoğraf yüklemesi yarıda kalırsa profil onboard edilmiş sayılmaz. Kullanıcı
 * tekrar deneyince mevcut aktif pet güncellenir ve fotoğraf konumları
 * upsert edilir; yarım kayıt ikinci bir aktif pet üretmez. Bir fotoğraf
 * yüklenemezse o turda yüklenenler geri silinir.
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

  // Her yüklemeye benzersiz ad: eskiden sabit `{position}.{ext}` yoluna
  // upsert ediliyordu — aynı URL kaldığı için CDN ve expo-image önbelleği
  // fotoğraf değişse de ESKİSİNİ gösterebiliyordu. Eski nesneler aşağıdaki
  // temizlikte siliniyor.
  const batch = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const uploads = await mapWithConcurrency(input.photos, UPLOAD_CONCURRENCY, async (photo, position) => {
    const prepared = await prepareImageForUpload(photo);
    const storagePath = `${input.userId}/${petId}/${batch}-${position}.${prepared.extension}`;
    const { error: uploadError } = await sb.storage
      .from("pet-photos")
      .upload(storagePath, prepared.body, {
        contentType: prepared.contentType,
        upsert: false,
      });
    if (uploadError) throw uploadError;
    return storagePath;
  });
  const failed = uploads.find((result) => result.status === "rejected");
  if (failed) {
    const uploaded = uploads.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : [],
    );
    if (uploaded.length) await sb.storage.from("pet-photos").remove(uploaded);
    throw (failed as PromiseRejectedResult).reason;
  }
  const nextStoragePaths = uploads.map(
    (result) => (result as PromiseFulfilledResult<string>).value,
  );

  const { error: photoError } = await sb.from("pet_photos").upsert(
    nextStoragePaths.map((storagePath, position) => ({
      pet_id: petId,
      storage_path: storagePath,
      position,
    })),
    { onConflict: "pet_id,position" },
  );
  if (photoError) throw photoError;

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
