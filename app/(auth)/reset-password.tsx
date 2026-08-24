import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
} from "react-native";
import { router } from "expo-router";

import { translateAuthError } from "../../core/domain/auth-errors";
import { useAuthStore } from "../../stores/auth";

export default function ResetPasswordScreen() {
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const setRecoveryMode = useAuthStore((state) => state.setRecoveryMode);
  const signOut = useAuthStore((state) => state.signOut);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (password.length < 6) {
      setError("Şifre en az 6 karakter olmalı.");
      return;
    }
    if (password !== confirmation) {
      setError("Şifreler aynı değil.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await updatePassword(password);
      setRecoveryMode(false);
      await signOut();
      router.replace({
        pathname: "/(auth)/sign-in",
        params: { notice: "Şifren yenilendi. Yeni şifrenle giriş yapabilirsin." },
      });
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
      <Text className="text-text-primary text-3xl font-bold mb-3">Yeni şifre oluştur</Text>
      <Text className="text-text-secondary mb-8">
        Hesabın için en az 6 karakterli yeni bir şifre seç.
      </Text>
      <TextInput
        value={password}
        onChangeText={setPassword}
        placeholder="Yeni şifre"
        placeholderTextColor="#C4B7AE"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        className="bg-surface border border-border rounded-lg px-4 py-3.5 text-text-primary mb-3"
      />
      <TextInput
        value={confirmation}
        onChangeText={setConfirmation}
        placeholder="Yeni şifreyi tekrar yaz"
        placeholderTextColor="#C4B7AE"
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        className="bg-surface border border-border rounded-lg px-4 py-3.5 text-text-primary mb-3"
      />
      {error ? <Text className="text-danger text-sm mb-3">{error}</Text> : null}
      <Pressable
        onPress={submit}
        disabled={busy || !password || !confirmation}
        className="bg-brand rounded-xl py-4 items-center disabled:opacity-50"
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-white font-bold">Şifreyi güncelle</Text>
        )}
      </Pressable>
    </KeyboardAvoidingView>
  );
}
