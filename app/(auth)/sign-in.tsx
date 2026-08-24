import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { AppIcon } from "../../components/ui/icon";

import { BrandMark } from "../../components/brand-mark";
import { AppPressable } from "../../components/ui/pressable";
import { translateAuthError } from "../../core/domain/auth-errors";
import {
  isAcceptablePassword,
  isValidEmail,
  passwordRules,
} from "../../core/domain/credentials";
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
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [emailUnconfirmed, setEmailUnconfirmed] = useState(false);
  // "touched": kullanıcı yazmaya BAŞLAR başlamaz kırmızı göstermek, henüz
  // hata yapmamış birini azarlamaktır. Alan terk edilince değerlendiriliyor.
  const [emailTouched, setEmailTouched] = useState(false);

  const isSignUp = mode === "sign-up";
  const emailValid = isValidEmail(email);
  const emailError = emailTouched && email.length > 0 && !emailValid;
  // Şifre kuralları YALNIZCA kayıt akışında. Girişte dayatmak, 6-7 karakterle
  // açılmış eski hesapların sahibini doğru şifresiyle kilitlerdi.
  const rules = isSignUp ? passwordRules(password) : [];
  const canSubmit =
    configured &&
    !busy &&
    emailValid &&
    password.length > 0 &&
    (!isSignUp || isAcceptablePassword(password));

  const submit = async () => {
    if (!canSubmit) return;
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
          <View className="mb-6 rounded-xl border border-warning bg-warning/10 p-4">
            <Text className="mb-1 font-medium text-text-primary">Supabase bağlı değil</Text>
            <Text className="text-sm text-text-secondary">
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
          autoCorrect={false}
          spellCheck={false}
          keyboardType="email-address"
          autoComplete="email"
          textContentType="emailAddress"
          onBlur={() => setEmailTouched(true)}
          className={`rounded-xl border bg-surface px-4 py-3.5 text-text-primary ${
            emailError ? "border-danger" : "border-border"
          }`}
        />
        {emailError ? (
          <Text className="mt-1.5 text-xs text-danger">
            Geçerli bir e-posta adresi yaz (örn. ad@ornek.com).
          </Text>
        ) : null}
        <View className="h-3" />
        <View className="mb-5 flex-row items-center rounded-xl border border-border bg-surface pr-2">
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Şifre"
            placeholderTextColor="#C4B7AE"
            secureTextEntry={!showPassword}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            textContentType={mode === "sign-in" ? "password" : "newPassword"}
            className="flex-1 px-4 py-3.5 text-text-primary"
          />
          <AppPressable
            onPress={() => setShowPassword((value) => !value)}
            accessibilityRole="button"
            accessibilityLabel={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <AppIcon
              name={showPassword ? "eye-off" : "eye"}
              size={19}
              color="#6B5D55"
            />
          </AppPressable>
        </View>

        {isSignUp ? (
          <View className="-mt-2 mb-5 gap-1">
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

        {error || params.authError ? (
          <Text className="text-danger text-sm mb-3">{error ?? params.authError}</Text>
        ) : null}
        {notice || params.notice ? (
          <Text className="text-accent-dark text-sm mb-3">{notice ?? params.notice}</Text>
        ) : null}

        {emailUnconfirmed ? (
          <AppPressable
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
          </AppPressable>
        ) : null}

        <AppPressable
          onPress={submit}
          disabled={!canSubmit}
          className="bg-brand rounded-xl py-4 items-center disabled:opacity-50"
        >
          {busy ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white font-bold text-base">
              {mode === "sign-in" ? "Giriş yap" : "Hesap oluştur"}
            </Text>
          )}
        </AppPressable>

        {mode === "sign-in" ? (
          <AppPressable onPress={() => router.push("/(auth)/forgot-password")} className="py-4">
            <Text className="text-brand text-sm text-center font-semibold">Şifremi unuttum</Text>
          </AppPressable>
        ) : null}

        <AppPressable
          onPress={() => {
            setMode(isSignUp ? "sign-in" : "sign-up");
            setError(null);
            setNotice(null);
            setEmailTouched(false);
          }}
          className="py-3 items-center"
        >
          <Text className="text-text-secondary text-sm">
            {mode === "sign-in" ? "Hesabın yok mu? Kayıt ol" : "Zaten hesabın var mı? Giriş yap"}
          </Text>
        </AppPressable>

        <AppPressable onPress={() => router.push("/(auth)/legal")} className="mt-5 px-3 py-2">
          <Text className="text-center text-xs leading-5 text-text-tertiary">
            Devam ederek Kullanım Koşulları, Gizlilik Politikası ve KVKK
            Aydınlatma Metni’ne erişebildiğini onaylarsın. Metinleri aç
          </Text>
        </AppPressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
