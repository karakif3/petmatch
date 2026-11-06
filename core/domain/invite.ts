/**
 * Davet metinleri (backlog: "Davet / paylaş").
 *
 * Pilot bölgede yoğunluk tek büyüme kaldıracı. Her yüzeyin metni o anki
 * duruma göre: boş destede "yakınında az pet var", bekleme listesinde
 * "bölgemi erken açtır".
 *
 * Bağlantı `EXPO_PUBLIC_INVITE_URL`'den (mağaza sayfası / tanıtım sayfası).
 * Henüz alan adı ve mağaza kaydı olmadığı için boş olabilir; o zaman metin
 * mağazada aratmayı söylüyor — kırık bir bağlantı göndermekten iyi.
 */
export type InviteSurface = "discovery_empty" | "waitlist" | "profile";

export const INVITE_FALLBACK_HINT = "App Store veya Google Play'de “PetMatch” diye arat.";

export function inviteMessage(input: {
  surface: InviteSurface;
  petName?: string | null;
  location?: string | null;
  url?: string | null;
}): string {
  const pet = input.petName?.trim();
  const location = input.location?.trim();
  const tail = input.url?.trim() ? input.url.trim() : INVITE_FALLBACK_HINT;

  switch (input.surface) {
    case "discovery_empty":
      return [
        pet
          ? `${pet} için oyun arkadaşı arıyoruz 🐾`
          : "Petime oyun arkadaşı arıyorum 🐾",
        "PetMatch'te yakındaki köpek ve kedilerle tanışıp parkta buluşuyoruz. Sen de petinle gel:",
        tail,
      ].join(" ");
    case "waitlist":
      return [
        location
          ? `PetMatch'in ${location} bölgesinde açılmasını bekliyorum 🐾`
          : "PetMatch'in bölgemizde açılmasını bekliyorum 🐾",
        "Ne kadar çok kişi isterse o kadar erken açılıyor. Sen de talep et:",
        tail,
      ].join(" ");
    case "profile":
      return [
        "Petin için yakında oyun arkadaşı bul 🐾",
        "PetMatch'te köpek ve kedi sahipleri tanışıp parkta buluşuyor:",
        tail,
      ].join(" ");
  }
}
