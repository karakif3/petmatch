/**
 * Fotoğraf yüklemesinin saf kuralları.
 *
 * 2026-10-24 incelemesi: fotoğraflar yalnız `quality: 0.85` ile, tam
 * çözünürlükte (12 MB'a kadar) ve SIRAYLA yükleniyordu — onboarding'in en
 * yavaş adımı ve egress maliyetinin ana kalemi. Kart en fazla ekran
 * genişliğinde (~1290 px fiziksel) gösteriliyor; uzun kenarda 1600 px tam
 * ekran lightbox için bile yeterli.
 */

/** Uzun kenar sınırı. Lightbox'ta 3x ekranda bile keskin kalır. */
export const UPLOAD_MAX_EDGE = 1600;

/** JPEG kalitesi. 0.8 üstünde boyut hızla artar, fark gözle seçilmez. */
export const UPLOAD_JPEG_QUALITY = 0.8;

/** Aynı anda en fazla bu kadar yükleme: hücresel ağda bant genişliğini boğmaz. */
export const UPLOAD_CONCURRENCY = 3;

/**
 * Uzun kenarı `maxEdge`'e indiren yeni boyut; zaten küçükse null (büyütme
 * yok — küçük fotoğrafı büyütmek boyutu artırıp kaliteyi düşürür).
 */
export function fitWithin(
  width: number,
  height: number,
  maxEdge: number = UPLOAD_MAX_EDGE,
): { width: number; height: number } | null {
  if (!(width > 0) || !(height > 0)) return null;
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return null;
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * `items`'ı en fazla `limit` eşzamanlı işle eşler; sonuç sırası girdiyle
 * aynı (fotoğraf sırası = profil sırası). Her öğenin sonucu ayrı ayrı
 * döner ki çağıran başarılı yüklemeleri hata durumunda temizleyebilsin.
 */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      try {
        results[index] = { status: "fulfilled", value: await worker(items[index], index) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  });
  await Promise.all(lanes);
  return results;
}
