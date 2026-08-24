import { describe, expect, it } from "vitest";

import { compatibilityScore, goalsOverlap, isEligible } from "./matching";
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
    goals: ["playdate"],
    bio: null,
    photoUrls: [],
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
  candidateOwnerHasPhoto: true,
  candidateOwnerSocialOpen: true,
  candidateOwnerVerified: true,
  viewerOwnerSocialOpen: true,
  candidateRequiresVisibleOwner: false,
  viewerRequiresVisibleOwner: false,
  viewerOwnerVisible: true,
  now: NOW,
};

describe("goalsOverlap", () => {
  it("aynı amaç kesişir", () => {
    expect(goalsOverlap(["playdate"], ["playdate"])).toBe(true);
  });

  it("kesişmeyen amaçlar eşleşmez", () => {
    expect(goalsOverlap(["playdate"], ["adoption"])).toBe(false);
  });

  it("çoklu amaçta tek ortak eleman yeter", () => {
    expect(goalsOverlap(["playdate", "adoption"], ["adoption"])).toBe(true);
  });

  it("boş küme hiçbir şeyle kesişmez", () => {
    expect(goalsOverlap([], ["playdate"])).toBe(false);
  });
});

describe("compatibilityScore", () => {
  it("her zaman 0..1 aralığında kalır", () => {
    const viewer = pet();
    const candidate = pet({ id: "pet-2", ownerId: "owner-2", energyLevel: 5 });
    const { total } = compatibilityScore(viewer, candidate, NOW);

    expect(total).toBeGreaterThanOrEqual(0);
    expect(total).toBeLessThanOrEqual(1);
  });

  it("birebir aynı pet tam skora yakın çıkar", () => {
    const viewer = pet();
    const { total } = compatibilityScore(viewer, pet({ id: "pet-2" }), NOW);
    expect(total).toBeCloseTo(1, 5);
  });

  it("enerji farkı skoru düşürür", () => {
    const viewer = pet({ energyLevel: 1 });
    const yakin = compatibilityScore(viewer, pet({ id: "a", energyLevel: 2 }), NOW).total;
    const uzak = compatibilityScore(viewer, pet({ id: "b", energyLevel: 5 }), NOW).total;

    expect(yakin).toBeGreaterThan(uzak);
  });

  it("farklı tür ancak iki taraf da uyumluysa puan alır", () => {
    const viewer = pet({ species: "dog", goodWithCats: true });
    const catOk = pet({ id: "cat-1", species: "cat", goodWithDogs: true });
    const catNotOk = pet({ id: "cat-2", species: "cat", goodWithDogs: false });

    expect(compatibilityScore(viewer, catOk, NOW).species).toBe(0.5);
    expect(compatibilityScore(viewer, catNotOk, NOW).species).toBe(0);
  });

  it("farklı tür uyumu bilinmiyorsa hayır kadar sert cezalandırmaz", () => {
    const viewer = pet({ species: "dog", goodWithCats: null });
    const cat = pet({ id: "cat-unknown", species: "cat", goodWithDogs: true });

    expect(compatibilityScore(viewer, cat, NOW).species).toBe(0.25);
  });

  it("mesafe bileşeni yok — sıralamayı sunucu yapıyor", () => {
    const breakdown = compatibilityScore(pet(), pet({ id: "p2" }), NOW);
    expect(breakdown).not.toHaveProperty("distance");
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

  it("amaç kesişmiyorsa eler", () => {
    const viewer = pet({ goals: ["playdate"] });
    const candidate = pet({ id: "p2", ownerId: "owner-2", goals: ["adoption"] });
    expect(isEligible(candidate, { viewer, ...baseCtx })).toBe(false);
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
        viewerRequiresVisibleOwner: true,
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

  it("sahip fotoğrafı filtresi, fotoğrafı olup profili gizli olanı da eler", () => {
    const viewer = pet();
    const candidate = pet({ id: "p2", ownerId: "owner-2" });
    const withPhotoFilter = { viewer, ...baseCtx, preferences: prefs({ requireOwnerPhoto: true }) };

    expect(isEligible(candidate, withPhotoFilter)).toBe(true);
    expect(isEligible(candidate, { ...withPhotoFilter, candidateOwnerHasPhoto: false })).toBe(false);
    // Fotoğrafı var ama profili gizli — filtrenin vaadi "sahibini görebileceğim".
    expect(isEligible(candidate, { ...withPhotoFilter, candidateOwnerVisible: false })).toBe(false);
  });

  it("sahip sosyalleşmesi filtresini karşılıklı uygular", () => {
    const viewer = pet();
    const candidate = pet({ id: "p2", ownerId: "owner-2" });
    const socialFilter = {
      viewer,
      ...baseCtx,
      preferences: prefs({ requireOwnerSocial: true }),
    };

    expect(isEligible(candidate, socialFilter)).toBe(true);
    expect(
      isEligible(candidate, { ...socialFilter, candidateOwnerSocialOpen: false }),
    ).toBe(false);
    expect(
      isEligible(candidate, { ...socialFilter, viewerOwnerSocialOpen: false }),
    ).toBe(false);
  });

  it("doğrulanmış sahip filtresi onaysız profili eler", () => {
    const viewer = pet();
    const candidate = pet({ id: "p2", ownerId: "owner-2" });
    expect(
      isEligible(candidate, {
        viewer,
        ...baseCtx,
        preferences: prefs({ requireVerifiedOwner: true }),
        candidateOwnerVerified: false,
      }),
    ).toBe(false);
  });
});
