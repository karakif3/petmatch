import { describe, expect, it } from "vitest";

import {
  PET_AGE_OPTIONS,
  PET_AGE_UNKNOWN,
  birthDateToPetAge,
  petAgeToBirthDate,
} from "./pet-age";

const TODAY = new Date(2026, 7, 4); // 2026-08-04

describe("petAgeToBirthDate", () => {
  it("yaş seçimini yaklaşık doğum tarihine çevirir", () => {
    expect(petAgeToBirthDate("y3", TODAY)).toBe("2023-08-04");
    expect(petAgeToBirthDate("y1", TODAY)).toBe("2025-08-04");
  });

  it("bir yaş altını ay olarak hesaplar", () => {
    expect(petAgeToBirthDate("m0_6", TODAY)).toBe("2026-05-04");
    expect(petAgeToBirthDate("m6_12", TODAY)).toBe("2025-11-04");
  });

  it("bilinmiyorsa tarih UYDURMAZ", () => {
    expect(petAgeToBirthDate(PET_AGE_UNKNOWN, TODAY)).toBeNull();
  });

  it("tanımsız seçimi de null'a düşürür", () => {
    expect(petAgeToBirthDate("y999", TODAY)).toBeNull();
  });

  it("ürettiği her tarih geçmişte kalır (pets_birth_date_check)", () => {
    for (const option of PET_AGE_OPTIONS) {
      const iso = petAgeToBirthDate(option.value, TODAY);
      if (iso === null) continue;
      expect(new Date(iso).getTime()).toBeLessThanOrEqual(TODAY.getTime());
    }
  });
});

describe("birthDateToPetAge", () => {
  it("kayıtlı tarihi en yakın seçeneğe geri yükler", () => {
    expect(birthDateToPetAge("2023-08-04", TODAY)).toBe("y3");
    expect(birthDateToPetAge("2026-05-04", TODAY)).toBe("m0_6");
  });

  it("tarih yoksa bilinmiyor döner", () => {
    expect(birthDateToPetAge(null, TODAY)).toBe(PET_AGE_UNKNOWN);
    expect(birthDateToPetAge("saçma", TODAY)).toBe(PET_AGE_UNKNOWN);
  });

  it("çok yaşlı peti üst kovaya toplar", () => {
    expect(birthDateToPetAge("2004-01-01", TODAY)).toBe("y16plus");
  });

  it("gidiş-dönüş seçimi korur", () => {
    for (const option of PET_AGE_OPTIONS) {
      const iso = petAgeToBirthDate(option.value, TODAY);
      expect(birthDateToPetAge(iso, TODAY)).toBe(option.value);
    }
  });
});
