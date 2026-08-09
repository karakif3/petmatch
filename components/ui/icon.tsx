import { Heart, Sparkles, Star, X, type LucideIcon } from "lucide-react-native";

/**
 * Karar ikonları — Ionicons yerine Lucide.
 *
 * Neden: Ionicons **dolu (filled)** bir aileden geliyor; kararın verildiği
 * üç düğme (geç / süper beğeni / beğen) uygulamanın en büyük, en çok
 * bakılan yüzeyi ve dolu ikonlar orada "sticker" gibi duruyordu. Lucide
 * çizgi tabanlı, tek tutarlı çizgi kalınlığı (`strokeWidth`) olan bir
 * aile; boyut büyüdükçe çizgi kalınlığı orantısız kalınlaşmıyor, düğme
 * içinde optik olarak dengeleniyor.
 *
 * Kapsam BİLEREK dar tutuldu: yalnızca bu üç düğme + uyum rozeti. Tüm
 * uygulamayı tek seferde çevirmek ~40 çağrı yeri demek ve her biri kendi
 * boyut/hizalama kararını taşıyor — karışık bir aile (yarı Ionicons yarı
 * Lucide) tek tek çevirmekten daha kötü görünürdü, o yüzden geçiş
 * "yüzeye göre" yapılıyor: önce karar şeridi, sonra ekran ekran.
 *
 * `react-native-svg` yeni bir NATIVE bağımlılık — dev-client'ın yeniden
 * derlenmesi gerekiyor (bkz. README).
 */
export const DecisionIcons = {
  pass: X,
  superLike: Star,
  like: Heart,
  compatibility: Sparkles,
} satisfies Record<string, LucideIcon>;

/**
 * Karar düğmelerinin ortak çizgi kalınlığı. Lucide varsayılanı 2; 60-70pt
 * çapındaki düğmelerin içinde 22-24pt bir ikon 2'de cılız kalıyor, 2.5
 * ağırlığı düğmenin kütlesine oturuyor.
 */
export const DECISION_STROKE = 2.5;
