import { useEffect } from "react";
import { Alert } from "react-native";
import { useNavigation } from "expo-router";

/**
 * Yığın ekranında kaydedilmemiş formu native geri jesti sessizce atıyordu.
 * Header chevron'u Alert gösteriyordu; iOS kenar kaydırması ve Android geri
 * `goBack`'i hiç çağırmadan pop ediyordu.
 *
 * Navigator'ın `beforeRemove` olayı her çıkış yolunu aynı alerte bağlar.
 * Chevron da `router.back()` yeter — jestle aynı dinleyici çalışır.
 *
 * `usePreventRemove` doğrudan `@react-navigation/native` paketinden import
 * edilmemeli: Expo Router'ın navigation context'i farklı bir paket örneğine
 * çözümlenebildiğinde editör daha açılırken "navigation object" hatası verir.
 */
export function useUnsavedChangesGuard(dirty: boolean, message: string) {
  const navigation = useNavigation();

  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (!dirty) return;

        event.preventDefault();
        Alert.alert("Kaydedilmemiş değişiklikler var", message, [
          { text: "Düzenlemeye dön", style: "cancel" },
          {
            text: "Çık ve vazgeç",
            style: "destructive",
            onPress: () => navigation.dispatch(event.data.action),
          },
        ]);
      }),
    [dirty, message, navigation],
  );
}
