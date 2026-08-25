import { requireSupabaseClient } from "./supabase.client";
import type { Species } from "../domain/types";

export type PetRosterItem = {
  id: string;
  name: string;
  species: Species;
  gender: "male" | "female";
  isActive: boolean;
  photoUrl: string | null;
  photoCount: number;
};

/**
 * Kullanıcının bütün petleri — aktif olan ve arşivdekiler.
 *
 * Ek RPC yok: `pets_select_own` ve `pet_photos_select` (`0006`) kendi
 * petlerini zaten okutuyor.
 */
export async function listMyPets(userId: string): Promise<PetRosterItem[]> {
  const sb = requireSupabaseClient();

  const { data: pets, error } = await sb
    .from("pets")
    .select("id,name,species,gender,is_active")
    .eq("owner_id", userId)
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw error;
  if (!pets?.length) return [];

  const { data: photos, error: photosError } = await sb
    .from("pet_photos")
    .select("pet_id,storage_path,position")
    .in(
      "pet_id",
      pets.map((pet) => pet.id),
    )
    .order("position");
  if (photosError) throw photosError;

  const byPet = new Map<string, string[]>();
  for (const photo of photos ?? []) {
    const list = byPet.get(photo.pet_id) ?? [];
    list.push(photo.storage_path);
    byPet.set(photo.pet_id, list);
  }

  return pets.map((pet) => {
    const paths = byPet.get(pet.id) ?? [];
    return {
      id: pet.id,
      name: pet.name,
      species: pet.species,
      gender: pet.gender,
      isActive: pet.is_active,
      photoCount: paths.length,
      photoUrl: paths[0]
        ? sb.storage.from("pet-photos").getPublicUrl(paths[0]).data.publicUrl
        : null,
    };
  });
}

/**
 * Yeni pet ekler. PASİF doğar — fotoğraf eklenmeden desteye çıkmaz (`0062`).
 */
export async function createMyPet(input: {
  name: string;
  species: Species;
  gender: "male" | "female";
}): Promise<string> {
  const { data, error } = await requireSupabaseClient().rpc("create_my_pet", {
    p_name: input.name,
    p_species: input.species,
    p_gender: input.gender,
  });
  if (error) throw error;
  return data as string;
}

/**
 * Aktif peti değiştirir. Tek transaction: kullanıcı hiçbir an "aktif peti
 * olmayan" duruma düşmez (`0062`).
 */
export async function setActivePet(petId: string): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("set_active_pet", {
    p_pet_id: petId,
  });
  if (error) throw error;
}
