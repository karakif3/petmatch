/**
 * Bekleme listesindeki serbest metin talebi ("Beşiktaş", "besiktas/istanbul")
 * açık bir pilot bölgeyle eşleşiyor mu?
 *
 * Sunucudaki `normalize_location` + `region_opening_recipients` (20261103)
 * ile aynı kural: Türkçe harfler katlanır, bölge adı YA DA şehri geçerse
 * eşleşir. Burası yalnız bekleme ekranındaki "bölgen açıldı" ipucunu
 * besler; kime bildirim gideceğine sunucu karar verir.
 */

const FOLD: Record<string, string> = {
  ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
};

export function normalizeLocation(text: string): string {
  return text
    .trim()
    .toLocaleLowerCase("tr-TR")
    .replace(/[çğıöşüâîû]/g, (char) => FOLD[char] ?? char);
}

export function locationMatchesRegion(
  requestedLocation: string,
  region: { name: string; city: string | null },
): boolean {
  const requested = normalizeLocation(requestedLocation);
  if (!requested) return false;
  if (requested.includes(normalizeLocation(region.name))) return true;
  return Boolean(region.city) && requested.includes(normalizeLocation(region.city!));
}

/** Talebe uyan ilk açık pilot bölge; yoksa null. */
export function findOpenedRegion<T extends { name: string; city: string | null; isPilot: boolean }>(
  requestedLocation: string | null | undefined,
  regions: T[],
): T | null {
  if (!requestedLocation) return null;
  return regions.find((region) => region.isPilot && locationMatchesRegion(requestedLocation, region)) ?? null;
}
