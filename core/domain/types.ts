/**
 * Domain tipleri — saf TypeScript, hiçbir React Native / Expo importu yok.
 * Bu klasörün tamamı ileride Next.js web app'i tarafından olduğu gibi import edilir.
 */

export const SPECIES = ["cat", "dog"] as const;
export type Species = (typeof SPECIES)[number];

export const GENDERS = ["male", "female"] as const;
export type Gender = (typeof GENDERS)[number];

export const SIZES = ["small", "medium", "large"] as const;
export type Size = (typeof SIZES)[number];

/** 1 = çok sakin, 5 = çok enerjik */
export type EnergyLevel = 1 | 2 | 3 | 4 | 5;

/** Kullanıcının bu pet için ne aradığı. */
export const INTENTS = ["playdate", "mating", "both"] as const;
export type Intent = (typeof INTENTS)[number];

/** Sahibin profilinin karşı tarafa ne zaman görüneceği. */
export const OWNER_VISIBILITY = ["hidden", "after_match", "public"] as const;
export type OwnerVisibility = (typeof OWNER_VISIBILITY)[number];

export const TEMPERAMENTS = [
  "playful",
  "calm",
  "shy",
  "curious",
  "protective",
  "affectionate",
  "independent",
] as const;
export type Temperament = (typeof TEMPERAMENTS)[number];

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type OwnerProfile = {
  id: string; // = auth.users.id
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  city: string | null;
  /** Kendi sahip profilimi karşı tarafa ne zaman göstereyim. */
  ownerVisibility: OwnerVisibility;
  /**
   * Kullanıcının koyabildiği "zorunluluk": sadece sahibi de görünen petleri göster.
   * Keşfet filtresi olarak uygulanır.
   */
  requireVisibleOwner: boolean;
};

export type Pet = {
  id: string;
  ownerId: string;
  name: string;
  species: Species;
  breed: string | null;
  /** ISO tarih (YYYY-MM-DD). Yaş bundan türetilir; doğrudan yaş saklamıyoruz. */
  birthDate: string | null;
  gender: Gender;
  isNeutered: boolean;
  size: Size;
  energyLevel: EnergyLevel;
  temperaments: Temperament[];
  goodWithCats: boolean;
  goodWithDogs: boolean;
  goodWithKids: boolean;
  intent: Intent;
  bio: string | null;
  photoUrls: string[];
  location: Coordinates | null;
  isActive: boolean;
};

/** Keşfet ekranının filtre seti — kullanıcı başına saklanır. */
export type DiscoveryPreferences = {
  species: Species[];
  intents: Intent[];
  maxDistanceKm: number;
  minAgeYears: number | null;
  maxAgeYears: number | null;
  /** Sadece sahibi görünür olan petleri göster (kullanıcının koyabildiği zorunluluk). */
  requireVisibleOwner: boolean;
};

export const DEFAULT_DISCOVERY_PREFERENCES: DiscoveryPreferences = {
  species: ["cat", "dog"],
  intents: ["playdate"],
  maxDistanceKm: 25,
  minAgeYears: null,
  maxAgeYears: null,
  requireVisibleOwner: false,
};

export type SwipeDirection = "like" | "pass";

export type Match = {
  id: string;
  petAId: string;
  petBId: string;
  createdAt: string;
  /** Taraflardan biri eşleşmeyi bozduysa false. */
  isActive: boolean;
};

export type Message = {
  id: string;
  matchId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};
