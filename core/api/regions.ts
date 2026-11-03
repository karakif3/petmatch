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

export type RegionOpeningRecipient = {
  userId: string;
  requestedLocation: string;
  alreadyNotified: boolean;
};

/** Moderatör: bu pilot bölge için "haber ver" diyen bekleme listesi. */
export async function loadRegionOpeningRecipients(
  regionSlug: string,
): Promise<RegionOpeningRecipient[]> {
  const { data, error } = await requireSupabaseClient().rpc("region_opening_recipients", {
    p_region_slug: regionSlug,
  });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    userId: row.user_id,
    requestedLocation: row.requested_location,
    alreadyNotified: row.already_notified,
  }));
}

/**
 * Moderatör: bölge açılış push'unu gönderir. Alıcıları Edge Function aynı
 * RPC'den alır; daha önce bildirilenler tekilleştirmeyle atlanır, bu
 * yüzden tekrar basmak güvenli.
 */
export async function notifyRegionOpened(
  regionSlug: string,
): Promise<{ sent: number; skipped: number; duplicate: number }> {
  const { data, error } = await requireSupabaseClient().functions.invoke(
    "send-notification",
    { body: { type: "region_opened", regionSlug } },
  );
  if (error) throw error;
  const statuses: string[] = Array.isArray(data?.status) ? data.status : [];
  return {
    sent: statuses.filter((status) => status === "sent").length,
    skipped: statuses.filter((status) => status === "skipped").length,
    duplicate: statuses.filter((status) => status === "duplicate").length,
  };
}

export async function loadMyRegionWaitlist(): Promise<{
  requestedLocation: string;
  notifyWhenOpen: boolean;
  updatedAt: string;
} | null> {
  const { data, error } = await requireSupabaseClient()
    .from("region_waitlist")
    .select("requested_location,notify_when_open,updated_at")
    .maybeSingle();
  if (error) throw error;
  return data
    ? {
        requestedLocation: data.requested_location,
        notifyWhenOpen: data.notify_when_open,
        updatedAt: data.updated_at,
      }
    : null;
}
