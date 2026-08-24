import { Platform } from "react-native";

/**
 * Tutarlı yükseltme (elevation) sözlüğü.
 *
 * NativeWind'in `shadow-*` sınıfları Android'de görünmüyor (elevation
 * gerektiriyor, className bunu üretmiyor) ve tek başına iOS'ta da yüzen
 * düğme/kart hissi için yetersiz kalıyordu — her yer kendi elle yazılmış
 * gölgesini icat ediyordu (`index.tsx`'teki `floatingButtonShadow` gibi).
 * Bu üç seviye hem iOS `shadow*` hem Android `elevation` üretir.
 */
function shadow(opacity: number, radius: number, offsetY: number, elevation: number) {
  return Platform.select({
    android: { elevation },
    default: {
      shadowColor: "#1F1A17",
      shadowOffset: { width: 0, height: offsetY },
      shadowOpacity: opacity,
      shadowRadius: radius,
    },
  });
}

/** Kart satırları, form alanları — hafif ayrım. */
export const shadowSm = shadow(0.06, 4, 1, 2);

/** Kartlar, modallar — belirgin yüzey ayrımı. */
export const shadowMd = shadow(0.1, 10, 3, 4);

/** Yüzen düğmeler (Keşfet alt şeridi), kutlama kartı — en üst katman. */
export const shadowLg = shadow(0.16, 16, 4, 6);
