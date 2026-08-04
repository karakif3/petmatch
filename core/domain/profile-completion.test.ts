import { describe, expect, it } from "vitest";

import {
  completionRatio,
  missingProfileItems,
  type ProfileCompletionInput,
} from "./profile-completion";

const EMPTY: ProfileCompletionInput = {
  petBreed: null,
  petBirthDate: null,
  petBio: null,
  petDetailsCompletedAt: null,
  ownerAvatarUrl: null,
  ownerBio: null,
};

const FULL: ProfileCompletionInput = {
  petBreed: "Tekir",
  petBirthDate: "2023-08-04",
  petBio: "Sakin ama oyuncu.",
  petDetailsCompletedAt: "2026-08-04T09:00:00Z",
  ownerAvatarUrl: "abc/avatar.jpg",
  ownerBio: "Kadıköy'de yaşıyorum.",
};

describe("missingProfileItems", () => {
  it("yeni kayıt olmuş kullanıcıda hepsi eksik", () => {
    expect(missingProfileItems(EMPTY)).toHaveLength(6);
  });

  it("tamamlanmış profilde kart hiç çıkmaz", () => {
    expect(missingProfileItems(FULL)).toEqual([]);
  });

  it("eşleşmeyi iyileştirenleri öne alır", () => {
    const items = missingProfileItems(EMPTY);
    expect(items[0].improvesMatching).toBe(true);
    expect(items.at(-1)?.improvesMatching).toBe(false);
  });

  it("sadece boşluktan ibaret metni dolu saymaz", () => {
    const keys = missingProfileItems({ ...FULL, petBio: "   " }).map((i) => i.key);
    expect(keys).toContain("petBio");
  });

  it("varsayılanla gelen pet ayrıntısını eksik sayar", () => {
    // 0040'ın varlık sebebi: size/energy dolu ama kullanıcı seçmemiş.
    const keys = missingProfileItems({
      ...FULL,
      petDetailsCompletedAt: null,
    }).map((item) => item.key);
    expect(keys).toEqual(["petDetails"]);
  });
});

describe("completionRatio", () => {
  it("uçları doğru veriyor", () => {
    expect(completionRatio(EMPTY)).toBe(0);
    expect(completionRatio(FULL)).toBe(1);
  });

  it("kısmi doluluğu oranlıyor", () => {
    expect(completionRatio({ ...EMPTY, ownerBio: "merhaba" })).toBeCloseTo(1 / 6);
  });
});
