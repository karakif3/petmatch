/** Doğum tarihinden yaş (yıl, ondalıklı). Tarih yoksa null. */
export function ageInYears(birthDate: string | null, now = new Date()): number | null {
  if (!birthDate) return null;

  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;

  const ms = now.getTime() - born.getTime();
  if (ms < 0) return null;

  return ms / (365.25 * 24 * 60 * 60 * 1000);
}

/** "8 aylık" / "3 yaşında" gibi kullanıcıya gösterilecek metin. */
export function formatAge(birthDate: string | null, now = new Date()): string | null {
  const years = ageInYears(birthDate, now);
  if (years === null) return null;

  if (years < 1) {
    const months = Math.max(1, Math.round(years * 12));
    return `${months} aylık`;
  }

  return `${Math.floor(years)} yaşında`;
}
