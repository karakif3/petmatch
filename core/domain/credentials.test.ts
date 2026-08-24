import { describe, expect, it } from "vitest";

import { isAcceptablePassword, isValidEmail, passwordRules } from "./credentials";

describe("isValidEmail", () => {
  it("kabul edilebilir adresleri geçirir", () => {
    expect(isValidEmail("pet@petmatch.app")).toBe(true);
    expect(isValidEmail("  luna.sahibi@mail.co  ")).toBe(true);
  });

  it("yaygın yazım hatalarını yakalar", () => {
    expect(isValidEmail("petmatch.app")).toBe(false);
    expect(isValidEmail("pet@petmatch")).toBe(false);
    expect(isValidEmail("pet @petmatch.app")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("passwordRules", () => {
  it("her kural için ayrı sonuç döner", () => {
    expect(passwordRules("kisa1").map((rule) => rule.passed)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it("harf ve rakam içeren uzun şifreyi kabul eder", () => {
    expect(isAcceptablePassword("lunavepasa7")).toBe(true);
  });

  it("yalnız rakamdan oluşan şifreyi reddeder", () => {
    expect(isAcceptablePassword("12345678")).toBe(false);
  });
});
