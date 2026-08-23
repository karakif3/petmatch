import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";

import { Checkbox } from "../components/ui/checkbox";
import { AppPressable } from "../components/ui/pressable";
import { recordRequiredLegalAcceptances } from "../core/api/legal";
import { LEGAL_DOCUMENT_VERSION } from "../core/domain/legal";
import { errorMessage } from "../core/domain/error-message";
import { useAuthStore } from "../stores/auth";

export default function LegalConsentScreen() {
  const setLegalRequired = useAuthStore((state) => state.setLegalRequired);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!accepted) {
      setError("Devam etmek için güncel koşulları ve aydınlatma metnini onaylamalısın.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await recordRequiredLegalAcceptances();
      setLegalRequired(false);
    } catch (submitError) {
      setError(errorMessage(submitError, "Onayın kaydedilemedi."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <ScrollView contentContainerClassName="px-6 pb-10 pt-10">
        <Text className="text-xs font-semibold uppercase text-brand">Güncelleme</Text>
        <Text className="mt-2 text-3xl font-bold text-text-primary">Koşullarımızı güncelledik</Text>
        <Text className="mt-3 text-sm leading-6 text-text-secondary">
          Bölge bekleme listesi, buluşma noktası kaynakları ve profil doğrulama geri bildirimleri için veri işleme açıklamalarını netleştirdik.
        </Text>
        <View className="mt-6 rounded-xl border border-border bg-surface p-4">
          <Text className="font-bold text-text-primary">Sürüm {LEGAL_DOCUMENT_VERSION}</Text>
          <Text className="mt-2 text-sm leading-6 text-text-secondary">
            Güncel metni incelemek için yasal ve gizlilik ekranını açabilirsin.
          </Text>
          <AppPressable onPress={() => router.push("/(auth)/legal")} className="mt-3 self-start py-2">
            <Text className="font-semibold text-brand-dark">Metni incele</Text>
          </AppPressable>
        </View>
        <View className="mt-5 rounded-xl border border-border bg-surface p-4">
          <Checkbox checked={accepted} onChange={setAccepted}>
            <Text className="text-sm font-semibold leading-6 text-text-primary">
              Kullanım koşullarını kabul ediyor ve KVKK aydınlatma metnini okuduğumu onaylıyorum.
            </Text>
          </Checkbox>
        </View>
        {error ? <Text className="mt-4 text-sm font-semibold text-danger">{error}</Text> : null}
        <AppPressable
          onPress={() => void submit()}
          disabled={busy || !accepted}
          className="mt-6 min-h-12 items-center justify-center rounded-xl bg-brand px-5 disabled:opacity-50"
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text className="font-bold text-white">Onayla ve devam et</Text>}
        </AppPressable>
      </ScrollView>
    </SafeAreaView>
  );
}
