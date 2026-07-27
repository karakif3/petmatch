/**
 * Supabase bağlantı ayarları — env'den okunur, hiçbir yerde proje ref'i
 * hard-code edilmez. Böylece başka bir Supabase hesabına/projesine taşımak
 * yalnızca `.env` değiştirmek demek.
 *
 * Hem Expo (`EXPO_PUBLIC_*`) hem de ileride eklenecek Next.js web app'i
 * (`NEXT_PUBLIC_*`) aynı fonksiyonu kullanabilsin diye ikisi de okunuyor.
 */

export type SupabaseConfig = {
  url: string;
  anonKey: string;
};

function firstNonEmpty(...values: (string | undefined)[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
  }
  return null;
}

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = firstNonEmpty(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const anonKey = firstNonEmpty(
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  if (!url || !anonKey) return null;

  return { url, anonKey };
}

/** Storage bucket adları — migration'larda da aynısı kullanılır. */
export const STORAGE_BUCKETS = {
  petPhotos: "pet-photos",
  ownerAvatars: "owner-avatars",
} as const;
