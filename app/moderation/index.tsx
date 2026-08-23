import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
// SafeAreaView react-native'den DEĞİL buradan geliyor: deprecated olan
// sürüm iOS 26'da KeyboardAvoidingView zinciriyle birlikte içeriği sıfır
// yüksekliğe düşürüyor ve ekran boş render ediliyordu.
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import {
  loadModerationOperations,
  reviewModerationItem,
  type ModerationQueueItem,
  type VerificationRejectionReason,
} from "../../core/api/moderation";
import { errorMessage } from "../../core/domain/error-message";

export default function ModerationScreen() {
  const queryClient = useQueryClient();
  const operations = useQuery({
    queryKey: ["moderation-operations"],
    queryFn: loadModerationOperations,
  });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, VerificationRejectionReason>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const decide = async (
    item: ModerationQueueItem,
    decision: "approved" | "rejected",
  ) => {
    setBusyId(item.id);
    setError(null);
    try {
      await reviewModerationItem({
        id: item.id,
        decision,
        note: notes[item.id] ?? "",
        rejectionReason: decision === "rejected" ? reasons[item.id] ?? null : null,
        verificationPhotoPath: item.verificationPhotoPath,
      });
      await queryClient.invalidateQueries({ queryKey: ["moderation-operations"] });
    } catch (reviewError) {
      setError(errorMessage(reviewError, "Karar kaydedilemedi."));
    } finally {
      setBusyId(null);
    }
  };

  if (operations.isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-primary">
        <ActivityIndicator color="#F97362" size="large" />
      </SafeAreaView>
    );
  }

  if (operations.isError || !operations.data) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-bg-primary px-7">
        <Text className="text-xl font-bold text-text-primary">Moderasyon erişimi yok</Text>
        <Text className="mt-2 text-center text-sm text-text-secondary">
          Bu ekran yalnızca moderator veya admin rolü atanmış hesaplara açıktır.
        </Text>
        <Pressable onPress={() => router.back()} className="mt-5 rounded-xl border border-border px-5 py-3">
          <Text className="font-semibold text-text-primary">Geri dön</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const { items, metrics } = operations.data;
  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <ScrollView
        contentContainerClassName="px-5 pb-12 pt-4"
        refreshControl={
          <RefreshControl
            refreshing={operations.isRefetching}
            onRefresh={() => operations.refetch()}
            tintColor="#F97362"
          />
        }
      >
        <Pressable onPress={() => router.back()} className="mb-4 self-start py-2">
          <Text className="font-semibold text-brand">← Geri</Text>
        </Pressable>
        <Text className="text-2xl font-bold text-text-primary">Operasyon merkezi</Text>
        <View className="my-5 flex-row flex-wrap gap-2">
          {[
            ["Bekleyen", metrics.moderation_pending],
            ["SLA aşımı", metrics.moderation_sla_breached],
            ["Push hatası · 24s", metrics.notification_failed_24h],
            ["İstemci hatası · 24s", metrics.client_errors_24h],
          ].map(([label, value]) => (
            <View key={String(label)} className="min-w-[46%] flex-1 rounded-xl border border-border bg-surface p-3">
              <Text className="text-xs text-text-secondary">{label}</Text>
              <Text className="mt-1 text-xl font-bold text-text-primary">{value}</Text>
            </View>
          ))}
        </View>

        <Text className="mb-3 text-lg font-bold text-text-primary">7 günlük funnel</Text>
        <View className="mb-5 rounded-2xl border border-border bg-surface p-4">
          {Object.keys(metrics.funnel_7d).length ? (
            Object.entries(metrics.funnel_7d).map(([name, count]) => (
              <View key={name} className="flex-row justify-between border-b border-border py-2 last:border-b-0">
                <Text className="text-sm text-text-secondary">{name}</Text>
                <Text className="font-bold text-text-primary">{count}</Text>
              </View>
            ))
          ) : (
            <Text className="text-sm text-text-secondary">Henüz ürün olayı yok.</Text>
          )}
        </View>

        {metrics.notification_failures.length ||
        metrics.client_error_samples.length ? (
          <>
            <Text className="mb-3 text-lg font-bold text-text-primary">Son hatalar</Text>
            <View className="mb-5 rounded-2xl border border-danger/20 bg-danger/5 p-4">
              {metrics.notification_failures.map((failure, index) => (
                <Text
                  key={`push-${failure.created_at}-${index}`}
                  className="mb-2 text-xs leading-5 text-text-secondary"
                >
                  Push · {failure.event_type}: {failure.message ?? "Bilinmeyen hata"}
                </Text>
              ))}
              {metrics.client_error_samples.map((sample, index) => (
                <Text
                  key={`client-${sample.created_at}-${index}`}
                  className="mb-2 text-xs leading-5 text-text-secondary"
                >
                  İstemci · {sample.name}: {sample.message}
                  {sample.route ? ` (${sample.route})` : ""}
                </Text>
              ))}
            </View>
          </>
        ) : null}

        <Text className="mb-3 text-lg font-bold text-text-primary">En eski bekleyenler</Text>
        {items.length === 0 ? (
          <View className="rounded-2xl border border-border bg-surface p-5">
            <Text className="text-center text-text-secondary">Kuyruk temiz ✓</Text>
          </View>
        ) : null}
        {items.map((item) => (
          <View
            key={item.id}
            className={`mb-4 rounded-2xl border bg-surface p-4 ${
              item.slaBreached ? "border-danger" : "border-border"
            }`}
          >
            <View className="flex-row justify-between">
              <Text className="font-bold text-text-primary">
                {item.kind === "verification" ? "Profil doğrulama" : "Şikâyet"}
              </Text>
              <Text className={item.slaBreached ? "text-xs font-bold text-danger" : "text-xs text-text-tertiary"}>
                {item.ageHours} saat
              </Text>
            </View>
            {item.reason ? <Text className="mt-2 text-sm text-text-secondary">Neden: {item.reason}</Text> : null}
            {item.verificationPhotoUrl ? (
              <Image
                source={{ uri: item.verificationPhotoUrl }}
                className="mt-3 h-64 w-full rounded-xl"
                resizeMode="cover"
              />
            ) : null}
            <TextInput
              value={notes[item.id] ?? ""}
              onChangeText={(value) => setNotes((current) => ({ ...current, [item.id]: value }))}
              placeholder="İnceleme notu (ret için zorunlu)"
              placeholderTextColor="#9A8B82"
              multiline
              maxLength={1000}
              className="mt-3 min-h-20 rounded-xl border border-border bg-bg-primary px-3 py-3 text-text-primary"
            />
            {item.kind === "verification" ? (
              <View className="mt-3 flex-row flex-wrap gap-2">
                {([
                  ["unclear_photo", "Fotoğraf net değil"],
                  ["pet_not_visible", "Pet görünmüyor"],
                  ["owner_not_visible", "Sahip görünmüyor"],
                  ["multiple_people", "Birden fazla kişi"],
                  ["edited_photo", "Düzenlenmiş fotoğraf"],
                  ["other", "Diğer"],
                ] as const).map(([value, label]) => {
                  const active = reasons[item.id] === value;
                  return (
                    <Pressable
                      key={value}
                      onPress={() => setReasons((current) => ({ ...current, [item.id]: value }))}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: active }}
                      className={`rounded-full border px-3 py-2 ${active ? "border-brand bg-brand/10" : "border-border"}`}
                    >
                      <Text className={`text-xs font-semibold ${active ? "text-brand-dark" : "text-text-secondary"}`}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            <View className="mt-3 flex-row gap-2">
              <Pressable
                onPress={() => void decide(item, "rejected")}
                disabled={
                  busyId !== null ||
                  !(notes[item.id] ?? "").trim() ||
                  (item.kind === "verification" && !reasons[item.id])
                }
                className="flex-1 items-center rounded-xl border border-danger py-3 disabled:opacity-40"
              >
                <Text className="font-bold text-danger">Reddet</Text>
              </Pressable>
              <Pressable
                onPress={() => void decide(item, "approved")}
                disabled={busyId !== null}
                className="flex-1 items-center rounded-xl bg-accent py-3 disabled:opacity-40"
              >
                {busyId === item.id ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="font-bold text-white">Onayla</Text>
                )}
              </Pressable>
            </View>
          </View>
        ))}
        {error ? <Text className="text-sm text-danger">{error}</Text> : null}
      </ScrollView>
    </SafeAreaView>
  );
}
