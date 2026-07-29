import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { BrandMark } from "../../components/brand-mark";
import { translateAuthError } from "../../core/domain/auth-errors";
import { useTranslation } from "../../core/i18n";
import { useAuthStore } from "../../stores/auth";

type Mode = "sign-in" | "sign-up";

export default function SignInScreen() {
  const t = useTranslation();
  const configured = useAuthStore((s) => s.configured);
  const signInWithEmail = useAuthStore((s) => s.signInWithEmail);
  const signUpWithEmail = useAuthStore((s) => s.signUpWithEmail);
  const resendSignupConfirmation = useAuthStore((s) => s.resendSignupConfirmation);
  const params = useLocalSearchParams<{ authError?: string; notice?: string }>();

  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailUnconfirmed, setEmailUnconfirmed] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    setEmailUnconfirmed(false);
    try {
      if (mode === "sign-in") {
        await signInWithEmail(email.trim(), password);
      } else {
        await signUpWithEmail(email.trim(), password);
        setNotice("Hesabını doğrulamak için e-postana gönderilen bağlantıya tıkla.");
      }
    } catch (err) {
      const message = translateAuthError(err);
      setError(message);
      setEmailUnconfirmed(message === "E-posta adresini doğrulamalısın.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-bg-primary"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-12">
        <View className="mb-6">
          <BrandMark size={82} />
        </View>
        <Text className="text-text-primary text-3xl font-bold">PetMatch</Text>
        <Text className="text-brand font-semibold mt-1">{t("brand.motto")}</Text>
        <Text className="mt-2 text-lg font-bold text-text-primary">
          {t("brand.promise")}
        </Text>
        <Text className="text-text-secondary text-base mt-2 mb-8">
          {t("brand.description")}
        </Text>

        {!configured ? (
          <View className="bg-warning/10 border border-warning rounded-lg p-4 mb-6">
            <Text className="text-text-primary font-medium mb-1">Supabase bağlı değil</Text>
            <Text className="text-text-secondary text-sm">
              .env dosyasına EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY ekleyip
              Metro’yu yeniden başlat.
            </Text>
          </View>
        ) : null}

        <TextInput
          value={email}
          onChangeText={setEmail}
          placeholder="E-posta"
          placeholderTextColor="#C4B7AE"
          autoCapitalize="none"
          keyboardType="email-address"
          autoComplete="email"
          className="bg-surface border border-border rounded-lg px-4 py-3.5 text-text-primary mb-3"
        />
        <TextInput
          value={password}
          onChangeText={setPassword}
          placeholder="Şifre"
          placeholderTextColor="#C4B7AE"
          secureTextEntry
          className="bg-surface border border-border rounded-lg px-4 py-3.5 text-text-primary mb-5"
        />

        {error || params.authError ? (
          <Text className="text-danger text-sm mb-3">{error ?? params.authError}</Text>
        ) : null}
        {notice || params.notice ? (
          <Text className="text-accent-dark text-sm mb-3">{notice ?? params.notice}</Text>
        ) : null}

        {emailUnconfirmed ? (
          <Pressable
            onPress={async () => {
              setBusy(true);
              setError(null);
              try {
                await resendSignupConfirmation(email.trim());
                setNotice("Doğrulama e-postası yeniden gönderildi.");
                setEmailUnconfirmed(false);
              } catch (err) {
                setError(translateAuthError(err));
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy || !email.trim()}
            className="border border-brand rounded-xl py-3 items-center mb-3 disabled:opacity-50"
          >
            <Text className="text-brand font-semibold">Doğrulama e-postasını yeniden gönder</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={submit}
          disabled={busy || !configured || !email || !password}
          className="bg-brand rounded-xl py-4 items-center disabled:opacity-50"
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white font-bold text-base">
              {mode === "sign-in" ? "Giriş yap" : "Hesap oluştur"}
            </Text>
          )}
        </Pressable>

        {mode === "sign-in" ? (
          <Pressable onPress={() => router.push("/(auth)/forgot-password")} className="py-4">
            <Text className="text-brand text-sm text-center font-semibold">Şifremi unuttum</Text>
          </Pressable>
        ) : null}

        <Pressable
          onPress={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            setError(null);
            setNotice(null);
          }}
          className="py-3 items-center"
        >
          <Text className="text-text-secondary text-sm">
            {mode === "sign-in" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push("/(auth)/legal")} className="mt-5 px-3 py-2">
          <Text className="text-center text-xs leading-5 text-text-tertiary">
            Devam ederek Kullanım Koşulları, Gizlilik Politikası ve KVKK
            Aydınlatma Metni’ne erişebildiğini onaylarsın. Metinleri aç
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
