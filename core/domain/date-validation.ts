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

export function isAdultDate(value: string, today = new Date()): boolean {
  const birthDate = parseIsoDate(value);
  if (!birthDate) return false;

  const cutoff = new Date(
    today.getFullYear() - 18,
    today.getMonth(),
    today.getDate(),
  );
  return birthDate <= cutoff;
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
