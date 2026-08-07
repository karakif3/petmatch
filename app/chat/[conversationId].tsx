import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
// SafeAreaView react-native'den DEĞİL buradan geliyor: deprecated olan
// sürüm iOS 26'da KeyboardAvoidingView zinciriyle birlikte içeriği sıfır
// yüksekliğe düşürüyor ve ekran boş render ediliyordu.
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";

import {
  loadConversation,
  loadConversationOwnerProfile,
  loadMessages,
  markConversationRead,
  recordMeetupFeedback,
  sendMessage,
  subscribeToConversation,
  subscribeToConversationSignals,
  type ChatMessage,
  type ChatMessageCursor,
  type ChatMessagePage,
  type ConversationSignalSubscription,
} from "../../core/api/conversations";
import { DateSeparator } from "../../components/chat/date-separator";
import { MeetupFeedbackPrompt } from "../../components/chat/meetup-feedback-prompt";
import { MeetupCard } from "../../components/chat/meetup-card";
import { MeetupPlacePicker } from "../../components/chat/meetup-place-picker";
import { MeetupScheduleSheet } from "../../components/chat/meetup-schedule-sheet";
import { MessageBubble } from "../../components/chat/message-bubble";
import {
  QuickReplyBar,
  QuickReplyStarters,
  quickReplies,
} from "../../components/chat/quick-replies";
import { ReportModal } from "../../components/report-modal";
import { SafetyMenuModal } from "../../components/safety-menu-modal";
import {
  listMeetupPlaces,
} from "../../core/api/meetup-places";
import { blockUser, unmatchConversation } from "../../core/api/safety";
import { buildChatItems, type ChatListItem } from "../../core/domain/chat-items";
import { useTranslation } from "../../core/i18n";
import { captureClientError } from "../../core/api/observability";
import { OwnerSheet } from "../../components/owner-sheet";
import {
  cancelMeetup,
  loadConversationMeetup,
  proposeMeetup,
  respondToMeetup,
} from "../../core/api/meetups";
import type { MeetupPlace } from "../../core/api/meetup-places";
import { errorMessage } from "../../core/domain/error-message";
import { useAuthStore } from "../../stores/auth";

const TYPING_IDLE_MS = 2_500;
const REMOTE_TYPING_STALE_MS = 4_000;

