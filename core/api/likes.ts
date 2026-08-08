import { mapDiscoveryRow, ownerSummary, type DiscoveryDeckCard } from "./discovery";
import { requireSupabaseClient } from "./supabase.client";

/** Uyum skoru yok — henüz beğenilmiş, karşılaştırılacak bir kart değil. */
export type PendingLikeCard = Omit<DiscoveryDeckCard, "compatibility"> & {
  /** Kilitli kartta bile görünür — kimlik değil, "bu beğeni özel" sinyali. */
  isSuper: boolean;
};

export type PendingLike = {
  card: PendingLikeCard;
  likedAt: string;
};

/**
 * "Kim beğendi" — monetization.md'deki katman ayrımı burada, iki ayrı
 * SECURITY DEFINER fonksiyon çağrısında yaşıyor: sayı her zaman gerçek,
 * kartlar bugün için de erişilebilir (ödeme altyapısı yok, Faz 0). İstemci
 * tarafı "ücretsiz" görünümü kartları bulanıklaştırarak simüle ediyor —
 * bkz. `components/pending-like-card.tsx`.
 */
export async function loadPendingLikesCount(): Promise<number> {
  const { data, error } = await requireSupabaseClient().rpc("pending_likes_count");
  if (error) throw error;
  return data ?? 0;
}

export async function loadPendingLikes(): Promise<PendingLike[]> {
  const sb = requireSupabaseClient();
  const { data: rows, error } = await sb.rpc("pending_likes", { p_limit: 50 });
  if (error) throw error;

  const owners = await Promise.all((rows ?? []).map(ownerSummary));
  return (rows ?? []).map((row, index) => ({
    card: { ...mapDiscoveryRow(row), owner: owners[index], isSuper: row.is_super },
    likedAt: row.liked_at,
  }));
}
