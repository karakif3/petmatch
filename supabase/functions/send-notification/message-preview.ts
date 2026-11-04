/**
 * Mesaj push'unun içeriği. Saf: Deno'ya bağımlı değil, vitest'le test ediliyor.
 *
 * Kilit ekranı tek satır gösteriyor; uzun mesaj kesilip "…" ile bitiyor,
 * satır sonları boşluğa iniyor (iOS ilk satırdan sonrasını gizliyor).
 */
export const MESSAGE_PREVIEW_MAX = 80;

export const ANONYMOUS_MESSAGE_PUSH = {
  title: "Yeni mesaj",
  body: "PetMatch’te yeni bir mesajın var.",
} as const;

export function messagePreviewText(body: string, max = MESSAGE_PREVIEW_MAX): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  // Kelime ortasında kesmemek için son boşluğa geri çekil (çok gerideyse kes).
  const cut = flat.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

export function messagePushContent(input: {
  previewEnabled: boolean;
  senderLabel: string | null;
  body: string;
}): { title: string; body: string } {
  const label = input.senderLabel?.trim();
  if (!input.previewEnabled || !label) return { ...ANONYMOUS_MESSAGE_PUSH };
  const preview = messagePreviewText(input.body);
  return { title: label, body: preview || ANONYMOUS_MESSAGE_PUSH.body };
}
