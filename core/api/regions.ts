/**
 * Pilot bölgeler.
 *
 * `profiles.city` serbest metin ve öyle kalıyor — şehir hâlâ kullanıcıya
 * gösterilen bilgi. Bölge ise ÖLÇÜLEBİLİR anahtar: pilotun tüm amacı iki
 * mahalleyi karşılaştırmak ve "İstanbul" / "istanbul" / "Kadıköy/İstanbul"
 * aynı sorguda toplanmıyor (bkz. docs/launch.md).
 */
import { requireSupabaseClient } from "./supabase.client";

export type Region = {
  slug: string;
  name: string;
  city: string | null;
  isPilot: boolean;
};

export async function listRegions(): Promise<Region[]> {
  const { data, error } = await requireSupabaseClient()
    .from("regions")
    .select("slug,name,city,is_pilot,sort_order")
    .eq("is_active", true)
    .order("sort_order");
  if (error) throw error;

  return (data ?? []).map((row) => ({
    slug: row.slug,
    name: row.name,
    city: row.city,
    isPilot: row.is_pilot,
  }));
}

/**
 * Bölge seçimi.
 *
 * "Diğer" de gerçek bir seçim: seçmemiş olmakla (null) aynı şey değil.
 * "Diğer" diyenlerin sayısı, bir sonraki pilot bölgeyi tahminle değil veriyle
 * seçmenin tek yolu.
 */
export async function setMyRegion(
  regionSlug: string,
  options?: { requestedLocation?: string; notifyWhenOpen?: boolean },
): Promise<void> {
  const { error } = await requireSupabaseClient().rpc("set_my_region", {
    p_region_slug: regionSlug,
    p_requested_location: options?.requestedLocation?.trim() || (null as unknown as string),
    p_notify_when_open: options?.notifyWhenOpen ?? false,
  });
  if (error) throw error;
}
