import { create } from "zustand";

import type { PushPromptSource } from "../core/domain/push-prompt";

/**
 * Push izni ön ekranı tek bir yerden (kök layout) çizilir; ekranlar yalnız
 * "şimdi sorulabilir" sinyali verir. Karar (gösterilsin mi) ev sahibinde,
 * `core/domain/push-prompt.ts` kurallarıyla alınır.
 */
type PushPromptStore = {
  pending: PushPromptSource | null;
  request: (source: PushPromptSource) => void;
  clear: () => void;
};

export const usePushPromptStore = create<PushPromptStore>((set) => ({
  pending: null,
  request: (source) => set((state) => (state.pending ? state : { pending: source })),
  clear: () => set({ pending: null }),
}));

export function requestPushPrompt(source: PushPromptSource): void {
  usePushPromptStore.getState().request(source);
}
