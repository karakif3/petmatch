import type { ProfileCompletionInput } from "../domain/profile-completion";
import { requireSupabaseClient } from "./supabase.client";

/**
 * Profil tamamlama kartının verisi.
 *
 * Kullanıcı kendi profilini ve kendi aktif petini okuyor; ek bir RPC'ye
 * gerek yok, mevcut RLS zaten bu iki satırı veriyor.
 */
export async function loadProfileCompletion(
  userId: string,
): Promise<ProfileCompletionInput | null> {
  const sb = requireSupabaseClient();

  const [{ data: profile, error: profileError }, { data: pet, error: petError }] =
    await Promise.all([
      sb
        .from("profiles")
        .select("avatar_url,bio,interests")
        .eq("id", userId)
        .maybeSingle(),
      sb
        .from("pets")
        .select("breed,birth_date,bio,details_completed_at")
        .eq("owner_id", userId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle(),
    ]);

  if (profileError) throw profileError;
  if (petError) throw petError;

  // Aktif pet yoksa gösterilecek bir tamamlama da yok.
  if (!pet) return null;

  return {
    petBreed: pet.breed,
    petBirthDate: pet.birth_date,
    petBio: pet.bio,
    petDetailsCompletedAt: pet.details_completed_at,
    ownerAvatarUrl: profile?.avatar_url ?? null,
    ownerBio: profile?.bio ?? null,
    ownerInterests: profile?.interests ?? [],
  };
}
