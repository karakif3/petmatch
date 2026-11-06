import { describe, expect, it } from "vitest";

import { shouldRequestStoreReview } from "./store-review";

describe("shouldRequestStoreReview", () => {
  it("yalnız 'buluştuk' cevabında ve daha önce sorulmadıysa", () => {
    expect(shouldRequestStoreReview({ outcome: "met", alreadyRequested: false })).toBe(true);
  });

  it("bir kez sorulduysa bir daha sorulmaz", () => {
    expect(shouldRequestStoreReview({ outcome: "met", alreadyRequested: true })).toBe(false);
  });

  it("olumsuz ya da belirsiz cevapta sorulmaz", () => {
    expect(shouldRequestStoreReview({ outcome: "not_yet", alreadyRequested: false })).toBe(false);
    expect(shouldRequestStoreReview({ outcome: "declined", alreadyRequested: false })).toBe(false);
  });
});
