import type { SwipeDirection } from "../domain/types";

export type DecisionPending = "pass" | "like" | "super";

/** Spinner yalnızca bekleyen karara düşer; geç beklerken kalp dönmesin. */
export function swipePendingAction(
  isPending: boolean,
  variables?: { direction: SwipeDirection; isSuper?: boolean },
): DecisionPending | null {
  if (!isPending || !variables) return null;
  if (variables.isSuper) return "super";
  return variables.direction === "pass" ? "pass" : "like";
}
