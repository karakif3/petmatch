/** YYYY-AA-GG metnini takvimde gerçekten var olan yerel bir tarihe çevirir. */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/** Date → "YYYY-AA-GG". Saklama biçimi her yerde bu. */
export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * "YYYY-AA-GG" → "GG.AA.YYYY".
 *
 * Saklama ISO kalıyor ama kullanıcıya Türkçe okunuşuyla gösteriliyor;
 * eski serbest metin alanı kullanıcıdan ISO sırasında yazmasını isteyerek
 * okuduğu sıranın tersini dayatıyordu.
 */
export function formatIsoDateForDisplay(value: string): string | null {
  const date = parseIsoDate(value);
  if (!date) return null;
  const day = `${date.getDate()}`.padStart(2, "0");
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${day}.${month}.${date.getFullYear()}`;
}

/** 18 yaşını doldurmuş sayılmak için gereken en geç doğum tarihi. */
export function adultCutoffDate(today = new Date()): Date {
  return new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
}

export function isAdultDate(value: string, today = new Date()): boolean {
  const birthDate = parseIsoDate(value);
  if (!birthDate) return false;

  return birthDate <= adultCutoffDate(today);
}

export function isPastOrTodayDate(value: string, today = new Date()): boolean {
  const date = parseIsoDate(value);
  if (!date) return false;

  const endOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
    23,
    59,
    59,
    999,
  );
  return date <= endOfToday;
}
