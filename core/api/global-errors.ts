/**
 * Render dışındaki JS hatalarını da kütüğe yazar.
 *
 * `AppErrorBoundary` yalnızca render sırasındaki hataları yakalıyor; olay
 * işleyicisinde, zamanlayıcıda ya da async akışta fırlayan hata uygulamayı
 * kapatıyor ama hiçbir yerde görünmüyordu. React Native'in global
 * işleyicisine zincirlenir: önceki işleyici (LogBox / kırmızı ekran /
 * üretimde çökme) aynen çalışmaya devam eder.
 *
 * Native çökmeler (JS'e hiç dönmeyenler) bunun kapsamı DIŞINDA — onlar için
 * harici bir sağlayıcı (Sentry vb.) gerekiyor; bkz. docs/backlog.md.
 */
import { captureClientError } from "./observability";

type GlobalHandler = (error: unknown, isFatal?: boolean) => void;
type ErrorUtilsShape = {
  getGlobalHandler: () => GlobalHandler;
  setGlobalHandler: (handler: GlobalHandler) => void;
};

let installed = false;

export function installGlobalErrorCapture() {
  const errorUtils = (globalThis as { ErrorUtils?: ErrorUtilsShape }).ErrorUtils;
  if (installed || !errorUtils) return;
  installed = true;

  const previous = errorUtils.getGlobalHandler();
  errorUtils.setGlobalHandler((error, isFatal) => {
    void captureClientError(error, isFatal ? "global:fatal" : "global").catch(() => undefined);
    previous(error, isFatal);
  });
}
