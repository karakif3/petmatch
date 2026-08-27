import { describe, expect, it } from "vitest";

import { swipePendingAction } from "./decision-pending";

describe("swipePendingAction", () => {
  it("beklerken spinner'ı kalbe kilitlemez", () => {
    expect(swipePendingAction(false, { direction: "like" })).toBeNull();
    expect(swipePendingAction(true)).toBeNull();
    expect(swipePendingAction(true, { direction: "pass" })).toBe("pass");
    expect(swipePendingAction(true, { direction: "like" })).toBe("like");
    expect(
      swipePendingAction(true, { direction: "like", isSuper: true }),
    ).toBe("super");
  });
});
