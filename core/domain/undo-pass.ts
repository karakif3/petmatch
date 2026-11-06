/**
 * "Geç"i geri alma penceresi. İstemci düğmeyi bu kadar gösteriyor; sunucu
 * (`undo_pass`) ağ gecikmesi payıyla 30 sn kabul ediyor.
 */
export const UNDO_PASS_WINDOW_MS = 10_000;

export type LastPass = { toPetId: string; at: number };

/** Geri alma düğmesinin kalan süresi (ms); 0 = gösterme. */
export function undoPassRemainingMs(lastPass: LastPass | null, now: number): number {
  if (!lastPass) return 0;
  return Math.max(0, lastPass.at + UNDO_PASS_WINDOW_MS - now);
}
