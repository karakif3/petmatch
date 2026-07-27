import { describe, expect, it } from "vitest";

import { compatibilityScore, intentsCompatible, isEligible, rankCandidates } from "./matching";
import type { DiscoveryPreferences, Pet } from "./types";
import { DEFAULT_DISCOVERY_PREFERENCES } from "./types";

const NOW = new Date("2026-01-01T00:00:00Z");

function pet(overrides: Partial<Pet> = {}): Pet {
  return {
    id: "pet-1",
    ownerId: "owner-1",
    name: "Tarçın",
    species: "dog",
    breed: null,
    birthDate: "2023-01-01",
    gender: "female",
    isNeutered: true,
    size: "medium",
    energyLevel: 3,
    temperaments: ["playful"],
    goodWithCats: false,
    goodWithDogs: true,
    goodWithKids: true,
    intent: "playdate",
    bio: null,
    photoUrls: [],
    location: { latitude: 41.0, longitude: 29.0 },
    isActive: true,
    ...overrides,
  };
}

function prefs(overrides: Partial<DiscoveryPreferences> = {}): DiscoveryPreferences {
  return { ...DEFAULT_DISCOVERY_PREFERENCES, ...overrides };
}

const baseCtx = {
  preferences: prefs(),
  candidateOwnerVisible: true,
  candidateRequiresVisibleOwner: false,
  viewerOwnerVisible: true,
  now: NOW,
};

describe("intentsCompatible", () => {
  it("aynı intent'ler eşleşir", () => {
    expect(intentsCompatible("playdate", "playdate")).toBe(true);
  });

  it("farklı intent'ler eşleşmez", () => {
    expect(intentsCompatible("playdate", "mating")).toBe(false);
  });

  it("'both' her şeyle eşleşir", () => {
    expect(intentsCompatible("both", "mating")).toBe(true);
    expect(intentsCompatible("playdate", "both")).toBe(true);
  });
});

describe("compatibilityScore", () => {
  it("her zaman 0..1 aralığında kalır", () => {
    const viewer = pet();
    const candidate = pet({ id: "pet-2", ownerId: "owner-2", energyLevel: 5 });
    const { total } = compatibilityScore(viewer, candidate, 25, NOW);

    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(1);
  });

  it("birebir aynı pet tam skora yakın çıkar", () => {
    const viewer = pet();
    const { total } = compatibilityScore(viewer, pet({ id: "pet-2" }), 25, NOW);
    expect(total).toBeCloseTo(1, 5);
  });

  it("yakın olan aday uzak olandan yüksek skor alır", () => {
    const viewer = pet();
    const near = pet({ id: "near", location: { latitude: 41.01, longitude: 29.01 } });
    const far = pet({ id: "far", location: { latitude: 41.15, longitude: 29.15 } });

    const nearScore = compatibilityScore(viewer, near, 25, NOW).total;
    const farScore = compatibilityScore(viewer, far, 25, NOW).total;

    expect(nearScore).toBeGreaterThan(farScore);
  });

  it("konum bilinmiyorsa mesafe nötr sayılır", () => {
    const viewer = pet({ location: null });
    const { distance } = compatibilityScore(viewer, pet({ id: "pet-2" }), 25, NOW);
    expect(distance).toBe(0.5);
  });

  it("farklı tür ancak iki taraf da uyumluysa puan alır", () => {
    const viewer = pet({ species: "dog", goodWithCats: true });
    const catOk = pet({ id: "cat-1", species: "cat", goodWithDogs: true });
    const catNotOk = pet({ id: "cat-2", species: "cat", goodWithDogs: false });

    expect(compatibilityScore(viewer, catOk, 25, NOW).species).toBe(0.5);
    expect(compatibilityScore(viewer, catNotOk, 25, NOW).species).toBe(0);
  });
});

describe("isEligible", () => {
  it("kendi petini göstermez", () => {
    const viewer = pet();
    expect(isEligible(pet({ id: "other" }), { viewer, ...baseCtx })).toBe(false);
  });

  it("pasif petleri eler", () => {
    const viewer = pet();
    const candidate = pet({ id: "p2", ownerId: "owner-2", isActive: false });
    expect(isEligible(candidate, { viewer, ...baseCtx })).toBe(false);
  });

  it("mesafe filtresini uygular", () => {
    const viewer = pet();
    const far = pet({ id: "p2", ownerId: "owner-2", location: { latitude: 42.0, longitude: 29.0 } });

    expect(isEligible(far, { viewer, ...baseCtx, preferences: prefs({ maxDistanceKm: 25 }) })).toBe(false);
    expect(isEligible(far, { viewer, ...baseCtx, preferences: prefs({ maxDistanceKm: 200 }) })).toBe(true);
  });

  it("intent uyuşmazsa eler", () => {
    const viewer = pet();
    const candidate = pet({ id: "p2", ownerId: "owner-2", intent: "mating" });
    expect(isEligible(candidate, { viewer, ...baseCtx, preferences: prefs({ intents: ["playdate"] }) })).toBe(false);
  });

  it("yaş aralığı filtresini uygular", () => {
    const viewer = pet();
    const puppy = pet({ id: "p2", ownerId: "owner-2", birthDate: "2025-10-01" });

    expect(isEligible(puppy, { viewer, ...baseCtx, preferences: prefs({ minAgeYears: 1 }) })).toBe(false);
    expect(isEligible(puppy, { viewer, ...baseCtx, preferences: prefs({ maxAgeYears: 1 }) })).toBe(true);
  });

  it("sahip görünürlüğü zorunluluğu gizli sahibi eler", () => {
    const viewer = pet();
    const candidate = pet({ id: "p2", ownerId: "owner-2" });

    expect(
      isEligible(candidate, {
        viewer,
        ...baseCtx,
        preferences: prefs({ requireVisibleOwner: true }),
        candidateOwnerVisible: false,
      }),
    ).toBe(false);
  });

  it("karşı tarafın zorunluluğu çift yönlü uygulanır", () => {
    const viewer = pet();
    const candidate = pet({ id: "p2", ownerId: "owner-2" });

    expect(
      isEligible(candidate, {
        viewer,
        ...baseCtx,
        candidateRequiresVisibleOwner: true,
        viewerOwnerVisible: false,
      }),
    ).toBe(false);
  });
});

describe("rankCandidates", () => {
  it("skora göre azalan sıralar", () => {
    const viewer = pet();
    const ranked = rankCandidates(
      viewer,
      [
        pet({ id: "far", location: { latitude: 41.2, longitude: 29.2 } }),
        pet({ id: "near", location: { latitude: 41.001, longitude: 29.001 } }),
      ],
      25,
      NOW,
    );

    expect(ranked[0].pet.id).toBe("near");
    expect(ranked[0].score.total).toBeGreaterThanOrEqual(ranked[1].score.total);
  });
});
