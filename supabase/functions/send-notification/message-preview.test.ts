import { describe, expect, it } from "vitest";

import {
  ANONYMOUS_MESSAGE_PUSH,
  MESSAGE_PREVIEW_MAX,
  messagePreviewText,
  messagePushContent,
} from "./message-preview";

describe("messagePreviewText", () => {
  it("kısa mesaj olduğu gibi, satır sonları boşluğa iner", () => {
    expect(messagePreviewText("Selam!\n\nParkta  mısınız?")).toBe("Selam! Parkta mısınız?");
  });

  it("uzun mesaj kelime sınırında kesilir ve sınırı aşmaz", () => {
    const long = "Yarın sabah Maçka Parkı'nda buluşalım mı, Luna çok enerjik bugün ve ".repeat(3);
    const preview = messagePreviewText(long);
    expect(preview.endsWith("…")).toBe(true);
    expect(preview.length).toBeLessThanOrEqual(MESSAGE_PREVIEW_MAX);
    expect(preview.slice(0, -1).endsWith(" ")).toBe(false);
  });

  it("boşluksuz uzun metin sert kesilir", () => {
    expect(messagePreviewText("a".repeat(200))).toBe(`${"a".repeat(MESSAGE_PREVIEW_MAX - 1)}…`);
  });
});

describe("messagePushContent", () => {
  it("önizleme açıkken başlık gönderen, gövde mesaj", () => {
    expect(
      messagePushContent({ previewEnabled: true, senderLabel: "Luna", body: "Merhaba!" }),
    ).toEqual({ title: "Luna", body: "Merhaba!" });
  });

  it("önizleme kapalıyken adsız metin", () => {
    expect(
      messagePushContent({ previewEnabled: false, senderLabel: "Luna", body: "Merhaba!" }),
    ).toEqual(ANONYMOUS_MESSAGE_PUSH);
  });

  it("gönderen adı bulunamazsa adsız metin", () => {
    expect(
      messagePushContent({ previewEnabled: true, senderLabel: "  ", body: "Merhaba!" }),
    ).toEqual(ANONYMOUS_MESSAGE_PUSH);
  });
});
