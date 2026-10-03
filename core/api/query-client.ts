/**
 * Uygulamanın tek QueryClient'ı.
 *
 * Neden modül düzeyinde (root layout'un içinde değil): oturum değişince
 * önbelleği auth store temizliyor. Anahtarların çoğu kullanıcıya göre
 * ayrılmamış (`["conversations"]`, `["messages", id]`); aynı cihazda başka
 * hesapla giriş yapan kişi `staleTime` boyunca öncekinin konuşmalarını
 * görebiliyordu.
 */
import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { isPermanentError, isRateLimited } from "../domain/error-message";
import { captureClientError } from "./observability";

function isNetworkError(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object"
        ? String((error as { message?: unknown }).message ?? "")
        : "";
  return /network request failed|failed to fetch|offline/i.test(message);
}

/**
 * Sorgu ve mutation hataları eskiden hiçbir yere raporlanmıyordu
 * (`captureClientError` yalnız 3 yerde çağrılıyordu). Ağ kopukluğu ve hız
 * sınırı hata değil durum — kütüğü doldurmasın.
 */
function report(error: unknown, route: string) {
  if (isNetworkError(error) || isRateLimited(error)) return;
  void captureClientError(error, route).catch(() => undefined);
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => report(error, `query:${String(query.queryKey[0])}`),
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) =>
      report(error, `mutation:${String(mutation.options.mutationKey?.[0] ?? "anonim")}`),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => failureCount < 1 && !isPermanentError(error),
    },
  },
});
