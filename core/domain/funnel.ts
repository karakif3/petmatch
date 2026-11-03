/**
 * Huni olaylarının istemci tarafı kararları (20261104120000).
 *
 * Saf tutuldu: ekran bileşenleri sadece sonucu `trackProductEvent`'e veriyor.
 */

type MessageLike = { senderId: string };

/**
 * Gönderilmek üzere olan mesajın huni bağlamı.
 *
 * - `is_reply`: konuşmadaki son mesaj karşı taraftan — yani bu bir yanıt.
 * - `is_first`: kullanıcının bu konuşmadaki ilk mesajı. Mesajlar sayfalı
 *   geldiği için yalnızca TÜM geçmiş yüklüyken kesin; daha eski sayfa varsa
 *   ve yüklü olanlarda kullanıcının mesajı yoksa `false` sayılır (ilk mesaj
 *   oranını şişirmemek için ihtiyatlı taraf).
 *
 * `history` eskiden yeniye sıralı olmalı.
 */
export function outgoingMessageContext(
  history: readonly MessageLike[],
  senderId: string,
  hasOlderMessages: boolean,
): { is_first: boolean; is_reply: boolean } {
  const last = history[history.length - 1];
  const hasOwnMessage = history.some((message) => message.senderId === senderId);
  return {
    is_first: !hasOwnMessage && !hasOlderMessages,
    is_reply: Boolean(last && last.senderId !== senderId),
  };
}

/**
 * `app_opened` için oturum aralığı: arka plandan her dönüş bir "açılış"
 * değil. 30 dakikadan kısa ara aynı oturum sayılır (yaygın analitik
 * varsayılanı).
 */
export const APP_OPEN_SESSION_GAP_MS = 30 * 60 * 1000;

export function shouldTrackAppOpen(lastTrackedAt: number | null, now: number): boolean {
  return lastTrackedAt === null || now - lastTrackedAt >= APP_OPEN_SESSION_GAP_MS;
}

/** `get_signup_funnel` adımları, sunucudaki sırayla. */
export type FunnelStepKey =
  | "signed_up"
  | "email_confirmed"
  | "onboarded"
  | "swiped"
  | "matched"
  | "messaged"
  | "two_way"
  | "meetup_proposed"
  | "meetup_accepted";

export const FUNNEL_STEP_LABELS: Record<FunnelStepKey, string> = {
  signed_up: "Kaydoldu",
  email_confirmed: "E-postayı onayladı",
  onboarded: "Profili tamamladı",
  swiped: "Kaydırdı",
  matched: "Eşleşti",
  messaged: "Mesaj yazdı",
  two_way: "Karşılıklı konuştu",
  meetup_proposed: "Buluşma önerildi",
  meetup_accepted: "Buluşma kabul edildi",
};

/**
 * Her adım için önceki adıma ve en üste göre oran (0–100, tam sayı).
 * Önceki adım 0 ise oran `null` — "%0" yanlış bir kopuş sinyali verirdi.
 */
export function funnelConversions(
  steps: readonly { key: FunnelStepKey; count: number }[],
): { key: FunnelStepKey; label: string; count: number; fromPrevious: number | null; fromTop: number | null }[] {
  const top = steps[0]?.count ?? 0;
  return steps.map((step, index) => {
    const previous = index === 0 ? null : steps[index - 1].count;
    return {
      key: step.key,
      label: FUNNEL_STEP_LABELS[step.key] ?? step.key,
      count: step.count,
      fromPrevious: previous ? Math.round((step.count / previous) * 100) : null,
      fromTop: index === 0 || !top ? null : Math.round((step.count / top) * 100),
    };
  });
}
