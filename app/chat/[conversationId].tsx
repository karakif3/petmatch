import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Text,
  TextInput,
  View,
} from "react-native";
// SafeAreaView react-native'den DEĞİL buradan geliyor: deprecated olan
// sürüm iOS 26'da KeyboardAvoidingView zinciriyle birlikte içeriği sıfır
// yüksekliğe düşürüyor ve ekran boş render ediliyordu.
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
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
import { captureClientError } from "../../core/api/observability";
import { OwnerSheet } from "../../components/owner-sheet";
import {
  cancelMeetup,
  loadConversationMeetup,
  proposeMeetup,
  respondToMeetup,
  subscribeToMeetup,
} from "../../core/api/meetups";
import type { MeetupPlace } from "../../core/api/meetup-places";
import { AppPressable } from "../../components/ui/pressable";
import { errorMessage } from "../../core/domain/error-message";
import { decisionHaptic, warningHaptic } from "../../core/ui/haptics";
import { shadowSm } from "../../core/ui/shadow";
import { useAuthStore } from "../../stores/auth";
import { AppIcon } from "../../components/ui/icon";

const TYPING_IDLE_MS = 2_500;
const REMOTE_TYPING_STALE_MS = 4_000;

export default function ChatScreen() {
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
    if (!conversationId) return;
    return subscribeToMeetup(conversationId, () => {
      void queryClient.invalidateQueries({ queryKey: ["conversation-meetup", conversationId] });
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
      // Tek requestAnimationFrame'in içerik hâlâ ölçülürken (üstteki
      // buluşma/sahip kartı, tarih ayracı) çağrılması yeterli olmuyordu —
      // scrollToEnd o anki eksik yüksekliğe göre hesaplanıp son mesajı
      // katlanmış görünüm dışında bırakıyordu. İkinci, biraz geciktirilmiş
      // çağrı düzen kesinleştikten sonra pozisyonu düzeltiyor.
      requestAnimationFrame(() =>
        listRef.current?.scrollToEnd({ animated: !initial }),
      );
      const settle = setTimeout(
        () => listRef.current?.scrollToEnd({ animated: false }),
        120,
      );
      setNewMessageBelow(false);
      return () => clearTimeout(settle);
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
    warningHaptic();
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
        {/*
          Sahip bloğu önceden ayrı, tam genişlikte bir kart olarak her
          açılışta yer kaplıyordu (avatar + isim/rozetler + bio + "profile
          bak" satırı, ~120pt). O bilginin TAMAMI zaten `OwnerSheet`'te var
          — burada tekrar etmenin tek gerekçesi keşfedilebilirlikti. Şimdi
          header'ın ikinci satırına çökertildi: küçük bir rozet, dokununca
          aynı sheet açılıyor. Mesaj listesi kazandığı alanı doğrudan alıyor.
        */}
        <View className="border-b border-border bg-surface px-3 py-2.5">
          <View className="flex-row items-center">
            <AppPressable
              onPress={() => router.back()}
              accessibilityLabel="Geri"
              className="h-11 w-11 items-center justify-center rounded-full"
            >
              <AppIcon name="chevron-left" color="#1F1A17" size={27} />
            </AppPressable>
            {conversation.data?.petPhotoUrl ? (
              <Image
                source={conversation.data.petPhotoUrl}
                accessibilityLabel={`${title} profil fotoğrafı`}
                contentFit="cover"
                style={{ width: 42, height: 42, borderRadius: 14 }}
              />
            ) : (
              <View className="h-[42px] w-[42px] items-center justify-center rounded-[14px] bg-bg-tertiary">
                <AppIcon name="paw-print" color="#C4B7AE" size={20} />
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
            <AppPressable
              onPress={() => setSafetyVisible(true)}
              disabled={safetyBusy || !conversation.data}
              accessibilityLabel="Konuşma güvenliği"
              accessibilityHint="Engelleme, şikâyet ve eşleşmeyi kaldırma seçeneklerini açar"
              className="h-11 w-11 items-center justify-center rounded-full disabled:opacity-40"
            >
              <AppIcon name="ellipsis" color="#1F1A17" size={24} />
            </AppPressable>
          </View>

          {ownerProfile.data ? (
            <AppPressable
              onPress={() => setOwnerSheet(true)}
              accessibilityRole="button"
              accessibilityLabel={`${ownerProfile.data.displayName ?? "Pet sahibi"} profilini aç`}
              className="ml-11 mt-1.5 flex-row items-center self-start rounded-full bg-bg-secondary py-1 pl-1 pr-2.5"
            >
              {ownerProfile.data.photoUrl ? (
                <Image
                  source={ownerProfile.data.photoUrl}
                  accessibilityLabel="Pet sahibinin profil fotoğrafı"
                  contentFit="cover"
                  style={{ width: 22, height: 22, borderRadius: 11 }}
                />
              ) : (
                <View className="h-[22px] w-[22px] items-center justify-center rounded-full bg-bg-tertiary">
                  <AppIcon name="user" color="#9A8B82" size={12} />
                </View>
              )}
              <Text className="ml-1.5 text-xs font-semibold text-text-primary" numberOfLines={1}>
                {ownerProfile.data.displayName ?? "Pet sahibi"}
              </Text>
              {ownerProfile.data.verified ? (
                <AppIcon
                  name="shield-check"
                  accessibilityLabel="Doğrulanmış sahip"
                  color="#2FB8A6"
                  size={13}
                  style={{ marginLeft: 4 }}
                />
              ) : null}
              <AppIcon name="chevron-right" color="#9A8B82" size={12} style={{ marginLeft: 2 }} />
            </AppPressable>
          ) : null}
        </View>

        {meetup.data ? (
          <View className="pt-3">
            <MeetupCard
              meetup={meetup.data}
              busy={meetupAction.isPending}
              onRespond={(accept) => {
                decisionHaptic();
                meetupAction.mutate({
                  kind: "respond",
                  meetupId: meetup.data!.id,
                  accept,
                });
              }}
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
            <AppIcon name="circle-alert" color="#E5484D" size={44} />
            <Text className="mt-4 text-center text-lg font-bold text-text-primary">
              Konuşma yüklenemedi
            </Text>
            <AppPressable
              onPress={() => {
                void conversation.refetch();
                void messages.refetch();
              }}
              accessibilityRole="button"
              className="mt-5 min-h-11 justify-center rounded-xl bg-brand px-5 py-3"
            >
              <Text className="font-semibold text-white">Tekrar dene</Text>
            </AppPressable>
          </View>
        ) : null}

        {!conversation.isLoading &&
        !messages.isLoading &&
        !conversation.isError &&
        !messages.isError ? (
          <View
            className="flex-1"
            onLayout={() => {
              // Buluşma istemi/hata şeridi gibi ALTTAKİ kardeşler farklı bir
              // anda mount olup bu View'a kalan yüksekliği değiştirdiğinde de
              // tetiklenir — mesajlar hiç değişmese bile son mesajın hâlâ
              // dışarıda kalmadığını garantiliyor.
              if (nearBottomRef.current) {
                requestAnimationFrame(() =>
                  listRef.current?.scrollToEnd({ animated: false }),
                );
              }
            }}
          >
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
                    <AppPressable
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
                    </AppPressable>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center px-7 py-12">
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-brand/10">
                    <AppIcon name="message-circle" color="#F97362" size={32} />
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
            {/*
              Mesajlar listenin üst sınırında SERT kesiliyordu: yukarı kayan
              bir balonun harfleri ortadan bıçakla kesilmiş gibi duruyor ve
              render hatası izlenimi veriyordu (canlı denemede önce hata
              sanıldı). Liste zaten üstteki buluşma kartının altından
              başlıyor; ince bir gradyan kesiği "alta kayıyor" hissine
              çeviriyor. Dokunmayı engellememesi için pointerEvents none.
            */}
            <LinearGradient
              pointerEvents="none"
              colors={["#FFFBF7", "rgba(255,251,247,0)"]}
              style={{ position: "absolute", top: 0, left: 0, right: 0, height: 14 }}
            />

            {newMessageBelow ? (
              <AppPressable
                onPress={() => {
                  listRef.current?.scrollToEnd({ animated: true });
                  nearBottomRef.current = true;
                  setNewMessageBelow(false);
                }}
                accessibilityLabel="Yeni mesaja git"
                style={shadowSm}
                className="absolute bottom-3 self-center rounded-full bg-text-primary px-4 py-2.5"
              >
                <Text className="text-xs font-bold text-white">Yeni mesaj ↓</Text>
              </AppPressable>
            ) : null}
          </View>
        ) : null}

        {sendError ? (
          <View
            className="mx-3 mb-2 flex-row items-center rounded-xl border border-danger/30 bg-danger/10 px-3 py-2"
            accessibilityRole="alert"
          >
            <AppIcon name="circle-alert" color="#E5484D" size={18} />
            <Text className="ml-2 flex-1 text-xs text-danger">{sendError}</Text>
            {failedMessage ? (
              <AppPressable
                onPress={() => submitMessage(failedMessage)}
                disabled={send.isPending}
                className="min-h-11 justify-center px-2"
              >
                <Text className="text-xs font-bold text-danger">Tekrar dene</Text>
              </AppPressable>
            ) : null}
          </View>
        ) : null}

        {conversation.data?.askMeetupFeedback ? (
          <MeetupFeedbackPrompt
            petName={conversation.data.petName}
            meetupPlaceName={conversation.data.meetupPlaceName}
            meetupScheduledAt={conversation.data.meetupScheduledAt}
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
              <QuickReplyBar
                replies={quickReplies.slice(1)}
                onSelect={setBody}
                leading={
                  // Canlı buluşma varken ikinci öneri açılamıyor (0043'teki
                  // tek-canlı-buluşma kuralı); düğmeyi de göstermiyoruz.
                  (meetupPlaces.data?.length ?? 0) > 0 && !meetup.data ? (
                    <AppPressable
                      onPress={() => setPlacePickerVisible(true)}
                      accessibilityRole="button"
                      accessibilityLabel="Buluşma yeri öner"
                      className="min-h-11 flex-row items-center justify-center rounded-full border border-brand/40 bg-brand/10 px-3"
                    >
                      <AppIcon name="map-pin" color="#E0523F" size={16} />
                      <Text className="ml-1.5 text-xs font-bold text-brand-dark">
                        Buluşma yeri
                      </Text>
                    </AppPressable>
                  ) : null
                }
              />
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
              <AppPressable
                onPress={() => submitMessage()}
                disabled={!body.trim() || send.isPending}
                accessibilityLabel="Mesaj gönder"
                accessibilityState={{ disabled: !body.trim() || send.isPending }}
                className="h-11 w-11 items-center justify-center rounded-full bg-brand disabled:opacity-40"
              >
                {send.isPending ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <AppIcon name="send" color="#FFFFFF" size={20} />
                )}
              </AppPressable>
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
