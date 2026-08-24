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

/**
 * Petin ne aradığı. Bu küme yalnız pet amaçlarını taşır; insanın tanışma
 * modu ayrı sahip profilinde kalır (bkz. docs/goal-model.md).
 *
 * Küme olarak tutulur: uygunluk kesişimle belirlenir, bu yüzden eski
 * `both` özel durumuna gerek kalmadı.
 */
export const MATCH_GOALS = ["playdate", "adoption"] as const;
export type MatchGoal = (typeof MATCH_GOALS)[number];

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

/**
 * Sahibin ilgi alanları — pet ile ilgili ve nötr yaşam tarzı başlıklarıyla
 * sınırlı. KVKK m.6 sınırı: din, siyasi görüş, sağlık, cinsel yaşam gibi
 * özel nitelikli veriye giren hiçbir başlık burada YER ALMAZ
 * (bkz. docs/experience-roadmap.md §6).
 */
export const OWNER_INTERESTS = [
  "walks",
  "hiking",
  "running",
  "agility",
  "training",
  "beach_trips",
  "dog_park_regular",
  "cat_behavior",
  "coffee",
  "photography",
  "board_games",
  "reading",
  "cooking",
  "travel",
  "live_music",
  "volunteering",
] as const;
export type OwnerInterest = (typeof OWNER_INTERESTS)[number];

export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type OwnerProfile = {
  id: string; // = auth.users.id
  displayName: string | null;
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
  goodWithCats: boolean | null;
  goodWithDogs: boolean | null;
  goodWithKids: boolean | null;
  goals: MatchGoal[];
  bio: string | null;
  photoUrls: string[];
  isActive: boolean;
};

/**
 * Keşfet destesinde dönen aday.
 *
 * Ham koordinat YOK — `discover_playdate_pets` hiçbir zaman lat/lng döndürmez ve
 * mesafeyi kova olarak verir (bkz. 0007, üçgenleme savunması).
 */
export type DiscoveryCandidate = Pet & {
  city: string | null;
  distanceBucket: string | null;
  activityBucket: string | null;
  /**
   * Bu kart daha önce geçilmişti ve deste tükendiği için geri geldi (`0060`).
   * Taze aday varken hiçbir zaman true olmaz.
   */
  previouslyPassed: boolean;
  /** Bu satırda sahip alanları (isim/foto/bio) gerçekten dolu mu — yalnızca `public` görünürlükte. */
  ownerProfileShown: boolean;
};

/**
 * Keşfet ekranının filtre seti — kullanıcı başına saklanır.
 *
 * Amaç filtresi YOK: deste, kendi petinin amaçlarıyla kesişenleri gösterir.
 * Sahip cinsiyeti/yaşı da yok — onlar kalıcı saklanmaz, sorgu parametresidir
 * (kalıcı saklansaydı çıkarımla yönelim verisi olurdu, KVKK m.6).
 */
export type DiscoveryPreferences = {
  species: Species[];
  maxDistanceKm: number;
  /** Petin yaşı — sahibin değil. */
  minAgeYears: number | null;
  maxAgeYears: number | null;
  /** Sadece sahibi de fotoğraflı ve görünür olanları göster. */
  requireOwnerPhoto: boolean;
  /** Petiyle birlikte yeni insanlarla tanışmaya açık sahipleri göster. */
  requireOwnerSocial: boolean;
  /** Sahip + pet fotoğraf doğrulaması onaylanmış profilleri göster. */
  requireVerifiedOwner: boolean;
};

export const DEFAULT_DISCOVERY_PREFERENCES: DiscoveryPreferences = {
  species: ["cat", "dog"],
  maxDistanceKm: 25,
  minAgeYears: null,
  maxAgeYears: null,
  requireOwnerPhoto: false,
  requireOwnerSocial: false,
  requireVerifiedOwner: false,
};

export type SwipeDirection = "like" | "pass";

export type Match = {
  id: string;
  petAId: string;
  petBId: string;
  /** Eşleşme doğduğunda trigger tarafından açılan konuşma. */
  conversationId: string | null;
  createdAt: string;
  /** Taraflardan biri eşleşmeyi bozduysa false. */
  isActive: boolean;
};

export type Message = {
  id: string;
  /** Mesajlar eşleşmeye değil ortak konuşma katmanına bağlıdır. */
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
};
