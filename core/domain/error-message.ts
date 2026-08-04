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

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return text(error.message) ?? fallback;

  if (error && typeof error === "object") {
    const candidate = error as MaybePostgrestError;
    const message = text(candidate.message);
    const details = text(candidate.details);
    const code = text(candidate.code);

    if (message) {
      // Kod, aynı mesajı veren farklı sebepleri ayırt etmeye yarıyor
      // (örn. 42501 yetki, 23505 tekrar eden kayıt).
      return code ? `${message} (${code})` : message;
    }
    if (details) return code ? `${details} (${code})` : details;
  }

  return text(error) ?? fallback;
}
