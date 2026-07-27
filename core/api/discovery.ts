import type { Database } from "../../types/database";
import { rankCandidates, type CompatibilityBreakdown } from "../domain/matching";
import {
  TEMPERAMENTS,
  type DiscoveryCandidate,
  type EnergyLevel,
  type Pet,
  type SwipeDirection,
  type Temperament,
} from "../domain/types";
import { requireSupabaseClient } from "./supabase.client";

type PetRow = Database["public"]["Tables"]["pets"]["Row"];
type DiscoveryRow = Database["public"]["Functions"]["discover_playdate_pets"]["Returns"][number];

export type DiscoveryDeckCard = DiscoveryCandidate & {
  compatibility: CompatibilityBreakdown;
};

export type DiscoveryDeck = {
  viewer: Pet | null;
  cards: DiscoveryDeckCard[];
};

function energyLevel(value: number): EnergyLevel {
  return Math.min(5, Math.max(1, Math.round(value))) as EnergyLevel;
}

function temperaments(values: string[]): Temperament[] {
  return values.filter((value): value is Temperament =>
    TEMPERAMENTS.includes(value as Temperament),
  );
}

function petPhotoUrl(storagePath: string): string {
  return requireSupabaseClient().storage.from("pet-photos").getPublicUrl(storagePath).data.publicUrl;
}

export function mapPetRow(row: PetRow, photoPaths: string[]): Pet {
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
    energyLevel: energyLevel(row.energy_level),
    temperaments: temperaments(row.temperaments),
    goodWithCats: row.good_with_cats,
    goodWithDogs: row.good_with_dogs,
    goodWithKids: row.good_with_kids,
    goals: row.goals,
    bio: row.bio,
    photoUrls: photoPaths.map(petPhotoUrl),
    isActive: row.is_active,
  };
}

export function mapDiscoveryRow(row: DiscoveryRow): DiscoveryCandidate {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    species: row.species,
    breed: row.breed || null,
    birthDate: row.birth_date || null,
    gender: row.gender,
    isNeutered: row.is_neutered,
    size: row.size,
    energyLevel: energyLevel(row.energy_level),
    temperaments: temperaments(row.temperaments),
    goodWithCats: row.good_with_cats,
    goodWithDogs: row.good_with_dogs,
    goodWithKids: row.good_with_kids,
    goals: row.goals,
    bio: row.bio || null,
    photoUrls: row.photo_paths.map(petPhotoUrl),
    isActive: true,
    city: row.city || null,
    distanceBucket: row.distance_bucket || null,
    activityBucket: row.activity_bucket || null,
    ownerVisible: row.owner_visible,
  };
}

export async function loadDiscoveryDeck(userId: string): Promise<DiscoveryDeck> {
  const sb = requireSupabaseClient();
  const { data: activePet, error: petError } = await sb
    .from("pets")
    .select("*")
    .eq("owner_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (petError) throw petError;
  if (!activePet) return { viewer: null, cards: [] };

  const { data: photos, error: photosError } = await sb
    .from("pet_photos")
    .select("storage_path")
    .eq("pet_id", activePet.id)
    .order("position");
  if (photosError) throw photosError;

  const viewer = mapPetRow(
    activePet,
    (photos ?? []).map((photo) => photo.storage_path),
  );

  const { data: rows, error: discoveryError } = await sb.rpc("discover_playdate_pets", {
    p_pet_id: viewer.id,
    p_limit: 50,
  });
  if (discoveryError) throw discoveryError;

  const candidates = (rows ?? []).map(mapDiscoveryRow);
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const cards = rankCandidates(viewer, candidates).map(({ pet, score }) => ({
    ...(candidateById.get(pet.id) as DiscoveryCandidate),
    compatibility: score,
  }));

  return { viewer, cards };
}

export async function swipePet(input: {
  fromPetId: string;
  toPetId: string;
  direction: SwipeDirection;
}): Promise<string | null> {
  const { data, error } = await requireSupabaseClient().rpc("swipe_pet", {
    p_from_pet_id: input.fromPetId,
    p_to_pet_id: input.toPetId,
    p_direction: input.direction,
  });
  if (error) throw error;
  return data ?? null;
}
