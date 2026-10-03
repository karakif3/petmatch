import { describe, expect, it } from "vitest";

import { errorMessage, isPermanentError, isRateLimited } from "./error-message";

const FALLBACK = "Mesaj gönderilemedi.";

describe("errorMessage", () => {
  it("gerçek Error nesnesinden mesajı alır", () => {
    expect(errorMessage(new Error("Ağ yok"), FALLBACK)).toBe("Ağ yok");
  });

  it("Supabase PostgrestError'ından mesajı ÇIKARIR", () => {
    // Asıl mesele bu: PostgrestError bir Error örneği değil, düz nesne.
    const postgrest = {
      message: "column \"x\" does not exist",
      details: null,
      hint: null,
      code: "42703",
    };
    expect(errorMessage(postgrest, FALLBACK)).toBe('column "x" does not exist (42703)');
  });

  it("bilinen kodları Türkçe cümleye çevirir", () => {
    const rls = {
      message: "new row violates row-level security policy",
      code: "42501",
    };
    expect(errorMessage(rls, FALLBACK)).toMatch(/yetkin yok/);
    expect(errorMessage({ message: "duplicate key", code: "23505" }, FALLBACK)).toBe(
      "Bu kayıt zaten var.",
    );
    expect(errorMessage({ message: "JWT expired", code: "PGRST301" }, FALLBACK)).toMatch(
      /Oturumunun süresi doldu/,
    );
    expect(
      errorMessage({ message: "owner must be 18 or older", code: "P0001" }, FALLBACK),
    ).toBe("PetMatch 18 yaş ve üzeri içindir.");
  });

  it("hız sınırını alanına göre çevirir ve tanır", () => {
    const superLike = { message: "rate_limited:super_likes", code: "P0001" };
    expect(errorMessage(superLike, FALLBACK)).toMatch(/süper beğeni hakkın doldu/);
    expect(errorMessage({ message: "rate_limited:messages" }, FALLBACK)).toMatch(
      /hızlı mesaj/,
    );
    expect(errorMessage({ message: "rate_limited:bilinmeyen" }, FALLBACK)).toMatch(
      /Çok hızlı işlem/,
    );
    expect(isRateLimited(superLike)).toBe(true);
    expect(isRateLimited(new Error("rate_limited:swipes"))).toBe(true);
    expect(isRateLimited({ message: "timeout" })).toBe(false);
    expect(isRateLimited(null)).toBe(false);
  });

  it("mesaj yoksa details'e düşer", () => {
    expect(errorMessage({ details: "Key is not present", code: "23503" }, FALLBACK)).toBe(
      "Key is not present (23503)",
    );
  });

  it("kod yoksa mesajı yalın verir", () => {
    expect(errorMessage({ message: "timeout" }, FALLBACK)).toBe("timeout");
  });

  it("boş ve anlamsız girdilerde yedek metne düşer", () => {
    expect(errorMessage(null, FALLBACK)).toBe(FALLBACK);
    expect(errorMessage(undefined, FALLBACK)).toBe(FALLBACK);
    expect(errorMessage({}, FALLBACK)).toBe(FALLBACK);
    expect(errorMessage(new Error(""), FALLBACK)).toBe(FALLBACK);
    expect(errorMessage({ message: "   " }, FALLBACK)).toBe(FALLBACK);
  });

  it("düz metin hatayı olduğu gibi geçirir", () => {
    expect(errorMessage("bozuk şey", FALLBACK)).toBe("bozuk şey");
  });

  /*
   * Ağ hatası simülatörde canlı olarak görüldü: profil kaydederken
   * kullanıcıya ham "TypeError: Network request failed" gösterildi.
   * En sık karşılaşılan hata ve tek İngilizce kalanı buydu.
   */
  it("ağ hatasını Türkçe ve eyleme dönük bir cümleye çevirir", () => {
    const expected = "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.";
    expect(errorMessage(new TypeError("Network request failed"), FALLBACK)).toBe(expected);
    expect(errorMessage(new Error("Failed to fetch"), FALLBACK)).toBe(expected);
    expect(errorMessage({ message: "network request failed" }, FALLBACK)).toBe(expected);
    expect(
      errorMessage(
        new Error("The Internet connection appears to be offline."),
        FALLBACK,
      ),
    ).toBe(expected);
  });

  it("ağ dışı hataları çevirmez", () => {
    expect(errorMessage(new Error("Aktif pet bulunamadı."), FALLBACK)).toBe(
      "Aktif pet bulunamadı.",
    );
  });
});

describe("isPermanentError", () => {
  it("yetki, kısıt, iş kuralı ve hız sınırı tekrar denenmez", () => {
    expect(isPermanentError({ message: "rls", code: "42501" })).toBe(true);
    expect(isPermanentError({ message: "dup", code: "23505" })).toBe(true);
    expect(isPermanentError({ message: "kural", code: "P0001" })).toBe(true);
    expect(isPermanentError({ message: "jwt", code: "PGRST301" })).toBe(true);
    expect(isPermanentError({ message: "rate_limited:swipes" })).toBe(true);
    expect(isPermanentError({ status: 404 })).toBe(true);
  });

  it("ağ ve sunucu hataları tekrar denenir", () => {
    expect(isPermanentError(new TypeError("Network request failed"))).toBe(false);
    expect(isPermanentError({ message: "timeout", code: "57014" })).toBe(false);
    expect(isPermanentError({ status: 503 })).toBe(false);
    expect(isPermanentError(null)).toBe(false);
  });
});
