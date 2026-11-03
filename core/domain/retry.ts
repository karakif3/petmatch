import { isPermanentError } from "./error-message";

/**
 * Geçici hatada kısa, artan bekleyişlerle tekrar dener; kalıcı hatada
 * (yetki, kısıt, iş kuralı, hız sınırı) hemen fırlatır.
 *
 * React Query dışındaki kritik açılış okumaları için (ör. hesap durumu):
 * orada tek bir geçici hata tüm uygulamayı hata ekranına düşürüyordu.
 */
export async function retryTransient<T>(
  task: () => Promise<T>,
  options: {
    delaysMs?: readonly number[];
    sleep?: (ms: number) => Promise<void>;
  } = {},
): Promise<T> {
  const delays = options.delaysMs ?? [800, 1600];
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      if (attempt >= delays.length || isPermanentError(error)) throw error;
      await sleep(delays[attempt]);
    }
  }
}
