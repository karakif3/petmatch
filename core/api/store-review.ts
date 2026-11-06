import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

import {
  shouldRequestStoreReview,
  STORE_REVIEW_DELAY_MS,
} from "../domain/store-review";
import { trackProductEvent } from "./observability";

const storageKey = (userId: string) => `petmatch:store-review-requested:${userId}`;

/**
 * Buluşma geri bildiriminden sonra, uygunsa sistemin puan penceresini ister.
 *
 * Hiçbir koşulda hata fırlatmaz: puan istemi kozmetik, cevabın kaydını
 * bozmamalı. Yerel modül eski bir geliştirme istemcisinde yoksa sessizce
 * geçer. Sistem pencereyi göstermeyebilir (kota) — bunu bilemiyoruz;
 * olay "istendi"yi ölçüyor, "gösterildi"yi değil.
 */
export async function maybeRequestStoreReview(input: {
  userId: string;
  outcome: "met" | "not_yet" | "declined";
}): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const alreadyRequested = Boolean(await AsyncStorage.getItem(storageKey(input.userId)));
    if (!shouldRequestStoreReview({ outcome: input.outcome, alreadyRequested })) return;

    const StoreReview = await import("expo-store-review");
    if (!(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return;

    await AsyncStorage.setItem(storageKey(input.userId), new Date().toISOString());
    await new Promise((resolve) => setTimeout(resolve, STORE_REVIEW_DELAY_MS));
    await StoreReview.requestReview();
    void trackProductEvent("store_review_requested");
  } catch (error) {
    console.warn("Mağaza puanı istenemedi:", error);
  }
}
