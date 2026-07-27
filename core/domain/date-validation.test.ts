import { describe, expect, it } from "vitest";

import { isAdultDate, isPastOrTodayDate, parseIsoDate } from "./date-validation";

const TODAY = new Date(2026, 6, 27);

describe("parseIsoDate", () => {
  it("gerçek ISO tarihini kabul eder", () => {
    expect(parseIsoDate("2024-02-29")).not.toBeNull();
  });

  it("takvimde olmayan ve farklı biçimdeki tarihi reddeder", () => {
    expect(parseIsoDate("2025-02-29")).toBeNull();
    expect(parseIsoDate("27.07.2026")).toBeNull();
  });
});

describe("isAdultDate", () => {
  it("tam 18 yaşındaki kullanıcıyı kabul eder", () => {
    expect(isAdultDate("2008-07-27", TODAY)).toBe(true);
  });

  it("18. doğum gününden bir gün önce reddeder", () => {
    expect(isAdultDate("2008-07-28", TODAY)).toBe(false);
  });
});

describe("isPastOrTodayDate", () => {
  it("bugünü ve geçmişi kabul edip geleceği reddeder", () => {
    expect(isPastOrTodayDate("2026-07-27", TODAY)).toBe(true);
    expect(isPastOrTodayDate("2020-01-01", TODAY)).toBe(true);
    expect(isPastOrTodayDate("2026-07-28", TODAY)).toBe(false);
  });
});
