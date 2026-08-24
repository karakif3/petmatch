/**
 * Sahiplendirme yüzeyi.
 *
 * Arka uç `0009`–`0011`'de hazırdı ama uygulamada hiçbir giriş noktası yoktu.
 *
 * Dikkat: bu yüzeyi PETSİZ kullanıcı da görebilmeli — sahiplendirme huninin
 * girişi. `pets` üzerindeki RLS ona hiçbir satır vermediği için listeleme
 * SECURITY DEFINER bir RPC üzerinden geliyor, doğrudan tablo sorgusuyla değil.
 */
import { requireSupabaseClient } from "./supabase.client";
import { trackProductEvent } from "./observability";
import type { Database } from "../../types/database";

type AdoptableRow = Database["public"]["Functions"]["list_adoptable_pets"]["Returns"][number];

export type AdoptablePet = {
  id: string;
  ownerId: string;
  name: string;
  species: "cat" | "dog";
  breed: string | null;
  birthDate: string | null;
  gender: "male" | "female";
  isNeutered: boolean;
  size: "small" | "medium" | "large";
  temperaments: string[];
  goodWithCats: boolean | null;
  goodWithDogs: boolean | null;
  goodWithKids: boolean | null;
  bio: string | null;
  city: string | null;
  photoUrls: string[];
  /** Kaba aktiflik kovası — kesin zaman damgası taciz sinyali olur. */
  activityBucket: string | null;
  ownerVerified: boolean;
  alreadyApplied: boolean;
};

export type AdoptionFilters = {
  species?: ("cat" | "dog")[];
  city?: string | null;
};

function photoUrl(storagePath: string): string {
  return requireSupabaseClient().storage.from("pet-photos").getPublicUrl(storagePath).data
    .publicUrl;
}

function mapAdoptable(row: AdoptableRow): AdoptablePet {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    species: row.species,
    breed: row.breed,
    birthDate: row.birth_date,
    gender: row.gender,
    isNeutered: row.is_neutered,
    size: row.size,
    temperaments: row.temperaments ?? [],
    goodWithCats: row.good_with_cats,
    goodWithDogs: row.good_with_dogs,
    goodWithKids: row.good_with_kids,
    bio: row.bio,
    city: row.city,
    photoUrls: (row.photo_paths ?? []).map(photoUrl),
    activityBucket: row.activity_bucket,
    ownerVerified: row.owner_verified,
    alreadyApplied: row.already_applied,
  };
}

export async function listAdoptablePets(
  filters: AdoptionFilters = {},
): Promise<AdoptablePet[]> {
  const { data, error } = await requireSupabaseClient().rpc("list_adoptable_pets", {
    p_species: filters.species?.length ? filters.species : undefined,
    p_city: filters.city ?? undefined,
  });
  if (error) throw error;
  return (data ?? []).map(mapAdoptable);
}

/**
 * Sahiplendirme başvurusu — karşılıklı beğeni DEĞİL.
 *
 * Barınak 200 başvuruyu swipe'lamaz; yön tek. İlan sahibi başvuruları
 * inceleyip kabul eder, konuşma o zaman açılır.
 */
export async function expressAdoptionInterest(
  petId: string,
  note: string | null,
): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("express_adoption_interest", {
    p_pet_id: petId,
    p_note: note?.trim() ? note.trim() : undefined,
  });
  if (error) throw error;
  void trackProductEvent("adoption_interest_sent");
}
