/**
 * Profil tamamlama: kayıtta sorulmayanların gideceği yer.
 *
 * Kayıt akışı yalnızca zorunlu alanları istiyor (bkz. `core/api/onboarding.ts`).
 * Geri kalanı kullanıcı ürünü gördükten sonra, keşfetin üstünde çıkan kartla
 * dolduruyor. Bu dosya "ne eksik" sorusunun saf TS cevabı — ekranı ve veri
 * çekmeyi bilmiyor, dolayısıyla testlenebiliyor.
 *
 * Kural: yalnızca EKSİK OLDUĞU KESİN olan şeyler listeleniyor. `size` ve
 * `energy_level` şemada varsayılanla dolu olduğu için tek tek bakılamaz;
 * onların yerine `detailsCompletedAt` işaretçisine bakılıyor (0040).
 */

export type ProfileCompletionInput = {
  petBreed: string | null;
  petBirthDate: string | null;
  petBio: string | null;
  petDetailsCompletedAt: string | null;
  ownerAvatarUrl: string | null;
  ownerBio: string | null;
  ownerInterests: readonly string[];
};

export type CompletionItem = {
  key: string;
  label: string;
  /** Eşleşme kalitesini doğrudan etkileyenler önce gösterilir. */
  improvesMatching: boolean;
  route: "/profile/pet" | "/profile/owner";
};

export function missingProfileItems(
  input: ProfileCompletionInput,
): CompletionItem[] {
  const items: CompletionItem[] = [];

  if (!input.petDetailsCompletedAt) {
    items.push({
      key: "petDetails",
      label: "Boyut ve enerji seviyesi",
      improvesMatching: true,
      route: "/profile/pet",
    });
  }
  if (!input.petBirthDate) {
    items.push({
      key: "petAge",
      label: "Petinin yaşı",
      improvesMatching: true,
      route: "/profile/pet",
    });
  }
  if (!input.petBreed?.trim()) {
    items.push({
      key: "petBreed",
      label: "Petinin ırkı",
      improvesMatching: false,
      route: "/profile/pet",
    });
  }
  if (!input.petBio?.trim()) {
    items.push({
      key: "petBio",
      label: "Petini birkaç cümleyle anlat",
      improvesMatching: false,
      route: "/profile/pet",
    });
  }
  if (!input.ownerAvatarUrl) {
    items.push({
      key: "ownerAvatar",
      label: "Kendi fotoğrafın",
      improvesMatching: false,
      route: "/profile/owner",
    });
  }
  if (!input.ownerBio?.trim()) {
    items.push({
      key: "ownerBio",
      label: "Kendini tanıt",
      improvesMatching: false,
      route: "/profile/owner",
    });
  }
  if (input.ownerInterests.length === 0) {
    items.push({
      key: "ownerInterests",
      label: "İlgi alanların",
      improvesMatching: false,
      route: "/profile/owner",
    });
  }

  // Eşleşmeyi iyileştirenler öne; kullanıcı kartta ilk onları görsün.
  return items.sort(
    (a, b) => Number(b.improvesMatching) - Number(a.improvesMatching),
  );
}

/** 0 = hiç dolu değil, 1 = tamam. Kartın ilerleme çubuğu için. */
export function completionRatio(input: ProfileCompletionInput): number {
  const TOTAL = 7;
  const missing = missingProfileItems(input).length;
  return (TOTAL - missing) / TOTAL;
}
