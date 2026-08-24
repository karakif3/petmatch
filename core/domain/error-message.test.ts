import { describe, expect, it } from "vitest";

import { errorMessage } from "./error-message";

const FALLBACK = "Mesaj gönderilemedi.";

describe("errorMessage", () => {
  it("gerçek Error nesnesinden mesajı alır", () => {
    expect(errorMessage(new Error("Ağ yok"), FALLBACK)).toBe("Ağ yok");
  });

  it("Supabase PostgrestError'ından mesajı ÇIKARIR", () => {
    // Asıl mesele bu: PostgrestError bir Error örneği değil, düz nesne.
    const postgrest = {
      message: "new row violates row-level security policy",
      details: null,
      hint: null,
      code: "42501",
    };
    expect(errorMessage(postgrest, FALLBACK)).toBe(
      "new row violates row-level security policy (42501)",
    );
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
