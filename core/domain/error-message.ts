/**
 * Bilinmeyen bir hatadan kullanıcıya gösterilebilir metin çıkarır.
 *
 * Gerekçe: **Supabase'in `PostgrestError`'ı bir `Error` örneği DEĞİL** — düz
 * bir nesne (`{ message, details, hint, code }`). Kod tabanında yaygın olan
 *
 *     error instanceof Error ? error.message : "Bir şeyler ters gitti"
 *
 * kalıbı bu yüzden her veritabanı hatasında yedek metne düşüyordu. Sonuç:
 * RLS reddi, kısıt ihlali ve ağ hatası kullanıcıya birebir aynı cümleyle
 * görünüyor, geliştirici de logda hiçbir şey bulamıyor.
 *
 * Sohbet ekranındaki "Mesaj gönderilemedi." hatası tam olarak buydu: mesaj
 * gerçekten gönderilemiyordu ama SEBEBİ hiçbir yerde görünmüyordu.
 */

type MaybePostgrestError = {
  message?: unknown;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
};

/**
 * Ağ hatası, mobilde en sık karşılaşılan hata ve ham hâliyle kullanıcıya
 * `TypeError: Network request failed` olarak görünüyordu — İngilizce,
 * teknik ve **ne yapılacağını söylemiyor.** React Native'in `fetch`'i
 * bağlantı kopukluğunda bu `TypeError`'ı, tarayıcı ortamı ise
 * "Failed to fetch" atıyor; ikisi de aynı şeyi anlatıyor.
 *
 * Burada çevrilmesinin sebebi: bu bir SEBEP değil DURUM. Diğer hatalarda
 * (RLS reddi, kısıt ihlali) sunucunun mesajını göstermek geliştiriciye de
 * kullanıcıya da bilgi veriyor; ağ hatasında gösterilecek bir sebep yok.
 */
const NETWORK_FAILURE_PATTERNS = [
  "network request failed",
  "failed to fetch",
  "the internet connection appears to be offline",
];

const NETWORK_FAILURE_MESSAGE =
  "Bağlantı kurulamadı. İnternetini kontrol edip tekrar dene.";

function isNetworkFailure(message: string): boolean {
  const normalized = message.toLowerCase();
  return NETWORK_FAILURE_PATTERNS.some((pattern) => normalized.includes(pattern));
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Sunucunun kasıtlı reddettiği, kullanıcının ne yapacağını bildiğimiz
 * durumlar. Ham metinleri İngilizce ve teknik (`rate_limited:messages`,
 * RLS reddi); bunlar DURUM, gösterilecek bir sebep değil — ağ hatası gibi.
 * Listede olmayanlar eskisi gibi sunucu mesajı + kodla gösterilir.
 */
const RATE_LIMIT_MESSAGES: Record<string, string> = {
  messages: "Çok hızlı mesaj gönderiyorsun. Biraz bekleyip tekrar dene.",
  swipes: "Çok hızlı karar veriyorsun. Biraz bekleyip tekrar dene.",
  super_likes: "Bugünkü süper beğeni hakkın doldu. Yarın tekrar dene.",
  reports: "Kısa sürede çok fazla şikâyet gönderdin. Biraz sonra tekrar dene.",
};

const RATE_LIMIT_FALLBACK = "Çok hızlı işlem yapıyorsun. Biraz bekleyip tekrar dene.";

const KNOWN_MESSAGES: { pattern: RegExp; message: string }[] = [
  { pattern: /owner must be 18 or older/i, message: "PetMatch 18 yaş ve üzeri içindir." },
  { pattern: /jwt expired/i, message: "Oturumunun süresi doldu. Tekrar giriş yap." },
];

const KNOWN_CODES: Record<string, string> = {
  "42501": "Bu işlem için yetkin yok. Oturumun sona ermiş olabilir; tekrar giriş yapmayı dene.",
  "23505": "Bu kayıt zaten var.",
  PGRST301: "Oturumunun süresi doldu. Tekrar giriş yap.",
};

function knownMessage(message: string, code: string | null): string | null {
  if (isNetworkFailure(message)) return NETWORK_FAILURE_MESSAGE;
  const rateLimit = /rate_limited:(\w+)/.exec(message);
  if (rateLimit) return RATE_LIMIT_MESSAGES[rateLimit[1]] ?? RATE_LIMIT_FALLBACK;
  const known = KNOWN_MESSAGES.find(({ pattern }) => pattern.test(message));
  if (known) return known.message;
  return code ? (KNOWN_CODES[code] ?? null) : null;
}

/** Hız sınırına takılan istek — tekrar denemek sorunu büyütür. */
export function isRateLimited(error: unknown): boolean {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === "object"
        ? text((error as MaybePostgrestError).message)
        : null;
  return Boolean(message && message.includes("rate_limited:"));
}

/**
 * Tekrar denemenin sonucu değiştirmeyeceği hatalar: yetki/kısıt reddi
 * (42xxx, 23xxx, 22xxx), iş kuralı (P0001), PostgREST istek hatası ve hız
 * sınırı. Bunları tekrar denemek yalnızca kullanıcıyı bekletir.
 */
export function isPermanentError(error: unknown): boolean {
  if (isRateLimited(error)) return true;
  if (!error || typeof error !== "object") return false;
  const { code, status } = error as { code?: unknown; status?: unknown };
  if (typeof code === "string" && /^(42|23|22|P0|PGRST)/.test(code)) return true;
  return typeof status === "number" && status >= 400 && status < 500;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = text(error.message);
    if (!message) return fallback;
    return knownMessage(message, null) ?? message;
  }

  if (error && typeof error === "object") {
    const candidate = error as MaybePostgrestError;
    const message = text(candidate.message);
    const details = text(candidate.details);
    const code = text(candidate.code);

    if (message) {
      const known = knownMessage(message, code);
      if (known) return known;
      // Kod, aynı mesajı veren farklı sebepleri ayırt etmeye yarıyor
      // (örn. 42501 yetki, 23505 tekrar eden kayıt).
      return code ? `${message} (${code})` : message;
    }
    if (details) return code ? `${details} (${code})` : details;
  }

  return text(error) ?? fallback;
}
