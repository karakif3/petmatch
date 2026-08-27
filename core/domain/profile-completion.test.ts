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
  ownerInterests: [],
};

const FULL: ProfileCompletionInput = {
  petBreed: "Tekir",
  petBirthDate: "2023-08-04",
  petBio: "Sakin ama oyuncu.",
  petDetailsCompletedAt: "2026-08-04T09:00:00Z",
  ownerAvatarUrl: "abc/avatar.jpg",
  ownerBio: "Kadıköy'de yaşıyorum.",
  ownerInterests: ["walks"],
  ownerPhotoCount: 2,
};

describe("missingProfileItems", () => {
  it("yeni kayıt olmuş kullanıcıda hepsi eksik", () => {
    expect(missingProfileItems(EMPTY)).toHaveLength(7);
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

  it("tek sahip fotoğrafında bir kare daha ister", () => {
    const keys = missingProfileItems({ ...FULL, ownerPhotoCount: 1 }).map(
      (item) => item.key,
    );
    expect(keys).toEqual(["ownerExtraPhoto"]);
  });

  it("kapak yokken extra istemez", () => {
    const keys = missingProfileItems({
      ...FULL,
      ownerAvatarUrl: null,
      ownerPhotoCount: 0,
    }).map((item) => item.key);
    expect(keys).toEqual(["ownerAvatar"]);
  });

  it("alan hiç yoksa çökmez", () => {
    // Canlıda 11 çökme: ilgi alanları eklendiğinde önbellekteki eski şekilli
    // veri ownerInterests taşımıyordu ve undefined.length patlıyordu.
    const eksikAlan = { ...FULL, ownerInterests: undefined };
    expect(() => missingProfileItems(eksikAlan)).not.toThrow();
    expect(missingProfileItems(eksikAlan).map((i) => i.key)).toEqual([
      "ownerInterests",
    ]);
    expect(missingProfileItems({ ...FULL, ownerInterests: null })).toHaveLength(1);
  });
});

describe("completionRatio", () => {
  it("uçları doğru veriyor", () => {
    expect(completionRatio(EMPTY)).toBe(0);
    expect(completionRatio(FULL)).toBe(1);
  });

  it("kısmi doluluğu oranlıyor", () => {
    expect(completionRatio({ ...EMPTY, ownerBio: "merhaba" })).toBeCloseTo(1 / 7);
  });
});
