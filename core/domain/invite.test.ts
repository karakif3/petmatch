import { describe, expect, it } from "vitest";

import { INVITE_FALLBACK_HINT, inviteMessage } from "./invite";

describe("inviteMessage", () => {
  it("boş destede pet adıyla ve bağlantıyla", () => {
    const text = inviteMessage({
      surface: "discovery_empty",
      petName: "Luna",
      url: "https://example.com/petmatch",
    });
    expect(text.startsWith("Luna için oyun arkadaşı arıyoruz")).toBe(true);
    expect(text.endsWith("https://example.com/petmatch")).toBe(true);
  });

  it("bağlantı yoksa mağazada aratmayı söyler", () => {
    const text = inviteMessage({ surface: "profile", url: "  " });
    expect(text.endsWith(INVITE_FALLBACK_HINT)).toBe(true);
  });

  it("bekleme listesinde istenen konumu anar", () => {
    expect(inviteMessage({ surface: "waitlist", location: "Kadıköy" })).toContain(
      "Kadıköy bölgesinde",
    );
    expect(inviteMessage({ surface: "waitlist", location: null })).toContain(
      "bölgemizde",
    );
  });
});
