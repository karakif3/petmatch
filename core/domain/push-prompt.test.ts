import { describe, expect, it } from "vitest";

import {
  decidePushPrompt,
  EMPTY_PUSH_PROMPT_HISTORY,
  markPushPromptShown,
  parsePushPromptHistory,
  PUSH_PROMPT_MIN_GAP_MS,
} from "./push-prompt";

const NOW = new Date("2026-10-31T10:00:00Z");
const ASKABLE = { status: "undetermined" as const, canAskAgain: true };

describe("decidePushPrompt", () => {
  it("izin yokken ilk oturumda gösterir", () => {
    expect(
      decidePushPrompt({
        permission: ASKABLE,
        source: "first_session",
        history: EMPTY_PUSH_PROMPT_HISTORY,
        now: NOW,
      }),
    ).toEqual({ show: true });
  });

  it("izin zaten verilmişse göstermez", () => {
    expect(
      decidePushPrompt({
        permission: { status: "granted", canAskAgain: false },
        source: "first_session",
        history: EMPTY_PUSH_PROMPT_HISTORY,
        now: NOW,
      }),
    ).toEqual({ show: false, reason: "already-granted" });
  });

  it("kalıcı reddedilmişse göstermez — Ayarlar yolu Profil'de", () => {
    expect(
      decidePushPrompt({
        permission: { status: "denied", canAskAgain: false },
        source: "first_match",
        history: EMPTY_PUSH_PROMPT_HISTORY,
        now: NOW,
      }),
    ).toEqual({ show: false, reason: "cannot-ask-again" });
  });

  it("Android'de 'denied' ama tekrar sorulabilirse gösterir", () => {
    expect(
      decidePushPrompt({
        permission: { status: "denied", canAskAgain: true },
        source: "first_session",
        history: EMPTY_PUSH_PROMPT_HISTORY,
        now: NOW,
      }).show,
    ).toBe(true);
  });

  it("aynı kaynak için ikinci kez göstermez", () => {
    const history = markPushPromptShown(EMPTY_PUSH_PROMPT_HISTORY, "first_session", NOW);
    expect(
      decidePushPrompt({
        permission: ASKABLE,
        source: "first_session",
        history,
        now: new Date(NOW.getTime() + 10 * PUSH_PROMPT_MIN_GAP_MS),
      }),
    ).toEqual({ show: false, reason: "source-already-shown" });
  });

  it("ilk oturumda 'şimdi değil' denince aynı gün eşleşmede tekrar sormaz", () => {
    const history = markPushPromptShown(EMPTY_PUSH_PROMPT_HISTORY, "first_session", NOW);
    expect(
      decidePushPrompt({
        permission: ASKABLE,
        source: "first_match",
        history,
        now: new Date(NOW.getTime() + 2 * 60 * 60 * 1000),
      }),
    ).toEqual({ show: false, reason: "too-soon" });
  });

  it("ertesi gün ilk eşleşmede yeniden sorar — en motive an", () => {
    const history = markPushPromptShown(EMPTY_PUSH_PROMPT_HISTORY, "first_session", NOW);
    expect(
      decidePushPrompt({
        permission: ASKABLE,
        source: "first_match",
        history,
        now: new Date(NOW.getTime() + PUSH_PROMPT_MIN_GAP_MS + 1),
      }),
    ).toEqual({ show: true });
  });
});

describe("parsePushPromptHistory", () => {
  it("boş, bozuk ve yabancı girdilerde boş tarihçe döner", () => {
    expect(parsePushPromptHistory(null)).toEqual(EMPTY_PUSH_PROMPT_HISTORY);
    expect(parsePushPromptHistory("{bozuk")).toEqual(EMPTY_PUSH_PROMPT_HISTORY);
    expect(parsePushPromptHistory('{"shownAt":"x"}')).toEqual(EMPTY_PUSH_PROMPT_HISTORY);
    expect(parsePushPromptHistory('{"shownAt":{"first_session":5}}')).toEqual(
      EMPTY_PUSH_PROMPT_HISTORY,
    );
  });

  it("geçerli tarihçeyi gidiş-dönüş korur", () => {
    const history = markPushPromptShown(EMPTY_PUSH_PROMPT_HISTORY, "first_match", NOW);
    expect(parsePushPromptHistory(JSON.stringify(history))).toEqual(history);
  });
});
