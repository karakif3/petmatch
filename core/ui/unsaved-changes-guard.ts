import { Alert } from "react-native";
import { useNavigation } from "expo-router";
import { usePreventRemove } from "@react-navigation/native";

/**
 * Yığın ekranında kaydedilmemiş formu native geri jesti sessizce atıyordu.
 * Header chevron'u Alert gösteriyordu; iOS kenar kaydırması ve Android geri
 * `goBack`'i hiç çağırmadan pop ediyordu.
 *
 * `usePreventRemove` her çıkış yolunu aynı alerte bağlar. Chevron da
 * `router.back()` yeter — jestle aynı dinleyici çalışır.
 */
export function useUnsavedChangesGuard(dirty: boolean, message: string) {
  const navigation = useNavigation();

  usePreventRemove(dirty, ({ data }) => {
    Alert.alert("Kaydedilmemiş değişiklikler var", message, [
      { text: "Düzenlemeye dön", style: "cancel" },
      {
        text: "Çık ve vazgeç",
        style: "destructive",
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });
}
