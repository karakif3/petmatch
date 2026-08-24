import { mapPetRow } from "./discovery";
import { requireSupabaseClient } from "./supabase.client";
import type { Pet } from "../domain/types";

/**
 * Eşleşilen bir petin tam profili.
 *
 * Yeni bir RPC YOK ve gerekmiyor: `pets_select_matched` ve `pet_photos_select`
 * politikaları (`0006`) eşleşilen sahibin petlerini zaten okutuyor
 * (`visible_pet_ids()` = kendi petlerin + eşleştiğin sahiplerin petleri).
 * Bu yüzden buradaki iki sorgu RLS'in izin verdiğinden fazlasını göremez —
 * eşleşme kalkarsa sorgu boş döner, ekran da "artık görünmüyor" der.
 *
 * Sahip bilgisi BURADA YOK, bilerek: onun görünürlük kuralı ayrı bir yerde
 * (`get_conversation_owner_profile`, `0023`) ve konuşmaya bağlı. İkisini tek
 * sorguda birleştirmek, iki farklı görünürlük kuralını tek yere yapıştırmak
 * olurdu.
 */
export async function loadPetProfile(petId: string): Promise<Pet | null> {
  const sb = requireSupabaseClient();

  const { data: row, error } = await sb
    .from("pets")
    .select("*")
    .eq("id", petId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;

  const { data: photos, error: photosError } = await sb
    .from("pet_photos")
    .select("storage_path")
    .eq("pet_id", petId)
    .order("position");
  if (photosError) throw photosError;

  return mapPetRow(
    row,
    (photos ?? []).map((photo) => photo.storage_path),
  );
}
