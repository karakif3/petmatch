import type { Database } from "../../types/database";
import { compatibilityScore, type CompatibilityBreakdown } from "../domain/matching";
import {
  OWNER_INTERESTS,
  TEMPERAMENTS,
  type DiscoveryCandidate,
  type EnergyLevel,
  type OwnerInterest,
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
    interests: OwnerInterest[];
    extraPhotoUrls?: string[];
  } | null;
};

export type DiscoveryDeck = {
  viewer: Pet | null;
  cards: DiscoveryDeckCard[];
  ownerSettings: {
    visibility: "hidden" | "after_match" | "public";
    gender: "female" | "male" | "other" | null;
    socialOpen: boolean;
    avatarUrl: string | null;
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
  /** Hangi pet cinsiyetleri destede (`0064`). Boş olamaz. */
  petGenders: ("male" | "female")[];
  /** Yalnızca `distanceFilterEnabled` açıkken eleme yapar (`0061`). */
  maxDistanceKm: number;
  distanceFilterEnabled: boolean;
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

function ownerInterests(values: string[]): OwnerInterest[] {
  return values.filter((value): value is OwnerInterest =>
    OWNER_INTERESTS.includes(value as OwnerInterest),
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

/**
 * Keşfet ve Beğeniler aynı kart tipini paylaşıyor ama iki farklı RPC'den
 * besleniyor: `pending_likes` satırında `previously_passed` YOK — yeniden
 * dolaşım (`0060`) yalnızca destenin kavramı. Bu yüzden alan opsiyonel
 * okunuyor ve yokluğu `false` sayılıyor.
 */
export function mapDiscoveryRow(
  row: Omit<DiscoveryRow, "previously_passed"> & { previously_passed?: boolean },
): DiscoveryCandidate {
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
    previouslyPassed: row.previously_passed ?? false,
    ownerProfileShown: row.owner_profile_shown,
  };
}

export async function ownerSummary(
  row: Omit<DiscoveryRow, "previously_passed">,
): Promise<DiscoveryDeckCard["owner"]> {
  // `owner_profile_shown` sunucuda zaten "bu satırda alanlar dolu mu" demek
  // (bkz. 0047) — burada ayrıca kalan boşluk kontrolü, sahibi `public` ama
  // isim/foto/bio'nun üçünü de doldurmamış farklı bir durumu kapatıyor.
  if (
    !row.owner_profile_shown ||
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
    interests: ownerInterests(row.owner_interests ?? []),
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
        "owner_visibility,gender,owner_social_open,require_visible_owner,verification_status,avatar_url",
      )
      .eq("id", userId)
      .single(),
    sb
      .from("discovery_preferences")
      .select(
        "species,pet_genders,max_distance_km,distance_filter_enabled,min_age_years,max_age_years,require_owner_photo,require_owner_social,require_verified_owner,notify_on_new_candidates",
      )
      .eq("user_id", userId)
      .single(),
  ]);
  const { data: activePet, error: petError } = petResult;
  if (petError) throw petError;
  if (profileResult.error) throw profileResult.error;
  if (preferencesResult.error) throw preferencesResult.error;

  // Kendi fotoğrafımı kendime gösteriyorum — görünürlük ayarı BAŞKALARININ
  // ne göreceğini kısıtlar, kendi eşleşme kutlamamda kendi avatarımı
  // görmemi engellemez.
  let ownerAvatarUrl: string | null = null;
  if (profileResult.data.avatar_url) {
    const { data: signed } = await sb.storage
      .from(STORAGE_BUCKETS.ownerAvatars)
      .createSignedUrl(profileResult.data.avatar_url, 60 * 30);
    ownerAvatarUrl = signed?.signedUrl ?? null;
  }

  const ownerSettings: DiscoveryDeck["ownerSettings"] = {
    visibility: profileResult.data.owner_visibility,
    gender: profileResult.data.gender as DiscoveryDeck["ownerSettings"]["gender"],
    socialOpen: profileResult.data.owner_social_open,
    avatarUrl: ownerAvatarUrl,
    verificationStatus: profileResult.data.verification_status,
    requirePhoto: preferencesResult.data.require_owner_photo,
    requireSocial: preferencesResult.data.require_owner_social,
    requireVerified: preferencesResult.data.require_verified_owner,
  };
  const filterSettings: DiscoveryFilterSettings = {
    species: preferencesResult.data.species,
    // Savunma amaçlı varsayılan. Kolon NOT NULL, yani sunucudan boş
    // gelemez — ama alan EKLENDİĞİ tur, elde tutulan eski bir yanıt
    // (React Query önbelleği) filtre ekranının tamamını çökertti:
    // `petGenders.includes` undefined üzerinde patlıyor. Tek satırlık
    // varsayılan, bu hata sınıfını bir daha ekrana taşımıyor.
    petGenders: preferencesResult.data.pet_genders ?? ["male", "female"],
    maxDistanceKm: preferencesResult.data.max_distance_km,
    distanceFilterEnabled: preferencesResult.data.distance_filter_enabled,
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
  const ownerById = new Map(
    (rows ?? []).map((row, index) => [row.id, owners[index]]),
  );
  // SIRA SUNUCUNUN. `discover_playdate_pets` mesafe kovası → aktiflik kovası
  // → kullanıcıya/saate bağlı karıştırma ile sıralıyor (`0061`). Burada
  // uyum skoruna göre yeniden dizmek o sıralamayı SESSİZCE çöpe atıyordu:
  // mesafe ve aktiflik desteye hiç yansımıyor, deste yalnızca uyum skoruna
  // göre diziliyordu. Skor artık yalnızca kartın rozetini besliyor.
  const cards = candidates.map((candidate) => ({
    ...candidate,
    compatibility: compatibilityScore(viewer, candidate),
    owner: ownerById.get(candidate.id) ?? null,
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
      p_pet_genders: input.petGenders,
      p_max_distance_km: input.maxDistanceKm,
      p_distance_filter_enabled: input.distanceFilterEnabled,
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
  isSuper?: boolean;
}): Promise<string | null> {
  const { data, error } = await requireSupabaseClient().rpc("swipe_pet", {
    p_from_pet_id: input.fromPetId,
    p_to_pet_id: input.toPetId,
    p_direction: input.direction,
    p_is_super: input.isSuper ?? false,
  });
  if (error) throw error;
  void trackProductEvent(
    input.isSuper ? "swipe_super_like" : input.direction === "like" ? "swipe_like" : "swipe_pass",
  );
  const row = data?.[0];
  if (row?.match_id) {
    void trackProductEvent("match_created");
    void requestNotificationDelivery({ type: "match", matchId: row.match_id }).catch(
      (notificationError) => {
        console.error("Eşleşme bildirimi gönderilemedi:", notificationError);
      },
    );
  } else if (input.isSuper && row?.swipe_id) {
    // Eşleşme henüz yoksa (tek taraflı süper beğeni) alıcıya yine de haber
    // verilmeli — 0044'te bilerek kapsam dışı bırakılmıştı.
    void requestNotificationDelivery({ type: "super_like", swipeId: row.swipe_id }).catch(
      (notificationError) => {
        console.error("Süper beğeni bildirimi gönderilemedi:", notificationError);
      },
    );
  }
  return row?.match_id ?? null;
}
