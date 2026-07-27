/**
 * Uyum skoru ve keşfet elemesi — saf fonksiyonlar.
 *
 * Skor, keşfet listesini *sıralamak* için kullanılır; eleme (`isEligible`) ise
 * kullanıcının filtrelerini ve karşı tarafın görünürlük tercihlerini uygular.
 * İkisi ayrı tutuluyor: sıralama değişse bile eleme kuralları sabit kalmalı.
 */
import { ageInYears } from "./age";
import { distanceKm } from "./distance";
import type { DiscoveryPreferences, Intent, Pet } from "./types";

/** Ağırlıklar toplamı 1.0 — skor her zaman 0..1 aralığında kalır. */
const WEIGHTS = {
  distance: 0.3,
  energy: 0.2,
  species: 0.2,
  age: 0.15,
  temperament: 0.15,
} as const;

/** İki intent birbiriyle eşleşebilir mi? */
export function intentsCompatible(a: Intent, b: Intent): boolean {
  if (a === "both" || b === "both") return true;
  return a === b;
}

function distanceScore(km: number, maxKm: number): number {
  if (maxKm <= 0) return 0;
  return Math.max(0, 1 - km / maxKm);
}

function energyScore(a: number, b: number): number {
  // 4 = mümkün olan en büyük fark (1 ↔ 5)
  return 1 - Math.abs(a - b) / 4;
}

function speciesScore(candidate: Pet, viewer: Pet): number {
  if (candidate.species === viewer.species) return 1;

  // Türler arası: her iki taraf da diğer türle iyi geçiniyorsa yine de öner.
  const viewerOk = candidate.species === "cat" ? viewer.goodWithCats : viewer.goodWithDogs;
  const candidateOk = viewer.species === "cat" ? candidate.goodWithCats : candidate.goodWithDogs;

  return viewerOk && candidateOk ? 0.5 : 0;
}

function ageScore(a: Pet, b: Pet, now: Date): number {
  const ageA = ageInYears(a.birthDate, now);
  const ageB = ageInYears(b.birthDate, now);

  // Yaş bilinmiyorsa cezalandırma — nötr skor.
  if (ageA === null || ageB === null) return 0.5;

  // 5 yıl ve üzeri fark en düşük skor.
  return Math.max(0, 1 - Math.abs(ageA - ageB) / 5);
}

function temperamentScore(a: Pet, b: Pet): number {
  if (a.temperaments.length === 0 || b.temperaments.length === 0) return 0.5;

  const setB = new Set(b.temperaments);
  const shared = a.temperaments.filter((t) => setB.has(t)).length;

  // Jaccard benzerliği
  const union = new Set([...a.temperaments, ...b.temperaments]).size;
  return union === 0 ? 0.5 : shared / union;
}

export type CompatibilityBreakdown = {
  total: number;
  distance: number;
  energy: number;
  species: number;
  age: number;
  temperament: number;
};

/**
 * 0..1 arası uyum skoru. `maxDistanceKm` kullanıcının filtresidir —
 * mesafe skoru bu üst sınıra göre normalize edilir.
 */
export function compatibilityScore(
  viewer: Pet,
  candidate: Pet,
  maxDistanceKm: number,
  now = new Date(),
): CompatibilityBreakdown {
  const km =
    viewer.location && candidate.location
      ? distanceKm(viewer.location, candidate.location)
      : null;

  // Konum bilinmiyorsa nötr skor — yakınlık avantajı da dezavantajı da olmasın.
  const distance = km === null ? 0.5 : distanceScore(km, maxDistanceKm);
  const energy = energyScore(viewer.energyLevel, candidate.energyLevel);
  const species = speciesScore(candidate, viewer);
  const age = ageScore(viewer, candidate, now);
  const temperament = temperamentScore(viewer, candidate);

  const total =
    distance * WEIGHTS.distance +
    energy * WEIGHTS.energy +
    species * WEIGHTS.species +
    age * WEIGHTS.age +
    temperament * WEIGHTS.temperament;

  return { total, distance, energy, species, age, temperament };
}

export type EligibilityContext = {
  viewer: Pet;
  preferences: DiscoveryPreferences;
  /** Karşı tarafın sahip görünürlüğü açık mı (hidden değil mi). */
  candidateOwnerVisible: boolean;
  /** Karşı taraf da "sadece sahibi görünenler" zorunluluğu koymuş mu. */
  candidateRequiresVisibleOwner: boolean;
  /** İzleyicinin kendi sahip profili görünür mü. */
  viewerOwnerVisible: boolean;
  now?: Date;
};

/**
 * Aday keşfet listesinde gösterilebilir mi?
 *
 * Görünürlük zorunluluğu **çift yönlü** uygulanır: kullanıcı "sadece sahibi
 * görünenleri göster" derse karşı taraf gizliyse elenir; karşı taraf aynı
 * zorunluluğu koyduysa kullanıcının kendi profili gizliyken o adaya görünmez.
 */
export function isEligible(candidate: Pet, ctx: EligibilityContext): boolean {
  const { viewer, preferences } = ctx;

  if (!candidate.isActive) return false;
  if (candidate.id === viewer.id) return false;
  if (candidate.ownerId === viewer.ownerId) return false;

  if (!preferences.species.includes(candidate.species)) return false;
  if (!preferences.intents.some((intent) => intentsCompatible(intent, candidate.intent))) {
    return false;
  }

  if (viewer.location && candidate.location) {
    if (distanceKm(viewer.location, candidate.location) > preferences.maxDistanceKm) {
      return false;
    }
  }

  const age = ageInYears(candidate.birthDate, ctx.now ?? new Date());
  if (age !== null) {
    if (preferences.minAgeYears !== null && age < preferences.minAgeYears) return false;
    if (preferences.maxAgeYears !== null && age > preferences.maxAgeYears) return false;
  }

  if (preferences.requireVisibleOwner && !ctx.candidateOwnerVisible) return false;
  if (ctx.candidateRequiresVisibleOwner && !ctx.viewerOwnerVisible) return false;

  return true;
}

/** Uyum skoruna göre azalan sırada dizer. */
export function rankCandidates(
  viewer: Pet,
  candidates: Pet[],
  maxDistanceKm: number,
  now = new Date(),
): { pet: Pet; score: CompatibilityBreakdown }[] {
  return candidates
    .map((pet) => ({ pet, score: compatibilityScore(viewer, pet, maxDistanceKm, now) }))
    .sort((a, b) => b.score.total - a.score.total);
}
