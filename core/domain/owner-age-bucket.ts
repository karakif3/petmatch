/**
 * Sahip yaşı istemciye kesin yıl olarak çıkmaz. Sunucu `owner_age_bucket()`
 * ile aynı kovaları üretir (`0022`): 18–24, 25–29, sonra on yıl.
 *
 * Önizleme sunucuyu taklit etmek zorunda — "karşı taraf ne görüyor"
 * kutusunda kova yoksa kullanıcı public seçince yaşın gizlendiğini sanır.
 */

export function ownerAgeBucket(
  birthDateIso: string | null | undefined,
  today = new Date(),
): string | null {
  if (!birthDateIso) return null;
  const born = new Date(`${birthDateIso.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(born.getTime())) return null;

  let years = today.getFullYear() - born.getFullYear();
  const hadBirthday =
    today.getMonth() > born.getMonth() ||
    (today.getMonth() === born.getMonth() && today.getDate() >= born.getDate());
  if (!hadBirthday) years -= 1;
  if (years < 18) return null;
  if (years <= 24) return "18–24 yaş";
  if (years <= 29) return "25–29 yaş";
  return `${Math.floor(years / 10) * 10}'lu yaşlar`;
}

/** Kartta görünen kova değişti mi — ilk kez doldurmak onay istemez. */
export function ownerAgeBucketChanged(
  previousIso: string | null | undefined,
  nextIso: string | null | undefined,
  today = new Date(),
): boolean {
  const previous = ownerAgeBucket(previousIso, today);
  const next = ownerAgeBucket(nextIso, today);
  return Boolean(previous && next && previous !== next);
}
