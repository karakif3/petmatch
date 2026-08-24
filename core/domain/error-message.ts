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

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = text(error.message);
    if (!message) return fallback;
    return isNetworkFailure(message) ? NETWORK_FAILURE_MESSAGE : message;
  }

  if (error && typeof error === "object") {
    const candidate = error as MaybePostgrestError;
    const message = text(candidate.message);
    const details = text(candidate.details);
    const code = text(candidate.code);

    if (message) {
      if (isNetworkFailure(message)) return NETWORK_FAILURE_MESSAGE;
      // Kod, aynı mesajı veren farklı sebepleri ayırt etmeye yarıyor
      // (örn. 42501 yetki, 23505 tekrar eden kayıt).
      return code ? `${message} (${code})` : message;
    }
    if (details) return code ? `${details} (${code})` : details;
  }

  return text(error) ?? fallback;
}
