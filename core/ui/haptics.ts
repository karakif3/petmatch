import * as Haptics from "expo-haptics";

/**
 * Uygulama genelinde tutarlı haptik sözlüğü.
 *
 * Önceden haptik yalnızca iki yerde vardı (mesaj gönderme, eşleşme
 * kutlaması) — beğen/geç/süper beğeni, buluşma yanıtı gibi geri alınamaz
 * kararlar sessizdi. Bu üç fonksiyon o kararların hepsinde aynı sözlüğü
 * kullanmak için var; hepsi `catch`'siz `void` ile çağrılmalı, haptik API'si
 * bazı cihaz/izin durumlarında reddedebiliyor ve bu asla akışı bozmamalı.
 */

/** Geri alınamaz bir karar anı: beğen, geç, süper beğen, buluşma yanıtı. */
export function decisionHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Keşfet geç — düşük yoğunluk; yanlışlıkla basınca da bağırmaz. */
export function passHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Keşfet beğen — karar anının varsayılan ağırlığı. */
export function likeHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

/** Süper beğen — nadir, kutlayıcı; impact değil bildirim. */
export function superHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Olumlu sonuç: eşleşme, kaydetme başarılı, buluşma onaylandı. */
export function successHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

/** Hafif dokunma geri bildirimi: mesaj gönderme, sekme/segment geçişi. */
export function lightHaptic() {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

/** Yıkıcı/uyarı anı: engelleme, eşleşmeyi kaldırma, hesap silme onayı. */
export function warningHaptic() {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}
