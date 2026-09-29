import {
  mapDiscoveryRow,
  ownerSummary,
  signOwnerAvatars,
  type DiscoveryDeckCard,
} from "./discovery";
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
 * "Kim beğendi" iki ayrı SECURITY DEFINER fonksiyon çağrısında yaşıyor:
 * sayı her zaman gerçek, kartlar karşılıklı beğeni öncesi anonimleştirilmek
 * üzere istemciye gelir. Gerçek bir satın alma akışı eklenene kadar bu yüzey
 * ücretli özellik veya yaklaşan ödeme duvarı vaat etmez.
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

  const signedAvatars = await signOwnerAvatars(rows ?? []);
  const owners = await Promise.all(
    (rows ?? []).map((row) => ownerSummary(row, [], signedAvatars)),
  );
  return (rows ?? []).map((row, index) => ({
    card: { ...mapDiscoveryRow(row), owner: owners[index], isSuper: row.is_super },
    likedAt: row.liked_at,
  }));
}

/**
 * Beğeniler ekranından karar verebilmek için oturum sahibinin aktif peti.
 * Keşfet destesini (ağır RPC) yüklemeden tek satır.
 */
export async function loadMyActivePetId(userId: string): Promise<string | null> {
  const { data, error } = await requireSupabaseClient()
    .from("pets")
    .select("id")
    .eq("owner_id", userId)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}
