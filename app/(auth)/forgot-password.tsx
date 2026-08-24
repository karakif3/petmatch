import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import { translateAuthError } from "../../core/domain/auth-errors";
import { useAuthStore } from "../../stores/auth";

export default function ForgotPasswordScreen() {
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(translateAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg-primary px-6 justify-center"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Text className="text-text-primary text-3xl font-bold mb-3">Şifreni yenile</Text>
      <Text className="text-text-secondary mb-8">
        Hesabındaki e-posta adresini yaz. Şifre yenileme bağlantısını göndereceğiz.
      </Text>

      {sent ? (
        <View className="bg-surface border border-border rounded-xl p-5">
          <Text className="text-text-primary font-semibold mb-2">E-postanı kontrol et</Text>
          <Text className="text-text-secondary mb-4">
            Hesap varsa yenileme bağlantısı gönderildi. Bağlantı kısa süre geçerlidir.
          </Text>
          <Pressable onPress={() => router.replace("/(auth)/sign-in")} className="py-3">
            <Text className="text-brand font-semibold text-center">Giriş ekranına dön</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="E-posta"
            placeholderTextColor="#C4B7AE"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            className="bg-surface border border-border rounded-lg px-4 py-3.5 text-text-primary mb-3"
          />
          {error ? <Text className="text-danger text-sm mb-3">{error}</Text> : null}
          <Pressable
            onPress={submit}
            disabled={busy || !email.trim()}
            className="bg-brand rounded-xl py-4 items-center disabled:opacity-50"
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text className="text-white font-bold">Yenileme bağlantısı gönder</Text>
            )}
          </Pressable>
          <Pressable onPress={() => router.back()} className="py-4">
            <Text className="text-text-secondary text-center">Geri dön</Text>
          </Pressable>
        </>
      )}
    </KeyboardAvoidingView>
  );
}
