import type { Coordinates } from "./types";

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** İki koordinat arası kuş uçuşu mesafe (km). */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) *
      Math.cos(toRadians(b.latitude)) *
      Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Konumu kabaca yuvarlar — tam adres sızmasın diye keşfet ekranında
 * gösterilen mesafeler bu yuvarlanmış değerden hesaplanır.
 * ~0.01 derece ≈ 1.1 km.
 */
export function coarsenCoordinates(coords: Coordinates, precision = 2): Coordinates {
  const factor = 10 ** precision;
  return {
    latitude: Math.round(coords.latitude * factor) / factor,
    longitude: Math.round(coords.longitude * factor) / factor,
  };
}

/** "1 km'den yakın" / "3 km" gibi kullanıcıya gösterilecek metin. */
export function formatDistance(km: number): string {
  if (km < 1) return "1 km'den yakın";
  return `${Math.round(km)} km`;
}
