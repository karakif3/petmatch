import type { DiscoveryDeckCard } from "../core/api/discovery";
import type { Pet } from "../core/domain/types";

/**
 * Keşfet → profil geçişi.
 *
 * `/pet/[petId]` eşleşme sonrası RLS'e bağlı (`pets_select_matched`).
 * Destede zaten RPC satırı var; onu burada tutup profilin ağ atmadan
 * açılmasını sağlıyoruz. Parametre olarak kart taşımak URL'yi şişirir
 * ve signed avatar URL'lerini loga döker.
 */
export type DiscoverProfileSession = {
  card: DiscoveryDeckCard;
  viewer: Pet;
  viewerOwnerPhotoUrl: string | null;
};

let session: DiscoverProfileSession | null = null;

export function setDiscoverProfileSession(next: DiscoverProfileSession) {
  session = next;
}

export function getDiscoverProfileSession(
  petId: string,
): DiscoverProfileSession | null {
  if (session?.card.id === petId) return session;
  return null;
}

export function clearDiscoverProfileSession() {
  session = null;
}

let swipedPetId: string | null = null;

export function markDiscoverProfileSwiped(petId: string) {
  swipedPetId = petId;
}

export function takeDiscoverProfileSwiped(): string | null {
  const id = swipedPetId;
  swipedPetId = null;
  return id;
}
