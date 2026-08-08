/**
 * Pet yaşı: tarih değil, yaş sorulur.
 *
 * Kayıt akışı petin doğum tarihini tam olarak istiyordu. Türkiye'de sokaktan
 * sahiplenme yaygın ve sahiplenen kişi doğum tarihini çoğu zaman bilmiyor;
 * bilse bile "2 yaşında" diye hatırlıyor, "2024-03-15" diye değil. Tam tarih
 * istemek bu kullanıcıyı ya yanlış veri girmeye ya da alanı boş bırakmaya
 * itiyordu — ikisi de kötü.
 *
 * Burada yaş kovaları saklanmıyor; seçim `pets.birth_date`'e YAKLAŞIK bir
 * tarihe çevriliyor. Böylece keşfet kartı, eşleşme skoru ve yaş filtresi
 * dahil mevcut hiçbir tüketici değişmiyor — hepsi birth_date okumaya devam
 * ediyor.
 *
 * "Bilmiyorum" gerçek bir seçenek ve `null` yazıyor: uydurma bir tarih
 * üretmek, kullanıcının bilmediği bir şeyi biliyormuş gibi göstermek olurdu.
 */

import { toIsoDate } from "./date-validation";

export type PetAgeOption = {
  value: string;
  label: string;
  /** Seçimin ortasına denk gelen ay sayısı. null = bilinmiyor. */
  approximateMonths: number | null;
};

export const PET_AGE_UNKNOWN = "unknown";

export const PET_AGE_OPTIONS: PetAgeOption[] = [
  { value: PET_AGE_UNKNOWN, label: "Bilmiyorum", approximateMonths: null },
  { value: "m0_6", label: "0-6 ay", approximateMonths: 3 },
  { value: "m6_12", label: "6-12 ay", approximateMonths: 9 },
  ...Array.from({ length: 15 }, (_, index) => {
    const years = index + 1;
    return {
      value: `y${years}`,
      label: `${years} yaş`,
      approximateMonths: years * 12,
    };
  }),
  { value: "y16plus", label: "16+ yaş", approximateMonths: 16 * 12 },
];

/** Seçilen yaş → yaklaşık doğum tarihi (ISO). Bilinmiyorsa null. */
export function petAgeToBirthDate(value: string, today = new Date()): string | null {
  const option = PET_AGE_OPTIONS.find((item) => item.value === value);
  if (!option || option.approximateMonths === null) return null;

  const born = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  born.setMonth(born.getMonth() - option.approximateMonths);
  return toIsoDate(born);
}

/**
 * Kayıtlı doğum tarihi → en yakın yaş seçeneği.
 *
 * Profil düzenlemede mevcut peti bu kontrole geri yüklemek için gerekiyor;
 * yoksa kullanıcı her açtığında seçim boş görünürdü.
 */
export function birthDateToPetAge(birthDate: string | null, today = new Date()): string {
  if (!birthDate) return PET_AGE_UNKNOWN;

  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return PET_AGE_UNKNOWN;

  const months =
    (today.getFullYear() - born.getFullYear()) * 12 +
    (today.getMonth() - born.getMonth());
  if (months < 0) return PET_AGE_UNKNOWN;

  let closest = PET_AGE_OPTIONS[1];
  for (const option of PET_AGE_OPTIONS) {
    if (option.approximateMonths === null) continue;
    const best = closest.approximateMonths ?? Number.POSITIVE_INFINITY;
    if (Math.abs(option.approximateMonths - months) < Math.abs(best - months)) {
      closest = option;
    }
  }
  return closest.value;
}