export default function ChatScreen() {
  const t = useTranslation();
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const listRef = useRef<FlatList<ChatListItem<ChatMessage>>>(null);
  const signalRef = useRef<ConversationSignalSubscription | null>(null);
  const typingIdleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingStaleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestMessageRef = useRef<string | null>(null);
  const nearBottomRef = useRef(true);
  const [body, setBody] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [ownerSheet, setOwnerSheet] = useState(false);
  const [failedMessage, setFailedMessage] = useState<string | null>(null);
  const [remoteOnline, setRemoteOnline] = useState(false);
  const [remoteTyping, setRemoteTyping] = useState(false);
  const [newMessageBelow, setNewMessageBelow] = useState(false);
  const [safetyVisible, setSafetyVisible] = useState(false);
  const [reportVisible, setReportVisible] = useState(false);
  const [safetyBusy, setSafetyBusy] = useState(false);
  const [placePickerVisible, setPlacePickerVisible] = useState(false);
  const [pendingPlace, setPendingPlace] = useState<MeetupPlace | null>(null);

  const conversation = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: () => loadConversation(conversationId),
    enabled: Boolean(conversationId),
  });

  const messages = useInfiniteQuery({
    queryKey: ["messages", conversationId],
    queryFn: ({ pageParam }) => loadMessages(conversationId, { before: pageParam }),
    initialPageParam: null as ChatMessageCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    enabled: Boolean(conversationId),
  });

  // Sunucu yalnızca DOĞRULANMIŞ yerleri veriyor; liste boşsa buton hiç
  // görünmüyor. Saha teyidi yapılmamış bölgede öneri göstermemek,
  // kullanıcıyı hayvan girişine kapalı bir parka yollamaktan iyidir.
  const meetupPlaces = useQuery({
    queryKey: ["meetup-places"],
    queryFn: listMeetupPlaces,
    staleTime: 30 * 60 * 1000,
  });

  const ownerProfile = useQuery({
    queryKey: ["conversation-owner", conversationId],
    queryFn: () => loadConversationOwnerProfile(conversationId),
    enabled: Boolean(conversationId && conversation.data?.isActive),
  });

  const meetup = useQuery({
    queryKey: ["conversation-meetup", conversationId],
    queryFn: () => loadConversationMeetup(conversationId),
    enabled: Boolean(conversationId),
  });

  const meetupAction = useMutation({
    mutationFn: async (
      action:
        | { kind: "propose"; placeId: string; when: Date }
        | { kind: "respond"; meetupId: string; accept: boolean }
        | { kind: "cancel"; meetupId: string },
    ) => {
      if (action.kind === "propose") {
        await proposeMeetup({
          conversationId,
          placeId: action.placeId,
          scheduledAt: action.when,
        });
        return;
      }
      if (action.kind === "respond") {
        await respondToMeetup(action.meetupId, action.accept);
        return;
      }
      await cancelMeetup(action.meetupId);
    },
    onSuccess: () => {
      setPendingPlace(null);
      void meetup.refetch();
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error) => {
      setPendingPlace(null);
      setSendError(errorMessage(error, "Buluşma işlemi tamamlanamadı."));
      void captureClientError(error, "chat/meetup");
    },
  });

  // Sayfalar yeniden eskiye gelir, her sayfa kendi içinde eskiden yeniye.
  // Ekranda tek bir artan liste isteniyor.
  const messageItems = useMemo(() => {
    const pages = messages.data?.pages ?? [];
    return [...pages].reverse().flatMap((page) => page.items);
  }, [messages.data?.pages]);
  const chatItems = useMemo(() => buildChatItems(messageItems), [messageItems]);
  const latestOutgoingId = useMemo(
    () => [...messageItems].reverse().find((message) => message.senderId === user?.id)?.id,
    [messageItems, user?.id],
  );

  useEffect(() => {
    if (!conversationId) return;
    return subscribeToConversation(conversationId, () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      void queryClient.invalidateQueries({ queryKey: ["conversations"] });
    });
  }, [conversationId, queryClient]);

  useEffect(() => {
    const counterpartUserId = conversation.data?.counterpartUserId;
    if (!conversationId || !user || !counterpartUserId || !conversation.data?.isActive) {
      return;
    }

    let disposed = false;
    const onTypingChange = (typing: boolean) => {
      if (remoteTypingStaleRef.current) clearTimeout(remoteTypingStaleRef.current);
      setRemoteTyping(typing);
      if (typing) {
        remoteTypingStaleRef.current = setTimeout(
          () => setRemoteTyping(false),
          REMOTE_TYPING_STALE_MS,
        );
      }
    };

    void subscribeToConversationSignals({
      conversationId,
      userId: user.id,
      counterpartUserId,
      onOnlineChange: setRemoteOnline,
      onTypingChange,
    })
      .then((subscription) => {
        if (disposed) subscription.unsubscribe();
        else signalRef.current = subscription;
      })
      .catch((error) => {
        console.error("Sohbet aktivite sinyalleri başlatılamadı:", error);
      });

    return () => {
      disposed = true;
      if (remoteTypingStaleRef.current) clearTimeout(remoteTypingStaleRef.current);
      signalRef.current?.unsubscribe();
      signalRef.current = null;
    };
  }, [
    conversation.data?.counterpartUserId,
    conversation.data?.isActive,
    conversationId,
    user,
  ]);

  useEffect(() => {
    if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    const typing = Boolean(body.trim());
    signalRef.current?.setTyping(typing);
    if (typing) {
      typingIdleRef.current = setTimeout(() => {
        signalRef.current?.setTyping(false);
      }, TYPING_IDLE_MS);
    }
    return () => {
      if (typingIdleRef.current) clearTimeout(typingIdleRef.current);
    };
  }, [body]);

  useEffect(() => {
    if (!conversationId || !messageItems.length) return;
    void markConversationRead(conversationId)
      .then(() => queryClient.invalidateQueries({ queryKey: ["conversations"] }))
      .catch((error) => console.error("Mesajlar okundu işaretlenemedi:", error));
  }, [conversationId, messageItems, queryClient]);

  const send = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("Oturum bulunamadı.");
      return sendMessage({
        conversationId,
        senderId: user.id,
        body: text,
      });
    },
    onMutate: (text) => {
      setBody((current) => (current.trim() === text ? "" : current));
      setSendError(null);
      setFailedMessage(null);
      signalRef.current?.setTyping(false);
    },
    onSuccess: async (message) => {
      // İlk sayfa en yeniyi taşıyor; gönderilen mesaj oraya eklenir.
      // Realtime aynı mesajı geri getirebildiği için id ile tekilleştiriyoruz.
      queryClient.setQueryData<InfiniteData<ChatMessagePage, ChatMessageCursor | null>>(
        ["messages", conversationId],
        (current) => {
          if (!current || current.pages.length === 0) return current;
          const [newest, ...older] = current.pages;
          const withoutDuplicate = newest.items.filter((item) => item.id !== message.id);
          return {
            ...current,
            pages: [{ ...newest, items: [...withoutDuplicate, message] }, ...older],
          };
        },
      );
      setSendError(null);
      setFailedMessage(null);
      nearBottomRef.current = true;
      setNewMessageBelow(false);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (error, text) => {
      setFailedMessage(text);
      setBody((current) => current || text);
      // Supabase PostgrestError bir Error örneği DEĞİL; instanceof kontrolü
      // her veritabanı hatasını yedek metne düşürüyordu ve gerçek sebep
      // hiçbir yerde görünmüyordu.
      setSendError(errorMessage(error, "Mesaj gönderilemedi."));
      void captureClientError(error, "chat/send");
    },
  });

  const latestMessage = messageItems.at(-1);
  useEffect(() => {
    if (!latestMessage || latestMessage.id === latestMessageRef.current) return;
    const initial = latestMessageRef.current === null;
    latestMessageRef.current = latestMessage.id;
    const mine = latestMessage.senderId === user?.id;
    if (initial || mine || nearBottomRef.current) {
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: !initial }),
      );
      setNewMessageBelow(false);
    } else {
      setNewMessageBelow(true);
    }
  }, [latestMessage, user?.id]);

  const title =
    conversation.data?.petName ??
    conversation.data?.counterpartDisplayName ??
    "Konuşma";

  const activityText = (() => {
    if (!conversation.data?.isActive) return "Konuşma kapatıldı";
    if (remoteTyping) return "Yazıyor…";
    if (remoteOnline) return "Şu an bu sohbette";
    switch (ownerProfile.data?.activityBucket) {
      case "today":
        return "Bugün aktifti";
      case "this_week":
        return "Bu hafta aktifti";
      case "this_month":
        return "Bu ay aktifti";
      default:
        return "Konuşma açık";
    }
  })();

  const submitMessage = (text = body) => {
    const trimmed = text.trim();
    if (!trimmed || send.isPending) return;
    send.mutate(trimmed);
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const nearBottom =
      contentSize.height - (contentOffset.y + layoutMeasurement.height) < 120;
    nearBottomRef.current = nearBottom;
    if (nearBottom && newMessageBelow) setNewMessageBelow(false);
  };

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
        errorMessage(actionError, "İşlem tamamlanamadı."),
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
        <View className="flex-row items-center border-b border-border bg-surface px-3 py-2.5">
          <Pressable
            onPress={() => router.back()}
            accessibilityLabel="Geri"
            className="h-11 w-11 items-center justify-center rounded-full"
          >
            <Ionicons name="chevron-back" color="#1F1A17" size={27} />
          </Pressable>
          {conversation.data?.petPhotoUrl ? (
            <Image
              source={conversation.data.petPhotoUrl}
              accessibilityLabel={`${title} profil fotoğrafı`}
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
            <View className="mt-0.5 flex-row items-center gap-1.5">
              {remoteOnline && conversation.data?.isActive ? (
                <View className="h-2 w-2 rounded-full bg-accent" />
              ) : null}
              <Text
                className={`text-xs ${
                  remoteTyping ? "font-semibold text-accent-dark" : "text-text-secondary"
                }`}
                accessibilityLiveRegion="polite"
              >
                {activityText}
              </Text>
            </View>
          </View>
          <Pressable
            onPress={() => setSafetyVisible(true)}
            disabled={safetyBusy || !conversation.data}
            accessibilityLabel="Konuşma güvenliği"
            accessibilityHint="Engelleme, şikâyet ve eşleşmeyi kaldırma seçeneklerini açar"
            className="h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
          >
            <Ionicons name="ellipsis-horizontal" color="#1F1A17" size={24} />
          </Pressable>
        </View>

        {ownerProfile.data ? (
          <Pressable
            onPress={() => setOwnerSheet(true)}
            accessibilityRole="button"
            accessibilityLabel={`${ownerProfile.data.displayName ?? "Pet sahibi"} profilini aç`}
            className="border-b border-border bg-bg-secondary px-4 py-3"
          >
            <View className="flex-row items-center">
              {ownerProfile.data.photoUrl ? (
                <Image
                  source={ownerProfile.data.photoUrl}
                  accessibilityLabel="Pet sahibinin profil fotoğrafı"
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
                    <Ionicons
                      name="shield-checkmark"
                      accessibilityLabel="Doğrulanmış sahip"
                      color="#2FB8A6"
                      size={16}
                    />
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
                    ownerProfile.data.socialOpen ? t("ownerConnection.badge") : null,
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
            <View className="mt-1.5 flex-row items-center">
              <Text className="text-xs font-semibold text-brand-dark">
                Sahip profiline bak
              </Text>
              <Ionicons name="chevron-forward" color="#F97362" size={14} />
            </View>
          </Pressable>
        ) : null}

        {meetup.data ? (
          <View className="pt-3">
            <MeetupCard
              meetup={meetup.data}
              busy={meetupAction.isPending}
              onRespond={(accept) =>
                meetupAction.mutate({
                  kind: "respond",
                  meetupId: meetup.data!.id,
                  accept,
                })
              }
              onCancel={() =>
                meetupAction.mutate({ kind: "cancel", meetupId: meetup.data!.id })
              }
            />
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
              accessibilityRole="button"
              className="mt-5 min-h-11 justify-center rounded-xl bg-brand px-5 py-3"
            >
              <Text className="font-semibold text-white">Tekrar dene</Text>
            </Pressable>
          </View>
        ) : null}

        {!conversation.isLoading &&
        !messages.isLoading &&
        !conversation.isError &&
        !messages.isError ? (
          <View className="flex-1">
            <FlatList
              ref={listRef}
              data={chatItems}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) =>
                item.kind === "date" ? (
                  <DateSeparator isoDate={item.isoDate} />
                ) : (
                  <MessageBubble
                    message={item.message}
                    mine={item.message.senderId === user?.id}
                    grouped={item.grouped}
                    latestMine={item.message.id === latestOutgoingId}
                  />
                )
              }
              onScroll={onScroll}
              scrollEventThrottle={100}
              maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
              contentContainerStyle={{
                flexGrow: 1,
                justifyContent: "flex-end",
                paddingTop: 10,
                paddingBottom: 20,
              }}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                messages.hasNextPage ? (
                  <View className="items-center pb-2 pt-1">
                    <Pressable
                      onPress={() => void messages.fetchNextPage()}
                      disabled={messages.isFetchingNextPage}
                      accessibilityLabel="Daha eski mesajları yükle"
                      className="min-h-11 flex-row items-center justify-center rounded-full border border-border bg-surface px-4 disabled:opacity-60"
                    >
                      {messages.isFetchingNextPage ? (
                        <ActivityIndicator color="#9A8B82" size="small" />
                      ) : null}
                      <Text className="text-xs font-semibold text-text-secondary">
                        {messages.isFetchingNextPage
                          ? " Yükleniyor…"
                          : "Daha eski mesajları göster"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center px-7 py-12">
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-brand/10">
                    <Ionicons name="chatbubble-ellipses-outline" color="#F97362" size={32} />
                  </View>
                  <Text className="mt-4 text-center text-lg font-bold text-text-primary">
                    Güzel bir başlangıç yap
                  </Text>
                  <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">
                    Petlerinizin alışkanlıklarını konuşun; ilk buluşmayı halka açık bir yerde
                    planlayın.
                  </Text>
                  <QuickReplyStarters onSelect={setBody} />
                </View>
              }
            />
            {newMessageBelow ? (
              <Pressable
                onPress={() => {
                  listRef.current?.scrollToEnd({ animated: true });
                  nearBottomRef.current = true;
                  setNewMessageBelow(false);
                }}
                accessibilityLabel="Yeni mesaja git"
                className="absolute bottom-3 self-center rounded-full bg-text-primary px-4 py-2.5 shadow-sm"
              >
                <Text className="text-xs font-bold text-white">Yeni mesaj ↓</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {sendError ? (
          <View
            className="mx-3 mb-2 flex-row items-center rounded-xl border border-danger/30 bg-danger/10 px-3 py-2"
            accessibilityRole="alert"
          >
            <Ionicons name="alert-circle-outline" color="#E5484D" size={18} />
            <Text className="ml-2 flex-1 text-xs text-danger">{sendError}</Text>
            {failedMessage ? (
              <Pressable
                onPress={() => submitMessage(failedMessage)}
                disabled={send.isPending}
                className="min-h-11 justify-center px-2"
              >
                <Text className="text-xs font-bold text-danger">Tekrar dene</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {conversation.data?.askMeetupFeedback ? (
          <MeetupFeedbackPrompt
            petName={conversation.data.petName}
            onAnswer={async (outcome) => {
              await recordMeetupFeedback(conversationId, outcome);
              await queryClient.invalidateQueries({ queryKey: ["conversations"] });
              await queryClient.invalidateQueries({
                queryKey: ["conversation", conversationId],
              });
            }}
          />
        ) : null}

        {conversation.data?.isActive ? (
          <View className="border-t border-border bg-surface pb-2 pt-2">
            {messageItems.length ? (
              <View className="flex-row items-center">
                {/* Canlı buluşma varken ikinci öneri açılamıyor (0043'teki
                    tek-canlı-buluşma kuralı); düğmeyi de göstermiyoruz. */}
                {(meetupPlaces.data?.length ?? 0) > 0 && !meetup.data ? (
                  <Pressable
                    onPress={() => setPlacePickerVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel="Buluşma yeri öner"
                    className="ml-3 min-h-11 flex-row items-center justify-center rounded-full border border-brand/40 bg-brand/10 px-3"
                  >
                    <Ionicons name="location-outline" color="#E0523F" size={16} />
                    <Text className="ml-1.5 text-xs font-bold text-brand-dark">
                      Buluşma yeri
                    </Text>
                  </Pressable>
                ) : null}
                <View className="flex-1">
                  <QuickReplyBar replies={quickReplies.slice(1)} onSelect={setBody} />
                </View>
              </View>
            ) : null}
            <View className="flex-row items-end gap-2 px-3">
              <View className="flex-1">
                <TextInput
                  value={body}
                  onChangeText={setBody}
                  placeholder="Mesaj yaz…"
                  placeholderTextColor="#9A8B82"
                  multiline
                  maxLength={2000}
                  accessibilityLabel="Mesaj"
                  accessibilityHint="Göndermek istediğin mesajı yaz"
                  className="max-h-28 min-h-11 rounded-2xl bg-bg-secondary px-4 py-3 text-[15px] text-text-primary"
                />
                {body.length >= 1800 ? (
                  <Text className="mr-2 mt-1 text-right text-[11px] text-text-tertiary">
                    {body.length}/2000
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => submitMessage()}
                disabled={!body.trim() || send.isPending}
                accessibilityLabel="Mesaj gönder"
                accessibilityState={{ disabled: !body.trim() || send.isPending }}
                className="h-11 w-11 items-center justify-center rounded-full bg-brand disabled:opacity-40"
              >
                {send.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" color="#FFFFFF" size={20} />
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View className="border-t border-border bg-bg-secondary px-4 py-4">
            <Text className="text-center text-sm font-semibold text-text-secondary">
              Bu konuşmaya artık mesaj gönderilemez.
            </Text>
          </View>
        )}
      </KeyboardAvoidingView>
      <MeetupPlacePicker
        visible={placePickerVisible}
        places={meetupPlaces.data ?? []}
        onClose={() => setPlacePickerVisible(false)}
        onSelect={(place) => {
          setPlacePickerVisible(false);
          // Artık metin yazmıyoruz: buluşma bir KAYIT (0043). Yer seçildi,
          // sırada zorunlu olan gün/saat adımı var.
          setPendingPlace(place);
        }}
      />

      <MeetupScheduleSheet
        place={pendingPlace}
        busy={meetupAction.isPending}
        onClose={() => setPendingPlace(null)}
        onPropose={(when) =>
          meetupAction.mutate({
            kind: "propose",
            placeId: pendingPlace!.id,
            when,
          })
        }
      />

      <OwnerSheet
        owner={ownerProfile.data ?? null}
        petName={conversation.data?.petName ?? ""}
        visible={ownerSheet && Boolean(ownerProfile.data)}
        onClose={() => setOwnerSheet(false)}
      />

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
