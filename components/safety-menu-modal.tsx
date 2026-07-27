import { Modal, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export function SafetyMenuModal({
  visible,
  canUnmatch = false,
  busy = false,
  onClose,
  onReport,
  onBlock,
  onUnmatch,
}: {
  visible: boolean;
  canUnmatch?: boolean;
  busy?: boolean;
  onClose: () => void;
  onReport: () => void;
  onBlock: () => void;
  onUnmatch?: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="rounded-t-3xl bg-bg-primary px-5 pb-9 pt-4"
          onPress={(event) => event.stopPropagation()}
        >
          <View className="mb-3 flex-row items-center justify-between">
            <View>
              <Text className="text-xl font-bold text-text-primary">Güvenlik</Text>
              <Text className="mt-1 text-xs text-text-secondary">
                Rahatsız edici durumlarda kontrol sende.
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

          <Pressable
            onPress={onReport}
            disabled={busy}
            className="mt-2 flex-row items-center rounded-xl border border-border bg-surface px-4 py-4 disabled:opacity-50"
          >
            <Ionicons name="flag-outline" color="#E5484D" size={22} />
            <View className="ml-3 flex-1">
              <Text className="font-bold text-text-primary">Şikâyet et</Text>
              <Text className="mt-1 text-xs text-text-secondary">
                Profili moderasyon ekibine bildir.
              </Text>
            </View>
          </Pressable>

          {canUnmatch ? (
            <Pressable
              onPress={onUnmatch}
              disabled={busy}
              className="mt-2 flex-row items-center rounded-xl border border-border bg-surface px-4 py-4 disabled:opacity-50"
            >
              <Ionicons name="heart-dislike-outline" color="#6B5D55" size={22} />
              <View className="ml-3 flex-1">
                <Text className="font-bold text-text-primary">Eşleşmeyi kaldır</Text>
                <Text className="mt-1 text-xs text-text-secondary">
                  Konuşmayı kapat; kullanıcıyı engellemez.
                </Text>
              </View>
            </Pressable>
          ) : null}

          <Pressable
            onPress={onBlock}
            disabled={busy}
            className="mt-2 flex-row items-center rounded-xl border border-danger/30 bg-danger/5 px-4 py-4 disabled:opacity-50"
          >
            <Ionicons name="ban-outline" color="#E5484D" size={22} />
            <View className="ml-3 flex-1">
              <Text className="font-bold text-danger">Kullanıcıyı engelle</Text>
              <Text className="mt-1 text-xs text-text-secondary">
                Birbirinizi göremez ve mesajlaşamazsınız.
              </Text>
            </View>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
