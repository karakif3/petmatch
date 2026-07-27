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
 * Konumu ~1 km'lik ızgaraya oturtur (0.01 derece ≈ 1.1 km).
 *
 * Sunucuda `snap_pet_location` trigger'ı aynısını yapıyor — bu, konumu
 * göndermeden önceki ilk savunma katmanı. Ham GPS hiçbir zaman ağa çıkmamalı.
 */
export function coarsenCoordinates(coords: Coordinates, precision = 2): Coordinates {
  const factor = 10 ** precision;
  return {
    latitude: Math.round(coords.latitude * factor) / factor,
    longitude: Math.round(coords.longitude * factor) / factor,
  };
}

/**
 * Mesafe kovaları — `discover_pets` bu değerleri döndürür, ham km değil.
 *
 * Sürekli ondalık mesafe üçgenlemeye açıktır: saldırgan kendi konumunu üç
 * noktaya taşıyıp aynı hedefi ölçerse evini bulur. SQL tarafındaki
 * `distance_bucket()` ile sınırlar birebir aynı olmalı.
 */
export const DISTANCE_BUCKETS = ["<1", "1-3", "3-5", "5-10", "10-25", "25+"] as const;
export type DistanceBucket = (typeof DISTANCE_BUCKETS)[number];

export function distanceBucket(km: number | null): DistanceBucket | null {
  if (km === null) return null;
  if (km < 1) return "<1";
  if (km < 3) return "1-3";
  if (km < 5) return "3-5";
  if (km < 10) return "5-10";
  if (km < 25) return "10-25";
  return "25+";
}
