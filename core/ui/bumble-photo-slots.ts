export type SlotFrame = { x: number; y: number; w: number; h: number };

/** Bumble ızgarası: kapak 2 sütun, 2-3 sağda, kalanlar alt sırada. */
export function bumblePhotoFrames(
  slotCount: number,
  width: number,
  coverAspect: number,
  gap: number,
): { frames: SlotFrame[]; height: number } {
  const cols = 3;
  const col = (width - gap * (cols - 1)) / cols;
  const mainW = col * 2 + gap;
  const mainH = mainW / coverAspect;
  const sideH = (mainH - gap) / 2;
  const frames: SlotFrame[] = [];

  if (slotCount >= 1) frames.push({ x: 0, y: 0, w: mainW, h: mainH });
  if (slotCount >= 2) frames.push({ x: mainW + gap, y: 0, w: col, h: sideH });
  if (slotCount >= 3) frames.push({ x: mainW + gap, y: sideH + gap, w: col, h: sideH });

  const bottomY = mainH + gap;
  const leftover = slotCount - 3;
  if (leftover === 1) {
    frames.push({ x: 0, y: bottomY, w: mainW, h: col });
  } else {
    const bottomCols = leftover === 2 ? 2 : cols;
    const bottomW = (width - gap * (bottomCols - 1)) / bottomCols;
    for (let i = 3; i < slotCount; i++) {
      const k = i - 3;
      frames.push({
        x: (k % bottomCols) * (bottomW + gap),
        y: bottomY + Math.floor(k / bottomCols) * (bottomW + gap),
        w: bottomW,
        h: bottomW,
      });
    }
  }

  const height = frames.reduce((max, frame) => Math.max(max, frame.y + frame.h), 0);
  return { frames, height };
}

export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function nearestFilledSlot(
  cx: number,
  cy: number,
  frames: SlotFrame[],
  filledCount: number,
): number {
  let best = 0;
  let bestDist = Number.POSITIVE_INFINITY;
  const limit = Math.max(0, Math.min(filledCount, frames.length));
  for (let i = 0; i < limit; i++) {
    const frame = frames[i];
    const dx = cx - (frame.x + frame.w / 2);
    const dy = cy - (frame.y + frame.h / 2);
    const dist = dx * dx + dy * dy;
    if (dist < bestDist) {
      bestDist = dist;
      best = i;
    }
  }
  return best;
}
