/** Kayıt/giriş formlarının gönderim öncesi doğrulaması. */

export const MIN_PASSWORD_LENGTH = 8;

/**
 * Sunucuya gitmeden yakalanabilecek yazım hatalarını ayıklar.
 *
 * Amaç RFC 5322 uyumu değil; "@ yok", "nokta yok", "boşluk var" gibi
 * hataları kullanıcıya anında göstermek.
 */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export type PasswordRule = {
  id: "length" | "letter" | "number";
  label: string;
  passed: boolean;
};

/**
 * Yeni şifreler için canlı geri bildirim kuralları.
 *
 * ⚠️ Bunlar YALNIZCA yeni şifre belirlerken (kayıt · şifre sıfırlama)
 * uygulanır. GİRİŞ formunda uygulanmaz: Supabase'in sunucu tarafı asgarisi
 * 6 ve daha önce 6-7 karakterle açılmış hesaplar var. Giriş formunda bu
 * kuralı dayatmak, kullanıcıyı DOĞRU şifresiyle kendi hesabından kilitler.
 */
export function passwordRules(password: string): PasswordRule[] {
  return [
    {
      id: "length",
      label: `En az ${MIN_PASSWORD_LENGTH} karakter`,
      passed: password.length >= MIN_PASSWORD_LENGTH,
    },
    { id: "letter", label: "En az bir harf", passed: /\p{L}/u.test(password) },
    { id: "number", label: "En az bir rakam", passed: /\d/.test(password) },
  ];
}

export function isAcceptablePassword(password: string): boolean {
  return passwordRules(password).every((rule) => rule.passed);
}
