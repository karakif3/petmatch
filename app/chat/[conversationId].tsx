import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  loadConversation,
  loadConversationOwnerProfile,
  loadMessages,
  markConversationRead,
  sendMessage,
  subscribeToConversation,
  type ChatMessage,
} from "../../core/api/conversations";
import { ReportModal } from "../../components/report-modal";
import { SafetyMenuModal } from "../../components/safety-menu-modal";
import { blockUser, unmatchConversation } from "../../core/api/safety";
import { useAuthStore } from "../../stores/auth";

function messageTime(value: string): string {
  return new Date(value).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function MessageBubble({ message, mine }: { message: ChatMessage; mine: boolean }) {
  return (
    <View className={`mb-2 px-4 ${mine ? "items-end" : "items-start"}`}>
      <View
        className={`max-w-[82%] rounded-2xl px-4 py-2.5 ${
          mine
            ? "rounded-br-md bg-brand"
            : "rounded-bl-md border border-border bg-surface"
        }`}
      >
        <Text className={`text-[15px] leading-5 ${mine ? "text-white" : "text-text-primary"}`}>
          {message.body}
        </Text>
        <Text
          className={`mt-1 text-right text-[10px] ${
            mine ? "text-white/70" : "text-text-tertiary"
          }`}
        >
          {messageTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const [body, setBody] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [safetyVisible, setSafetyVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);

  const conversation = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => loadConversation(conversationId),
    enabled: Boolean(conversationId),
  });

  const messages = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: () => loadMessages(conversationId),
    enabled: Boolean(conversationId),
  });

  const ownerProfile = useQuery({
    queryKey: ["conversation-owner", conversationId],
    queryFn: () => loadConversationOwnerProfile(conversationId),
    enabled: Boolean(conversationId && conversation.data?.isActive),
  });

  useEffect(() => {
    if (!conversationId) return;
    return subscribeToConversation(conversationId, () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
  }, [conversationId, queryClient]);

  useEffect(() => {
    if (!conversationId || !messages.data?.length) return;
    void markConversationRead(conversationId)
      .then(() => queryClient.invalidateQueries({ queryKey: ["conversations"] }))
      .catch((error) => console.error("Mesajlar okundu işaretlenemedi:", error));
  }, [conversationId, messages.data, queryClient]);

  const send = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Oturum bulunamadı.");
      return sendMessage({
        conversationId,
        senderId: user.id,
        body,
      });
    },
    onSuccess: async () => {
      setBody("");
      setSendError(null);
      await queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) => {
      setSendError(error instanceof Error ? error.message : "Mesaj gönderilemedi.");
    },
  });

  useEffect(() => {
    if (!messages.data?.length) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.data?.length]);

  const title =
    conversation.data?.petName ??
    conversation.data?.counterpartDisplayName ??
    "Konuşma";

  const closeConversation = async (action: "block" | "unmatch") => {
    const counterpartUserId = conversation.data?.counterpartUserId;
    if (action === "block" && !counterpartUserId) {
      setSendError("Engellenecek kullanıcı bulunamadı.");
      return;
    }
    setSafetyBusy(true);
    setSendError(null);
    try {
      if (action === "block") await blockUser(counterpartUserId!);
      else await unmatchConversation(conversationId);
      setSafetyVisible(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["conversations"] }),
        queryClient.invalidateQueries({ queryKey: ["discovery"] }),
      ]);
      router.replace("/(app)/matches");
    } catch (actionError) {
      setSendError(
        actionError instanceof Error ? actionError.message : "İşlem tamamlanamadı.",
      );
    } finally {
      setSafetyBusy(false);
    }
  };

  const confirmSafetyAction = (action: "block" | "unmatch") => {
    setSafetyVisible(false);
    const blocking = action === "block";
    Alert.alert(
      blocking ? "Kullanıcı engellensin mi?" : "Eşleşme kaldırılsın mı?",
      blocking
        ? "Birbirinizi göremez ve mesajlaşamazsınız. Bu işlem konuşmayı kapatır."
        : "Konuşma kapanır ve yeni mesaj gönderilemez.",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: blocking ? "Engelle" : "Eşleşmeyi kaldır",
          style: "destructive",
          onPress: () => void closeConversation(action),
        },
      ],
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-row items-center border-b border-border bg-surface px-3 py-3">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Geri"
            className="h-10 w-10 items-center justify-center rounded-full"
          >
            <Ionicons name="chevron-back" color="#1F1A17" size={27} />
          </Pressable>
          {conversation.data?.petPhotoUrl ? (
            <Image
              source={conversation.data.petPhotoUrl}
              contentFit="cover"
              style={{ width: 42, height: 42, borderRadius: 14 }}
            />
          ) : (
            <View className="h-[42px] w-[42px] items-center justify-center rounded-[14px] bg-bg-tertiary">
              <Ionicons name="paw" color="#C4B7AE" size={20} />
            </View>
          )}
          <View className="ml-3 flex-1">
            <Text className="text-base font-bold text-text-primary" numberOfLines={1}>
              {title}
            </Text>
            <Text className="mt-0.5 text-xs text-text-secondary">
              {conversation.data?.isActive ? "Konuşma açık" : "Konuşma kapatıldı"}
            </Text>
          </View>
          <Pressable
            onPress={() => setSafetyVisible(true)}
            disabled={safetyBusy || !conversation.data}
            accessibilityLabel="Konuşma güvenliği"
            className="h-10 w-10 items-center justify-center rounded-full disabled:opacity-40"
          >
            <Ionicons name="ellipsis-horizontal" color="#1F1A17" size={24} />
          </Pressable>
        </View>

        {ownerProfile.data ? (
          <View className="border-b border-border bg-bg-secondary px-4 py-3">
            <View className="flex-row items-center">
              {ownerProfile.data.photoUrl ? (
                <Image
                  source={ownerProfile.data.photoUrl}
                  contentFit="cover"
                  style={{ width: 44, height: 44, borderRadius: 22 }}
                />
              ) : (
                <View className="h-11 w-11 items-center justify-center rounded-full bg-bg-tertiary">
                  <Ionicons name="person-outline" color="#9A8B82" size={20} />
                </View>
              )}
              <View className="ml-3 flex-1">
                <View className="flex-row items-center gap-1.5">
                  <Text className="font-bold text-text-primary">
                    {ownerProfile.data.displayName ?? "Pet sahibi"}
                  </Text>
                  {ownerProfile.data.verified ? (
                    <Ionicons name="shield-checkmark" color="#2FB8A6" size={16} />
                  ) : null}
                </View>
                <Text className="mt-0.5 text-xs text-text-secondary">
                  {[
                    ownerProfile.data.gender === "female"
                      ? "Kadın"
                      : ownerProfile.data.gender === "male"
                        ? "Erkek"
                        : ownerProfile.data.gender === "other"
                          ? "Diğer"
                          : null,
                    ownerProfile.data.ageBucket,
                    ownerProfile.data.socialOpen ? "Sosyalleşmeye açık" : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "Sahip profili eşleşmeyle açıldı"}
                </Text>
              </View>
            </View>
            {ownerProfile.data.bio ? (
              <Text className="mt-2 text-xs leading-4 text-text-secondary" numberOfLines={2}>
                {ownerProfile.data.bio}
              </Text>
            ) : null}
          </View>
        ) : null}

        {conversation.isLoading || messages.isLoading ? (
          <View className="flex-1 items-center justify-center">
            <ActivityIndicator color="#F97362" />
          </View>
        ) : null}

        {conversation.isError || messages.isError ? (
          <View className="flex-1 items-center justify-center px-8">
            <Ionicons name="alert-circle-outline" color="#E5484D" size={44} />
            <Text className="mt-4 text-center text-lg font-bold text-text-primary">
              Konuşma yüklenemedi
            </Text>
            <Pressable
              onPress={() => {
                void conversation.refetch();
                void messages.refetch();
              }}
              className="mt-5 rounded-xl bg-brand px-5 py-3"
            >
              <Text className="font-semibold text-white">Tekrar dene</Text>
            </Pressable>
          </View>
        ) : null}

        {!conversation.isLoading &&
        !messages.isLoading &&
        !conversation.isError &&
        !messages.isError ? (
          <FlatList
            ref={listRef}
            data={messages.data ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} mine={item.senderId === user?.id} />
            )}
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: "flex-end",
              paddingTop: 16,
              paddingBottom: 10,
            }}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center px-10 py-20">
                <Ionicons name="chatbubble-ellipses-outline" color="#C4B7AE" size={48} />
                <Text className="mt-4 text-center text-base font-bold text-text-primary">
                  İlk mesajı sen gönder
                </Text>
                <Text className="mt-2 text-center text-sm text-text-secondary">
                  Petleriniz hakkında konuşarak güzel bir başlangıç yapın.
                </Text>
              </View>
            }
          />
        ) : null}

        {sendError ? (
          <Text className="px-4 pb-2 text-center text-xs text-danger">{sendError}</Text>
        ) : null}

        {conversation.data?.isActive ? (
          <View className="flex-row items-end gap-2 border-t border-border bg-surface px-3 py-3">
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="Mesaj yaz…"
              placeholderTextColor="#9A8B82"
              multiline
              maxLength={2000}
              className="max-h-28 min-h-11 flex-1 rounded-2xl bg-bg-secondary px-4 py-3 text-text-primary"
            />
            <Pressable
              onPress={() => send.mutate()}
              disabled={!body.trim() || send.isPending}
              accessibilityLabel="Mesaj gönder"
              className="h-11 w-11 items-center justify-center rounded-full bg-brand disabled:opacity-40"
            >
              {send.isPending ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Ionicons name="send" color="#FFFFFF" size={20} />
              )}
            </Pressable>
          </View>
        ) : (
          <View className="border-t border-border bg-bg-secondary px-4 py-4">
            <Text className="text-center text-sm font-semibold text-text-secondary">
              Bu konuşmaya artık mesaj gönderilemez.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
      <SafetyMenuModal
        visible={safetyVisible}
        canUnmatch={conversation.data?.kind === "match" && conversation.data.isActive}
        busy={safetyBusy}
        onClose={() => setSafetyVisible(false)}
        onReport={() => {
          setSafetyVisible(false);
          setReportVisible(true);
        }}
        onBlock={() => confirmSafetyAction("block")}
        onUnmatch={() => confirmSafetyAction("unmatch")}
      />
      <ReportModal
        visible={reportVisible}
        subjectUserId={conversation.data?.counterpartUserId}
        subjectPetId={conversation.data?.petId}
        onClose={() => setReportVisible(false)}
        onReported={() =>
          Alert.alert("Teşekkürler", "Şikâyetin inceleme kuyruğuna alındı.")
        }
      />
    </SafeAreaView>
  );
}
