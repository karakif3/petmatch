/**
 * Uyum skoru ve keşfet elemesi — saf fonksiyonlar.
 *
 * SIRALAMA BURADA DEĞİL (`0061`). Destenin sırasını sunucu veriyor: mesafe
 * kovası → aktiflik kovası → kullanıcıya ve saate bağlı karıştırma. Bu dosya
 * eskiden desteyi uyum skoruna göre yeniden diziyordu ve sunucunun sırasını
 * sessizce çöpe atıyordu — mesafe ile aktiflik kullanıcıya hiç yansımıyordu.
 * Skor artık yalnızca kartın "%N uyum" rozetini besliyor.
 *
 * Eleme (`isEligible`) ise iyimser bir istemci filtresi olarak duruyor:
 * bağlayıcı eleme sunucuda, ikisi ayrışırsa sunucu kazanır.
 *
 * MESAFE SKORDA YOK — bilerek. `discover_playdate_pets` ham koordinat
 * döndürmüyor (üçgenleme savunması, bkz. 0007); istemcide hiçbir zaman
 * dolmayacak bir alana ağırlık vermek olurdu. Mesafe zaten sıralamada.
 */
import { ageInYears } from "./age";
import type { DiscoveryPreferences, MatchGoal, Pet } from "./types";

/** Ağırlıklar toplamı 1.0 — skor her zaman 0..1 aralığında kalır. */
const WEIGHTS = {
  energy: 0.3,
  species: 0.25,
  temperament: 0.25,
  age: 0.2,
} as const;

/** İki amaç kümesi kesişiyor mu? Kesişim, uygunluğun gerek şartı. */
export function goalsOverlap(a: MatchGoal[], b: MatchGoal[]): boolean {
  return a.some((goal) => b.includes(goal));
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

  if (viewerOk === false || candidateOk === false) return 0;
  if (viewerOk === null || candidateOk === null) return 0.25;
  return 0.5;
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
  energy: number;
  species: number;
  age: number;
  temperament: number;
};

/** 0..1 arası uyum skoru. */
export function compatibilityScore(
  viewer: Pet,
  candidate: Pet,
  now = new Date(),
): CompatibilityBreakdown {
  const energy = energyScore(viewer.energyLevel, candidate.energyLevel);
  const species = speciesScore(candidate, viewer);
  const age = ageScore(viewer, candidate, now);
  const temperament = temperamentScore(viewer, candidate);

  const total =
    energy * WEIGHTS.energy +
    species * WEIGHTS.species +
    age * WEIGHTS.age +
    temperament * WEIGHTS.temperament;

  return { total, energy, species, age, temperament };
}

export type EligibilityContext = {
  viewer: Pet;
  preferences: DiscoveryPreferences;
  /** Karşı tarafın sahip görünürlüğü açık mı (hidden değil mi). */
  candidateOwnerVisible: boolean;
  /** Karşı tarafın sahip fotoğrafı var mı. */
  candidateOwnerHasPhoto: boolean;
  /** Karşı taraf petiyle birlikte yeni insanlarla tanışmaya açık mı. */
  candidateOwnerSocialOpen: boolean;
  /** Karşı tarafın sahip + pet doğrulaması onaylı mı. */
  candidateOwnerVerified: boolean;
  /** İzleyici petiyle birlikte yeni insanlarla tanışmaya açık mı. */
  viewerOwnerSocialOpen: boolean;
  /** Karşı taraf da "sadece sahibi görünenler" zorunluluğu koymuş mu. */
  candidateRequiresVisibleOwner: boolean;
  /** İzleyici "sadece sahibi görünenler" zorunluluğu koymuş mu. */
  viewerRequiresVisibleOwner: boolean;
  /** İzleyicinin kendi sahip profili görünür mü. */
  viewerOwnerVisible: boolean;
  now?: Date;
};

/**
 * Aday keşfet listesinde gösterilebilir mi?
 *
 * ⚠️ Bu **iyimser istemci filtresidir**. Bağlayıcı eleme sunucuda,
 * `discover_playdate_pets()` içindedir — ikisi ayrışırsa sunucu kazanır. Buradaki amaç,
 * yerel olarak bilinen bir değişiklikten sonra (filtre değişti, swipe atıldı)
 * elde duran desteyi sunucuya gitmeden süzebilmek.
 *
 * Mesafe kontrolü yok: istemci koordinat görmüyor.
 */
export function isEligible(candidate: Pet, ctx: EligibilityContext): boolean {
  const { viewer, preferences } = ctx;

  if (!candidate.isActive) return false;
  if (candidate.id === viewer.id) return false;
  if (candidate.ownerId === viewer.ownerId) return false;

  if (!preferences.species.includes(candidate.species)) return false;
  if (!goalsOverlap(viewer.goals, candidate.goals)) return false;

  const age = ageInYears(candidate.birthDate, ctx.now ?? new Date());
  if (age !== null) {
    if (preferences.minAgeYears !== null && age < preferences.minAgeYears) return false;
    if (preferences.maxAgeYears !== null && age > preferences.maxAgeYears) return false;
  }

  // Görünürlük zorunluluğu çift yönlü uygulanır.
  if (ctx.viewerRequiresVisibleOwner && !ctx.candidateOwnerVisible) return false;
  if (ctx.candidateRequiresVisibleOwner && !ctx.viewerOwnerVisible) return false;

  // "Sahibini de gösterenler": fotoğrafı VAR *ve* profili görünür.
  if (preferences.requireOwnerPhoto && !(ctx.candidateOwnerHasPhoto && ctx.candidateOwnerVisible)) {
    return false;
  }
  if (
    preferences.requireOwnerSocial &&
    !(ctx.viewerOwnerSocialOpen && ctx.candidateOwnerSocialOpen)
  ) {
    return false;
  }
  if (preferences.requireVerifiedOwner && !ctx.candidateOwnerVerified) return false;

  return true;
}
