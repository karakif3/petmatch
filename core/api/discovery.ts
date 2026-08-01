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
import { requestNotificationDelivery } from "./notifications";
import { STORAGE_BUCKETS } from "./config";
import { requireSupabaseClient } from "./supabase.client";
import { trackProductEvent } from "./observability";

type PetRow = Database["public"]["Tables"]["pets"]["Row"];
type DiscoveryRow = Database["public"]["Functions"]["discover_playdate_pets"]["Returns"][number];

export type DiscoveryDeckCard = DiscoveryCandidate & {
  compatibility: CompatibilityBreakdown;
  owner: {
    displayName: string | null;
    photoUrl: string | null;
    bio: string | null;
    gender: "female" | "male" | "other" | null;
    ageBucket: string | null;
    socialOpen: boolean;
    verified: boolean;
  } | null;
};

export type DiscoveryDeck = {
  viewer: Pet | null;
  cards: DiscoveryDeckCard[];
  ownerSettings: {
    visibility: "hidden" | "after_match" | "public";
    gender: "female" | "male" | "other" | null;
    socialOpen: boolean;
    /** Doğrulama istemini doğru anda gösterebilmek için. */
    verificationStatus: "pending" | "approved" | "rejected" | null;
    requirePhoto: boolean;
    requireSocial: boolean;
    requireVerified: boolean;
  };
  filterSettings: DiscoveryFilterSettings;
};

export type DiscoveryFilterSettings = {
  species: ("cat" | "dog")[];
  maxDistanceKm: number;
  minPetAgeYears: number | null;
  maxPetAgeYears: number | null;
  requireVisibleOwner: boolean;
  requirePhoto: boolean;
  requireSocial: boolean;
  requireVerified: boolean;
  notifyOnNewCandidates: boolean;
};

export type OwnerDiscoveryFilterInput = {
  genders: ("female" | "male" | "other")[];
  minAge: number | null;
  maxAge: number | null;
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

async function ownerSummary(
  row: DiscoveryRow,
): Promise<DiscoveryDeckCard["owner"]> {
  if (
    !row.owner_visible ||
    (!row.owner_display_name && !row.owner_avatar_path && !row.owner_bio)
  ) {
    return null;
  }
  let photoUrl: string | null = null;
  if (row.owner_avatar_path) {
    const { data, error } = await requireSupabaseClient().storage
      .from(STORAGE_BUCKETS.ownerAvatars)
      .createSignedUrl(row.owner_avatar_path, 60 * 30);
    if (!error) photoUrl = data.signedUrl;
  }
  return {
    displayName: row.owner_display_name || null,
    photoUrl,
    bio: row.owner_bio || null,
    gender:
      row.owner_gender === "female" ||
      row.owner_gender === "male" ||
      row.owner_gender === "other"
        ? row.owner_gender
        : null,
    ageBucket: row.owner_age_bucket || null,
    socialOpen: row.owner_social_open,
    verified: row.owner_verified,
  };
}

export async function loadDiscoveryDeck(
  userId: string,
  filters: OwnerDiscoveryFilterInput = { genders: [], minAge: null, maxAge: null },
): Promise<DiscoveryDeck> {
  const sb = requireSupabaseClient();
  const [petResult, profileResult, preferencesResult] = await Promise.all([
    sb
      .from("pets")
      .select("*")
      .eq("owner_id", userId)
      .eq("is_active", true)
      .maybeSingle(),
    sb
      .from("profiles")
      .select(
        "owner_visibility,gender,owner_social_open,require_visible_owner,verification_status",
      )
      .eq("id", userId)
      .single(),
    sb
      .from("discovery_preferences")
      .select(
        "species,max_distance_km,min_age_years,max_age_years,require_owner_photo,require_owner_social,require_verified_owner,notify_on_new_candidates",
      )
      .eq("user_id", userId)
      .single(),
  ]);
  const { data: activePet, error: petError } = petResult;
  if (petError) throw petError;
  if (profileResult.error) throw profileResult.error;
  if (preferencesResult.error) throw preferencesResult.error;

  const ownerSettings: DiscoveryDeck["ownerSettings"] = {
    visibility: profileResult.data.owner_visibility,
    gender: profileResult.data.gender as DiscoveryDeck["ownerSettings"]["gender"],
    socialOpen: profileResult.data.owner_social_open,
    verificationStatus: profileResult.data.verification_status,
    requirePhoto: preferencesResult.data.require_owner_photo,
    requireSocial: preferencesResult.data.require_owner_social,
    requireVerified: preferencesResult.data.require_verified_owner,
  };
  const filterSettings: DiscoveryFilterSettings = {
    species: preferencesResult.data.species,
    maxDistanceKm: preferencesResult.data.max_distance_km,
    minPetAgeYears:
      preferencesResult.data.min_age_years === null
        ? null
        : Number(preferencesResult.data.min_age_years),
    maxPetAgeYears:
      preferencesResult.data.max_age_years === null
        ? null
        : Number(preferencesResult.data.max_age_years),
    requireVisibleOwner: profileResult.data.require_visible_owner,
    requirePhoto: preferencesResult.data.require_owner_photo,
    requireSocial: preferencesResult.data.require_owner_social,
    requireVerified: preferencesResult.data.require_verified_owner,
    notifyOnNewCandidates: preferencesResult.data.notify_on_new_candidates,
  };
  if (!activePet) return { viewer: null, cards: [], ownerSettings, filterSettings };

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
    p_owner_genders: filters.genders.length ? filters.genders : undefined,
    p_owner_min_age: filters.minAge ?? undefined,
    p_owner_max_age: filters.maxAge ?? undefined,
    p_limit: 50,
  });
  if (discoveryError) throw discoveryError;

  const candidates = (rows ?? []).map(mapDiscoveryRow);
  const owners = await Promise.all((rows ?? []).map(ownerSummary));
  const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const ownerById = new Map(
    (rows ?? []).map((row, index) => [row.id, owners[index]]),
  );
  const cards = rankCandidates(viewer, candidates).map(({ pet, score }) => ({
    ...(candidateById.get(pet.id) as DiscoveryCandidate),
    compatibility: score,
    owner: ownerById.get(pet.id) ?? null,
  }));

  return { viewer, cards, ownerSettings, filterSettings };
}

export async function updateDiscoveryFilters(
  input: DiscoveryFilterSettings,
): Promise<void> {
  const { error } = await requireSupabaseClient().rpc(
    "update_my_discovery_filters",
    {
      p_species: input.species,
      p_max_distance_km: input.maxDistanceKm,
      p_min_age_years: input.minPetAgeYears ?? (null as unknown as number),
      p_max_age_years: input.maxPetAgeYears ?? (null as unknown as number),
      p_require_visible_owner: input.requireVisibleOwner,
      p_require_owner_photo: input.requirePhoto,
      p_require_owner_social: input.requireSocial,
      p_require_verified_owner: input.requireVerified,
      p_notify_on_new_candidates: input.notifyOnNewCandidates,
    },
  );
  if (error) throw error;
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
  void trackProductEvent(input.direction === "like" ? "swipe_like" : "swipe_pass");
  if (data) {
    void trackProductEvent("match_created");
    void requestNotificationDelivery({ type: "match", matchId: data }).catch(
      (notificationError) => {
        console.error("Eşleşme bildirimi gönderilemedi:", notificationError);
      },
    );
  }
  return data ?? null;
}
