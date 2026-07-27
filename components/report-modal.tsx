import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import {
  REPORT_REASONS,
  reportContent,
  type ReportReason,
} from "../core/api/safety";

export function ReportModal({
  visible,
  subjectUserId,
  subjectPetId,
  onClose,
  onReported,
}: {
  visible: boolean;
  subjectUserId?: string | null;
  subjectPetId?: string | null;
  onClose: () => void;
  onReported: () => void;
}) {
  const [reason, setReason] = useState<ReportReason>("spam");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setReason("spam");
    setNote("");
    setError(null);
  }, [visible]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await reportContent({ reason, subjectUserId, subjectPetId, note });
      onReported();
      onClose();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Şikâyet gönderilemedi.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1 justify-end bg-black/40"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="max-h-[88%] rounded-t-3xl bg-bg-primary px-5 pb-8 pt-4">
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-xl font-bold text-text-primary">Şikâyet et</Text>
              <Text className="mt-1 text-xs text-text-secondary">
                Bildirim moderasyon ekibine gizli olarak iletilir.
              </Text>
            </View>
            <Pressable
              onPress={onClose}
              disabled={busy}
              accessibilityLabel="Kapat"
              className="h-10 w-10 items-center justify-center rounded-full bg-bg-secondary"
            >
              <Ionicons name="close" color="#1F1A17" size={22} />
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled">
            <View className="gap-2 py-2">
              {REPORT_REASONS.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => setReason(option.value)}
                  className={`flex-row items-center rounded-xl border px-4 py-3 ${
                    reason === option.value
                      ? "border-brand bg-brand/10"
                      : "border-border bg-surface"
                  }`}
                >
                  <Ionicons
                    name={reason === option.value ? "radio-button-on" : "radio-button-off"}
                    color={reason === option.value ? "#F97362" : "#9A8B82"}
                    size={20}
                  />
                  <Text className="ml-3 font-semibold text-text-primary">
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text className="mb-2 mt-3 text-sm font-semibold text-text-primary">
              Açıklama (opsiyonel)
            </Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="İncelememize yardımcı olacak ayrıntıları yaz."
              placeholderTextColor="#9A8B82"
              multiline
              maxLength={1000}
              className="min-h-24 rounded-xl border border-border bg-surface px-4 py-3 text-text-primary"
              textAlignVertical="top"
            />
            <Text className="mt-1 text-right text-xs text-text-tertiary">
              {note.length}/1000
            </Text>

            {error ? (
              <View className="mt-3 rounded-xl border border-danger/30 bg-danger/10 p-3">
                <Text className="text-sm text-danger">{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={submit}
              disabled={busy}
              className="mt-4 items-center rounded-xl bg-danger py-4 disabled:opacity-50"
            >
              {busy ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text className="font-bold text-white">Şikâyeti gönder</Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
