import { describe, expect, it } from "vitest";

import { UNDO_PASS_WINDOW_MS, undoPassRemainingMs } from "./undo-pass";

describe("undoPassRemainingMs", () => {
  it("son geç yoksa gösterilmez", () => {
    expect(undoPassRemainingMs(null, 1_000)).toBe(0);
  });

  it("pencere içinde kalan süreyi verir", () => {
    expect(undoPassRemainingMs({ toPetId: "p", at: 1_000 }, 4_000)).toBe(
      UNDO_PASS_WINDOW_MS - 3_000,
    );
  });

  it("pencere dolunca 0", () => {
    expect(undoPassRemainingMs({ toPetId: "p", at: 0 }, UNDO_PASS_WINDOW_MS)).toBe(0);
    expect(undoPassRemainingMs({ toPetId: "p", at: 0 }, UNDO_PASS_WINDOW_MS + 5)).toBe(0);
  });
});
