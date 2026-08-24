import * as ImagePicker from "expo-image-picker";
import { Platform } from "react-native";

/**
 * Galeriden fotoğraf seçmeden önce çağrılır.
 *
 * **iOS'ta izin istenmez ve istenmemelidir.** `launchImageLibraryAsync` native
 * tarafta PHPicker'ı doğrudan açıyor, hiçbir izin kontrolü yapmıyor
 * (`ImagePickerModule.swift` → `launchImagePicker`). Buna rağmen önceden izin
 * istemek aktif zarar veriyor: kullanıcı sistem sorusunda "Sınırlı erişim"i
 * seçtiğinde iOS, normal PHPicker yerine kısıtlı kütüphane picker'ını açıyor.
 * Simülatörde bu picker'ın onay butonu sheet'i kapatmıyor — fotoğraf hücreleri
 * seçime yanıt veriyor ama seçim uygulamaya hiç dönmüyor, kullanıcı sıkışıyor.
 *
 * Android'de izin hâlâ gerekli, o yüzden ayrım platform bazında.
 */
export async function ensureImageLibraryAccess(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  return permission.granted;
}
