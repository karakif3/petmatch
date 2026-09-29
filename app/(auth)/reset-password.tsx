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
import { AppIcon } from "../../components/ui/icon";
import { AppPressable } from "../../components/ui/pressable";

import { translateAuthError } from "../../core/domain/auth-errors";
import {
  isAcceptablePassword,
  MIN_PASSWORD_LENGTH,
  passwordRules,
} from "../../core/domain/credentials";
import { useAuthStore } from "../../stores/auth";

export default function ResetPasswordScreen() {
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const setRecoveryMode = useAuthStore((state) => state.setRecoveryMode);
  const signOut = useAuthStore((state) => state.signOut);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = passwordRules(password);
  const strongEnough = isAcceptablePassword(password);

  const submit = async () => {
    if (!strongEnough) {
      setError(
        `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı ve harf ile rakam içermeli.`,
      );
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
        Hesabın için yeni bir şifre seç.
      </Text>
      <View className="mb-3 flex-row items-center rounded-lg border border-border bg-surface">
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Yeni şifre"
          placeholderTextColor="#C4B7AE"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          className="flex-1 px-4 py-3.5 text-text-primary"
        />
        <AppPressable
          onPress={() => setShowPassword((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
          className="h-11 w-11 items-center justify-center rounded-full"
        >
          <AppIcon name={showPassword ? "eye-off" : "eye"} size={19} color="#6B5D55" />
        </AppPressable>
      </View>
      {/*
        Kurallar yazarken görünüyor. "Gönder → reddedildi → tekrar dene"
        döngüsü, kuralı baştan göstermenin yerini tutmuyor; şifre alanı
        maskeli olduğu için kullanıcı neyi eksik bıraktığını göremiyor.
      */}
      {password.length > 0 ? (
        <View className="mb-3 gap-1">
          {rules.map((rule) => (
            <View key={rule.id} className="flex-row items-center gap-2">
              <AppIcon
                name={rule.passed ? "circle-check" : "circle"}
                size={14}
                color={rule.passed ? "#2FB8A6" : "#C4B7AE"}
              />
              <Text
                className={`text-xs ${
                  rule.passed ? "text-accent-dark" : "text-text-tertiary"
                }`}
              >
                {rule.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      <TextInput
        value={confirmation}
        onChangeText={setConfirmation}
        placeholder="Yeni şifreyi tekrar yaz"
        placeholderTextColor="#C4B7AE"
        secureTextEntry={!showPassword}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        className="bg-surface border border-border rounded-lg px-4 py-3.5 text-text-primary mb-3"
      />
      {error ? <Text className="text-danger text-sm mb-3">{error}</Text> : null}
      <Pressable
        onPress={submit}
        disabled={busy || !strongEnough || !confirmation}
        className="bg-brand rounded-xl py-4 items-center disabled:opacity-50"
      >
        {busy ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text className="text-white font-bold">Şifreyi güncelle</Text>
        )}
      </Pressable>
      {/* Kurtarma modunda kalan kullanıcının uygulamayı kapatmadan çıkış
          yolu yoktu. */}
      <AppPressable
        onPress={() => {
          setRecoveryMode(false);
          void signOut().then(() => router.replace("/(auth)/sign-in"));
        }}
        disabled={busy}
        className="mt-3 min-h-11 items-center justify-center"
      >
        <Text className="font-semibold text-text-secondary">Vazgeç</Text>
      </AppPressable>
    </KeyboardAvoidingView>
  );
}
