import { describe, expect, it } from "vitest";

import { ageInYears, formatAge } from "./age";

// `now` her testte sabit; sistem saatine bağlı değil.
const NOW = new Date("2026-08-04T12:00:00Z");

describe("ageInYears", () => {
  it("tarih yoksa null döner", () => {
    expect(ageInYears(null, NOW)).toBeNull();
    expect(ageInYears("", NOW)).toBeNull();
  });

  it("geçersiz tarih için null döner", () => {
    expect(ageInYears("not-a-date", NOW)).toBeNull();
  });

  it("gelecekteki doğum tarihi için null döner", () => {
    expect(ageInYears("2026-08-05", NOW)).toBeNull();
    expect(ageInYears("2030-01-01", NOW)).toBeNull();
  });

  it("ondalıklı yıl hesaplar (365.25 gün/yıl)", () => {
    expect(ageInYears("2024-08-04", NOW)).toBeCloseTo(2.0, 1);
    expect(ageInYears("2026-02-04", NOW)).toBeCloseTo(0.5, 1);
  });

  it("doğum anında 0 döner", () => {
    expect(ageInYears("2026-08-04T12:00:00Z", NOW)).toBe(0);
  });
});

describe("formatAge", () => {
  it("tarih yoksa, geçersizse ya da gelecekteyse null döner", () => {
    expect(formatAge(null, NOW)).toBeNull();
    expect(formatAge("not-a-date", NOW)).toBeNull();
    expect(formatAge("2027-01-01", NOW)).toBeNull();
  });

  it("1 yaşından küçükleri ay olarak yazar", () => {
    expect(formatAge("2026-02-04", NOW)).toBe("6 aylık");
    expect(formatAge("2025-12-04", NOW)).toBe("8 aylık");
  });

  it("1 aydan küçükleri en az 1 aylık yazar", () => {
    expect(formatAge("2026-08-04T12:00:00Z", NOW)).toBe("1 aylık");
    expect(formatAge("2026-07-30", NOW)).toBe("1 aylık");
  });

  it("doğum günü öncesinde bir önceki yaşı gösterir", () => {
    // Doğum günü 15 Haziran; 14 Haziran'da henüz 2 yaşında.
    expect(formatAge("2020-06-15", new Date("2023-06-14T12:00:00Z"))).toBe("2 yaşında");
  });

  it("doğum gününden sonra yeni yaşı gösterir", () => {
    expect(formatAge("2020-06-15", new Date("2023-06-16T12:00:00Z"))).toBe("3 yaşında");
  });

  it("mevcut davranış: tam doğum günü gecesi 365.25 gün/yıl yüzünden yeni yaşa ~1 gün geç geçer", () => {
    // 2020-06-15 → 2023-06-15 = 1095 gün < 3 * 365.25; kilitlenen davranış, olması gereken değil.
    expect(formatAge("2020-06-15", new Date("2023-06-15T00:00:00Z"))).toBe("2 yaşında");
  });

  it("tam yılları yaş olarak yazar", () => {
    expect(formatAge("2023-08-04", NOW)).toBe("3 yaşında");
    expect(formatAge("2016-01-01", NOW)).toBe("10 yaşında");
  });
});
