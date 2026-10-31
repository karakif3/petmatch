/**
 * Push izni ön ekranı (pre-prompt) ne zaman gösterilir?
 *
 * Sistem izni iOS'ta tek seferliktir: kullanıcı bir kez "İzin verme" derse
 * uygulama bir daha soramaz, yalnız Ayarlar'a yönlendirebilir. Bu yüzden
 * sistem penceresinden önce gerekçeli bir ekran gösterip "Şimdi değil"
 * diyene sistem penceresini hiç açmıyoruz — hak yanmıyor.
 *
 * 2026-10-24 incelemesi: izin yalnız Profil'deki anahtar değiştirilince ya da
 * boş destede "haber ver"e basılınca isteniyordu; tipik kullanıcı hiç
 * sorulmuyordu ve eşleşme/mesaj push'ı kimseye gitmiyordu.
 */

export type PushPermissionStatus = "granted" | "denied" | "undetermined";

export type PushPromptSource = "first_session" | "first_match";

export type PushPromptHistory = {
  /** Kaynak başına son gösterim zamanı (ISO). */
  shownAt: Partial<Record<PushPromptSource, string>>;
};

export const EMPTY_PUSH_PROMPT_HISTORY: PushPromptHistory = { shownAt: {} };

/** İki ön ekran arasında en az bu kadar beklenir — aynı gün iki kez sorulmaz. */
export const PUSH_PROMPT_MIN_GAP_MS = 24 * 60 * 60 * 1000;

export type PushPromptDecision =
  | { show: true }
  | {
      show: false;
      reason:
        | "already-granted"
        | "cannot-ask-again"
        | "source-already-shown"
        | "too-soon";
    };

export function decidePushPrompt(input: {
  permission: { status: PushPermissionStatus; canAskAgain: boolean };
  source: PushPromptSource;
  history: PushPromptHistory;
  now: Date;
}): PushPromptDecision {
  const { permission, source, history, now } = input;

  if (permission.status === "granted") return { show: false, reason: "already-granted" };
  // Kalıcı red: sistem penceresi bir daha açılmaz, ön ekran da anlamsız.
  // Profil'deki "Ayarlar'ı aç" satırı bu durumu karşılar.
  if (permission.status === "denied" && !permission.canAskAgain) {
    return { show: false, reason: "cannot-ask-again" };
  }
  if (history.shownAt[source]) return { show: false, reason: "source-already-shown" };

  const lastShown = Object.values(history.shownAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => new Date(value).getTime())
    .filter((time) => Number.isFinite(time));
  if (lastShown.length > 0 && now.getTime() - Math.max(...lastShown) < PUSH_PROMPT_MIN_GAP_MS) {
    return { show: false, reason: "too-soon" };
  }

  return { show: true };
}

export function markPushPromptShown(
  history: PushPromptHistory,
  source: PushPromptSource,
  now: Date,
): PushPromptHistory {
  return { shownAt: { ...history.shownAt, [source]: now.toISOString() } };
}

/** AsyncStorage'dan gelen ham değeri güvenle tarihçeye çevirir. */
export function parsePushPromptHistory(raw: string | null): PushPromptHistory {
  if (!raw) return EMPTY_PUSH_PROMPT_HISTORY;
  try {
    const parsed = JSON.parse(raw) as { shownAt?: unknown };
    if (!parsed || typeof parsed !== "object" || typeof parsed.shownAt !== "object" || !parsed.shownAt) {
      return EMPTY_PUSH_PROMPT_HISTORY;
    }
    const shownAt: PushPromptHistory["shownAt"] = {};
    for (const source of ["first_session", "first_match"] as const) {
      const value = (parsed.shownAt as Record<string, unknown>)[source];
      if (typeof value === "string") shownAt[source] = value;
    }
    return { shownAt };
  } catch {
    return EMPTY_PUSH_PROMPT_HISTORY;
  }
}
