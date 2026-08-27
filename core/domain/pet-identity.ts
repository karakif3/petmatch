/**
 * Pet kimliği: ad her zaman düzeltilir; tür/cinsiyet kayıtta kilitlenir.
 *
 * Kota sunucuda (`0067`, 6 ay). Bu dosya aynı eşiği istemcide gösterir —
 * kilitli çipleri ne zaman açacağını ve tarihi nasıl yazacağını bilir.
 * Karar burada verilmez; RPC/trigger reddeder.
 */

export const SPECIES_GENDER_COOLDOWN_MONTHS = 6;

export function speciesGenderUnlockAt(
  changedAtIso: string,
  now = new Date(),
): Date {
  const changed = new Date(changedAtIso);
  const unlock = new Date(changed);
  unlock.setMonth(unlock.getMonth() + SPECIES_GENDER_COOLDOWN_MONTHS);
  if (Number.isNaN(unlock.getTime())) return now;
  return unlock;
}

export function canChangeSpeciesGender(
  changedAtIso: string,
  now = new Date(),
): boolean {
  return now.getTime() >= speciesGenderUnlockAt(changedAtIso, now).getTime();
}
