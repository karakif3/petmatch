import { describe, expect, it } from "vitest";

import {
  APP_OPEN_SESSION_GAP_MS,
  funnelConversions,
  outgoingMessageContext,
  shouldTrackAppOpen,
} from "./funnel";

const me = "me";
const them = "them";

describe("outgoingMessageContext", () => {
  it("boş konuşmada ilk mesaj, yanıt değil", () => {
    expect(outgoingMessageContext([], me, false)).toEqual({ is_first: true, is_reply: false });
  });

  it("karşı taraf yazmışsa ilk mesaj aynı zamanda yanıt", () => {
    expect(outgoingMessageContext([{ senderId: them }], me, false)).toEqual({
      is_first: true,
      is_reply: true,
    });
  });

  it("son mesaj benimse yanıt değil, ilk de değil", () => {
    expect(
      outgoingMessageContext([{ senderId: them }, { senderId: me }], me, false),
    ).toEqual({ is_first: false, is_reply: false });
  });

  it("daha eski sayfa varken ilk mesaj iddia edilmez", () => {
    expect(outgoingMessageContext([{ senderId: them }], me, true)).toEqual({
      is_first: false,
      is_reply: true,
    });
  });
});

describe("shouldTrackAppOpen", () => {
  it("ilk açılış her zaman sayılır", () => {
    expect(shouldTrackAppOpen(null, 1_000)).toBe(true);
  });

  it("oturum aralığından kısa dönüş sayılmaz", () => {
    expect(shouldTrackAppOpen(0, APP_OPEN_SESSION_GAP_MS - 1)).toBe(false);
  });

  it("aralık dolunca yeni açılış", () => {
    expect(shouldTrackAppOpen(0, APP_OPEN_SESSION_GAP_MS)).toBe(true);
  });
});

describe("funnelConversions", () => {
  it("önceki adıma ve en üste göre oran", () => {
    const rows = funnelConversions([
      { key: "signed_up", count: 40 },
      { key: "email_confirmed", count: 30 },
      { key: "onboarded", count: 15 },
    ]);
    expect(rows.map((row) => [row.label, row.fromPrevious, row.fromTop])).toEqual([
      ["Kaydoldu", null, null],
      ["E-postayı onayladı", 75, 75],
      ["Profili tamamladı", 50, 38],
    ]);
  });

  it("önceki adım sıfırsa oran yok", () => {
    const rows = funnelConversions([
      { key: "signed_up", count: 0 },
      { key: "email_confirmed", count: 0 },
    ]);
    expect(rows[1].fromPrevious).toBeNull();
    expect(rows[1].fromTop).toBeNull();
  });
});
