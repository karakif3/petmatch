import { describe, expect, it } from "vitest";

import { findOpenedRegion, locationMatchesRegion, normalizeLocation } from "./location-match";

const BESIKTAS = { slug: "besiktas", name: "Beşiktaş", city: "İstanbul", isPilot: true };
const OTHER = { slug: "other", name: "Bölgem listede yok", city: null, isPilot: false };

describe("normalizeLocation", () => {
  it("Türkçe harfleri katlar, büyük İ dahil", () => {
    expect(normalizeLocation("  Beşiktaş/İstanbul ")).toBe("besiktas/istanbul");
    expect(normalizeLocation("ÜSKÜDAR")).toBe("uskudar");
    expect(normalizeLocation("ÇANKAYA")).toBe("cankaya");
  });
});

describe("locationMatchesRegion", () => {
  it("ilçe adı ya da şehri geçince eşleşir", () => {
    expect(locationMatchesRegion("besiktas", BESIKTAS)).toBe(true);
    expect(locationMatchesRegion("İstanbul Avrupa yakası", BESIKTAS)).toBe(true);
  });

  it("alakasız talep ve boş metin eşleşmez", () => {
    expect(locationMatchesRegion("Ankara Çankaya", BESIKTAS)).toBe(false);
    expect(locationMatchesRegion("   ", BESIKTAS)).toBe(false);
  });

  it("şehri olmayan bölgede yalnız ada bakar", () => {
    expect(locationMatchesRegion("İstanbul", OTHER)).toBe(false);
  });
});

describe("findOpenedRegion", () => {
  it("yalnız pilot bölgeleri sayar", () => {
    expect(findOpenedRegion("Beşiktaş", [OTHER, BESIKTAS])?.slug).toBe("besiktas");
    expect(findOpenedRegion("Beşiktaş", [OTHER])).toBeNull();
    expect(findOpenedRegion(null, [BESIKTAS])).toBeNull();
  });
});
