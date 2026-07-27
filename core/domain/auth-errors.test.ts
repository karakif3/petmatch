import { describe, expect, it } from "vitest";

import { translateAuthError } from "./auth-errors";

describe("translateAuthError", () => {
  it.each([
    ["Invalid login credentials", "E-posta veya şifre hatalı."],
    ["Email not confirmed", "E-posta adresini doğrulamalısın."],
    ["User already registered", "Bu e-posta ile zaten bir hesap var."],
    ["Password should be at least 6 characters", "Şifre en az 6 karakter olmalı."],
    ["Token has expired", "Bağlantının süresi dolmuş. Yeni bir bağlantı iste."],
    ["Failed to fetch", "İnternet bağlantını kontrol edip yeniden dene."],
  ])("%s mesajını Türkçeleştirir", (source, expected) => {
    expect(translateAuthError(new Error(source))).toBe(expected);
  });

  it("bilinmeyen sunucu ayrıntısını kullanıcıya sızdırmaz", () => {
    expect(translateAuthError(new Error("internal auth detail"))).toBe(
      "İşlem tamamlanamadı. Lütfen yeniden dene.",
    );
  });
});
