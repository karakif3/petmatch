const AUTH_ERROR_RULES: [RegExp, string][] = [
  [/invalid login credentials|invalid credentials/i, "E-posta veya şifre hatalı."],
  [/email not confirmed|email.*not.*verified/i, "E-posta adresini doğrulamalısın."],
  [/user already registered|already been registered/i, "Bu e-posta ile zaten bir hesap var."],
  [/password should be at least|weak password/i, "Şifre en az 6 karakter olmalı."],
  [/expired.*(token|otp)|(token|otp).*expired/i, "Bağlantının süresi dolmuş. Yeni bir bağlantı iste."],
  [/invalid.*(token|otp)|(token|otp).*invalid/i, "Bağlantı geçersiz veya daha önce kullanılmış."],
  [/rate limit|too many requests|over_request_rate_limit/i, "Çok fazla deneme yapıldı. Biraz bekleyip yeniden dene."],
  [/network|fetch failed|failed to fetch/i, "İnternet bağlantını kontrol edip yeniden dene."],
  [/same password|different from the old password/i, "Yeni şifre önceki şifrenden farklı olmalı."],
];

export function translateAuthError(error: unknown): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  for (const [pattern, translation] of AUTH_ERROR_RULES) {
    if (pattern.test(message)) return translation;
  }

  return "İşlem tamamlanamadı. Lütfen yeniden dene.";
}
