/**
 * Paylaşılan Türkçe etiket sözlükleri.
 *
 * `Temperament`/`Size` etiketleri önce yalnızca `app/profile/pet.tsx`
 * içinde tanımlıydı, `OwnerInterest` etiketleri `app/profile/owner.tsx`
 * içinde; Keşfet kartı aynı sözlüklere ihtiyaç duyunca buraya taşındı —
 * iki yerde birbirinden bağımsız kopya tutmak, biri güncellenip diğeri
 * unutulduğunda sessizce ayrışırdı.
 */
import type { OwnerInterest, Size, Temperament } from "./types";

export const temperamentLabels: Record<Temperament, string> = {
  playful: "Oyuncu",
  calm: "Sakin",
  shy: "Çekingen",
  curious: "Meraklı",
  protective: "Korumacı",
  affectionate: "Sevecen",
  independent: "Bağımsız",
};

export const sizeLabels: Record<Size, string> = {
  small: "Küçük",
  medium: "Orta",
  large: "Büyük",
};

export const ownerInterestLabels: Record<OwnerInterest, string> = {
  walks: "Yürüyüş",
  hiking: "Doğa yürüyüşü",
  running: "Koşu",
  agility: "Çeviklik",
  training: "Eğitim",
  beach_trips: "Sahil",
  dog_park_regular: "Köpek parkı müptelası",
  cat_behavior: "Kedi davranışı",
  coffee: "Kahve",
  photography: "Fotoğrafçılık",
  board_games: "Kutu oyunları",
  reading: "Kitap",
  cooking: "Yemek yapmak",
  travel: "Seyahat",
  live_music: "Canlı müzik",
  volunteering: "Gönüllülük",
};
