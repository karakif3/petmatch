import { describe, expect, it } from "vitest";

import { bumblePhotoFrames, moveItem, nearestFilledSlot } from "./bumble-photo-slots";

describe("bumblePhotoFrames", () => {
  it("keeps every slot inside the editor width", () => {
    const { frames, height } = bumblePhotoFrames(6, 353, 3 / 4, 8);
    expect(frames).toHaveLength(6);
    expect(frames.every((frame) => frame.x >= 0 && frame.x + frame.w <= 353.01)).toBe(
      true,
    );
    expect(frames[0].w).toBeGreaterThan(frames[1].w);
    expect(frames[1].x).toBeGreaterThan(frames[0].x);
    expect(frames[2].y).toBeGreaterThan(frames[1].y);
    expect(frames[3].y).toBeGreaterThan(frames[0].h);
    expect(height).toBeGreaterThan(frames[0].h);
  });

  it("sizes a single leftover cell under the cover, not a 1/3-width orphan", () => {
    const { frames, height } = bumblePhotoFrames(4, 353, 1, 8);
    expect(frames).toHaveLength(4);
    expect(frames[3].w).toBeCloseTo(frames[0].w);
    expect(frames[3].x).toBe(0);
    expect(height).toBeCloseTo(frames[3].y + frames[3].h);
  });

  it("uses cover height when only two slots exist", () => {
    const { frames, height } = bumblePhotoFrames(2, 353, 3 / 4, 8);
    expect(height).toBeCloseTo(frames[0].h);
    expect(height).toBeGreaterThan(frames[1].h);
  });
});

describe("moveItem", () => {
  it("promotes a later photo to cover", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
});

describe("nearestFilledSlot", () => {
  it("drops onto the cover when the finger is over it", () => {
    const { frames } = bumblePhotoFrames(6, 353, 3 / 4, 8);
    expect(nearestFilledSlot(frames[0].w / 2, frames[0].h / 2, frames, 3)).toBe(0);
    expect(
      nearestFilledSlot(frames[2].x + frames[2].w / 2, frames[2].y + frames[2].h / 2, frames, 3),
    ).toBe(2);
  });
});
