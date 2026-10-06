import { describe, expect, it } from "vitest";

import { coarsenCoordinates, distanceBucket, distanceKm } from "./distance";

// İstanbul: Taksim ve Kadıköy (haversine, R = 6371 km → ~6.44 km).
const TAKSIM = { latitude: 41.0369, longitude: 28.985 };
const KADIKOY = { latitude: 40.99, longitude: 29.03 };

describe("distanceKm", () => {
  it("aynı nokta için 0 döner", () => {
    expect(distanceKm(TAKSIM, TAKSIM)).toBe(0);
  });

  it("simetriktir", () => {
    expect(distanceKm(TAKSIM, KADIKOY)).toBeCloseTo(distanceKm(KADIKOY, TAKSIM), 10);
  });

  it("bilinen iki İstanbul noktası arasında ±0.1 km doğrulukla ölçer", () => {
    expect(Math.abs(distanceKm(TAKSIM, KADIKOY) - 6.44)).toBeLessThan(0.1);
  });

  it("1 derece enlem ≈ 111.19 km", () => {
    const km = distanceKm({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    expect(km).toBeCloseTo(111.19, 1);
  });
});

describe("coarsenCoordinates", () => {
  // GİZLİ BAĞ: varsayılan 2 basamak, sunucudaki `snap_pet_location` trigger'ının
  // `round(…::numeric, 2)` yuvarlamasıyla (supabase/migrations/0007_location_privacy.sql:28,31)
  // aynı olmalı. Biri değişirse diğeri de değişmeli.
  it("varsayılan 2 basamağa yuvarlar (sunucu round(…,2) ile aynı)", () => {
    expect(coarsenCoordinates({ latitude: 41.03694, longitude: 28.98516 })).toEqual({
      latitude: 41.04,
      longitude: 28.99,
    });
  });

  it("yarıma yuvarlamada yukarı gider ve negatif değerleri korur", () => {
    expect(coarsenCoordinates({ latitude: 41.0149, longitude: -28.9851 })).toEqual({
      latitude: 41.01,
      longitude: -28.99,
    });
  });

  it("precision parametresini uygular", () => {
    expect(coarsenCoordinates({ latitude: 41.03694, longitude: 28.98516 }, 1)).toEqual({
      latitude: 41,
      longitude: 29,
    });
    expect(coarsenCoordinates({ latitude: 41.03694, longitude: 28.98516 }, 3)).toEqual({
      latitude: 41.037,
      longitude: 28.985,
    });
  });

  it("zaten kaba koordinatı değiştirmez (idempotent)", () => {
    const once = coarsenCoordinates(TAKSIM);
    expect(coarsenCoordinates(once)).toEqual(once);
  });
});

describe("distanceBucket", () => {
  // GİZLİ BAĞ: SQL tarafındaki `distance_bucket()` ile sınırlar birebir aynı olmalı.
  it("null için null döner", () => {
    expect(distanceBucket(null)).toBeNull();
  });

  it("sınırları doğru kovaya koyar (alt sınır dahil, üst sınır hariç)", () => {
    expect(distanceBucket(0)).toBe("<1");
    expect(distanceBucket(0.99)).toBe("<1");
    expect(distanceBucket(1)).toBe("1-3");
    expect(distanceBucket(2.99)).toBe("1-3");
    expect(distanceBucket(3)).toBe("3-5");
    expect(distanceBucket(5)).toBe("5-10");
    expect(distanceBucket(10)).toBe("10-25");
    expect(distanceBucket(24.99)).toBe("10-25");
    expect(distanceBucket(25)).toBe("25+");
    expect(distanceBucket(25.01)).toBe("25+");
    expect(distanceBucket(1000)).toBe("25+");
  });
});
