import { describe, expect, it } from "vitest";

import { fitWithin, mapWithConcurrency, UPLOAD_MAX_EDGE } from "./image-upload";

describe("fitWithin", () => {
  it("dikey 12 MP fotoğrafı uzun kenarda sınıra indirir, oranı korur", () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 1200, height: UPLOAD_MAX_EDGE });
  });

  it("yatay fotoğrafta genişliği sınırlar", () => {
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it("zaten küçükse ya da tam sınırdaysa dokunmaz — büyütme yok", () => {
    expect(fitWithin(1080, 1350)).toBeNull();
    expect(fitWithin(1600, 900)).toBeNull();
  });

  it("geçersiz boyutta null döner", () => {
    expect(fitWithin(0, 100)).toBeNull();
    expect(fitWithin(Number.NaN, 100)).toBeNull();
  });
});

describe("mapWithConcurrency", () => {
  it("sırayı korur ve eşzamanlılığı sınırlar", async () => {
    let running = 0;
    let peak = 0;
    const results = await mapWithConcurrency([30, 5, 20, 1, 10], 2, async (delay, index) => {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, delay));
      running -= 1;
      return index;
    });
    expect(peak).toBe(2);
    expect(results.map((result) => (result.status === "fulfilled" ? result.value : -1))).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  it("bir öğe düşse de diğerlerinin sonucunu döndürür", async () => {
    const results = await mapWithConcurrency(["a", "b", "c"], 3, async (item) => {
      if (item === "b") throw new Error("ağ");
      return item.toUpperCase();
    });
    expect(results[0]).toEqual({ status: "fulfilled", value: "A" });
    expect(results[1].status).toBe("rejected");
    expect(results[2]).toEqual({ status: "fulfilled", value: "C" });
  });

  it("boş listede hemen döner", async () => {
    expect(await mapWithConcurrency([], 3, async () => 1)).toEqual([]);
  });
});
