import { describe, expect, it } from "vitest";

import { intlLocale, resolveAppLocale } from "./locale";

describe("locale resolution", () => {
  it("supports regional Turkish tags", () => {
    expect(resolveAppLocale("tr-TR")).toBe("tr");
    expect(resolveAppLocale("TR_tr")).toBe("tr");
  });

  it("falls back to Turkish until another catalog is fully released", () => {
    expect(resolveAppLocale("en-US")).toBe("tr");
    expect(resolveAppLocale(null)).toBe("tr");
  });

  it("provides an Intl-compatible locale", () => {
    expect(intlLocale("tr")).toBe("tr-TR");
    expect(intlLocale("en")).toBe("en-US");
  });
});
