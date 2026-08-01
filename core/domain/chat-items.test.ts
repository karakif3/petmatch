import { describe, expect, it } from "vitest";

import { buildChatItems, localDateKey, type GroupableMessage } from "./chat-items";

function message(overrides: Partial<GroupableMessage> = {}): GroupableMessage {
  return {
    id: "m1",
    senderId: "ben",
    createdAt: "2026-01-10T10:00:00Z",
    ...overrides,
  };
}

/** Yerel gün sınırına göre kurgulanmış tarih — testin makine saatinden bağımsız olması için. */
function atLocal(year: number, month: number, day: number, hour: number, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

describe("buildChatItems", () => {
  it("boş listede öğe üretmez", () => {
    expect(buildChatItems([])).toEqual([]);
  });

  it("her günün başına bir ayraç koyar", () => {
    const items = buildChatItems([
      message({ id: "a", createdAt: atLocal(2026, 1, 10, 10) }),
      message({ id: "b", createdAt: atLocal(2026, 1, 10, 11) }),
      message({ id: "c", createdAt: atLocal(2026, 1, 11, 9) }),
    ]);

    const dates = items.filter((item) => item.kind === "date");
    expect(dates).toHaveLength(2);
    expect(items[0].kind).toBe("date");
  });

  it("aynı gönderenin yakın mesajlarını gruplar", () => {
    const items = buildChatItems([
      message({ id: "a", createdAt: atLocal(2026, 1, 10, 10, 0) }),
      message({ id: "b", createdAt: atLocal(2026, 1, 10, 10, 2) }),
    ]);

    const messages = items.filter((item) => item.kind === "message");
    expect(messages[0]).toMatchObject({ id: "a", grouped: false });
    expect(messages[1]).toMatchObject({ id: "b", grouped: true });
  });

  it("5 dakikayı aşan aradan sonra gruplamayı kırar", () => {
    const items = buildChatItems([
      message({ id: "a", createdAt: atLocal(2026, 1, 10, 10, 0) }),
      message({ id: "b", createdAt: atLocal(2026, 1, 10, 10, 6) }),
    ]);

    const messages = items.filter((item) => item.kind === "message");
    expect(messages[1]).toMatchObject({ id: "b", grouped: false });
  });

  it("gönderen değişince gruplamaz", () => {
    const items = buildChatItems([
      message({ id: "a", senderId: "ben", createdAt: atLocal(2026, 1, 10, 10, 0) }),
      message({ id: "b", senderId: "karsi", createdAt: atLocal(2026, 1, 10, 10, 1) }),
    ]);

    const messages = items.filter((item) => item.kind === "message");
    expect(messages[1]).toMatchObject({ id: "b", grouped: false });
  });

  it("gün değişince, mesajlar dakikalar arayla olsa bile gruplamaz", () => {
    // Gece yarısını aşan iki mesaj: aradaki fark 2 dakika ama gün farklı.
    // Ayracın hemen altındaki balon tam köşeli görünmeli.
    const items = buildChatItems([
      message({ id: "a", createdAt: atLocal(2026, 1, 10, 23, 59) }),
      message({ id: "b", createdAt: atLocal(2026, 1, 11, 0, 1) }),
    ]);

    const messages = items.filter((item) => item.kind === "message");
    expect(messages[1]).toMatchObject({ id: "b", grouped: false });
    expect(items.filter((item) => item.kind === "date")).toHaveLength(2);
  });

  it("ayraç, o günün ilk mesajının tarihini taşır", () => {
    const iso = atLocal(2026, 1, 10, 10);
    const items = buildChatItems([message({ createdAt: iso })]);
    expect(items[0]).toMatchObject({ kind: "date", isoDate: iso });
  });
});

describe("localDateKey", () => {
  it("aynı yerel gündeki farklı saatler için aynı anahtarı üretir", () => {
    expect(localDateKey(atLocal(2026, 3, 5, 1))).toBe(localDateKey(atLocal(2026, 3, 5, 23)));
  });

  it("farklı günler için farklı anahtar üretir", () => {
    expect(localDateKey(atLocal(2026, 3, 5, 12))).not.toBe(localDateKey(atLocal(2026, 3, 6, 12)));
  });
});
