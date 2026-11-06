/**
 * Mağaza puanı istemi (backlog: "Mağaza puanı istemi").
 *
 * Doğru an: kullanıcı "Buluştunuz mu?" sorusuna "Buluştuk" dedi — ürünün
 * vaadini gerçekten yaşadığı an. Rastgele açılışta sormak düşük puan ve
 * boşa harcanmış kota demek (iOS yılda en fazla 3 kez gösteriyor).
 *
 * Kullanıcı başına BİR kez: iOS zaten sınırlıyor ama Android'in kotası
 * belirsiz; ikinci sormak rahatsız eder.
 */
export function shouldRequestStoreReview(input: {
  outcome: "met" | "not_yet" | "declined";
  alreadyRequested: boolean;
}): boolean {
  return input.outcome === "met" && !input.alreadyRequested;
}

/** Cevabın onayı görünsün, sistem penceresi hemen üstüne binmesin. */
export const STORE_REVIEW_DELAY_MS = 1500;
