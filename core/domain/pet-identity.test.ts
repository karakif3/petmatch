import { describe, expect, it } from "vitest";

import {
  canChangeSpeciesGender,
  speciesGenderUnlockAt,
} from "./pet-identity";

const CHANGED = "2026-02-27T08:00:00.000Z";

describe("canChangeSpeciesGender", () => {
  it("6 ay dolmadan kilitler", () => {
    expect(canChangeSpeciesGender(CHANGED, new Date("2026-08-01T08:00:00.000Z"))).toBe(
      false,
    );
  });

  it("6 ay dolunca açar", () => {
    expect(canChangeSpeciesGender(CHANGED, new Date("2026-08-27T08:00:00.000Z"))).toBe(
      true,
    );
  });
});

describe("speciesGenderUnlockAt", () => {
  it("değişimden 6 ay sonrasını verir", () => {
    expect(speciesGenderUnlockAt(CHANGED).toISOString()).toBe(
      "2026-08-27T08:00:00.000Z",
    );
  });
});
