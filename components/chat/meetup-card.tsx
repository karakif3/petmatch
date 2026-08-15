import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { ConversationMeetup } from "../../core/api/meetups";
import { addMeetupToCalendar } from "../../core/calendar";
import { getIntlLocale } from "../../core/i18n";
import { MeetupPlaceTrust } from "./meetup-place-trust";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(getIntlLocale(), {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Sohbetteki buluşma kartı.
 *
 * Buluşma normal bir mesaj DEĞİL, ayrı bir kayıt (0043) — bu yüzden ayrı bir
 * kart olarak duruyor ve mesaj akışıyla karışmıyor. Sebebi sadece görsel
 * değil: "cumartesi 15:00 Yoğurtçu Parkı" bir metin mesajı olarak yazılırsa
 * ne karşı taraf onaylayabilir ne de biz sonradan "buluşma gerçekleşti mi"
 * diye sorabiliriz.
 *
 * Yanıt düğmeleri yalnızca KARŞI tarafa gösteriliyor. Sunucu zaten önerenin
 * kendi önerisini onaylamasını reddediyor; buradaki gizleme, kullanıcıya
 * çalışmayacak bir düğme göstermemek için.
 */
export function MeetupCard({
  meetup,
  busy,
  onRespond,
  onCancel,
}: {
  meetup: ConversationMeetup;
  busy?: boolean;
  onRespond: (accept: boolean) => void;
  onCancel: () => void;
}) {
  const accepted = meetup.status === "accepted";
  const past = new Date(meetup.scheduledAt).getTime() < Date.now();
  const [addingToCalendar, setAddingToCalendar] = useState(false);

  const addToCalendar = async () => {
    if (addingToCalendar) return;
    setAddingToCalendar(true);
    try {
      const result = await addMeetupToCalendar({
        title: `PetMatch buluşması: ${meetup.placeName}`,
        location: meetup.placeName,
        notes:
          [meetup.placeNote, meetup.sourceUrl ? `Kaynak: ${meetup.sourceUrl}` : null]
            .filter(Boolean)
            .join("\n") || undefined,
        startDate: new Date(meetup.scheduledAt),
      });
      if (result === "denied") {
        Alert.alert(
          "Takvim izni gerekiyor",
          "Buluşmayı takvimine ekleyebilmek için ayarlardan takvim izni vermen gerekiyor.",
        );
        return;
      }
      Alert.alert("Eklendi", "Buluşma takvimine eklendi.");
    } catch {
      Alert.alert("Olmadı", "Buluşma takvime eklenemedi, tekrar dener misin?");
    } finally {
      setAddingToCalendar(false);
    }
  };

  return (
    <View
      className={`mx-4 mb-3 rounded-2xl border p-4 ${
        accepted ? "border-accent/40 bg-accent/5" : "border-brand/30 bg-brand/5"
      }`}
    >
      <View className="flex-row items-center">
        <Ionicons
          name={accepted ? "checkmark-circle" : "calendar-outline"}
          color={accepted ? "#2FB8A6" : "#F97362"}
          size={19}
        />
        <Text
          className={`ml-2 text-sm font-bold ${
            accepted ? "text-accent-dark" : "text-brand-dark"
          }`}
        >
          {accepted ? "Buluşma onaylandı" : "Buluşma önerisi"}
        </Text>
      </View>

      <Text className="mt-2.5 text-base font-bold text-text-primary">
        {meetup.placeName}
      </Text>
      <Text className="mt-0.5 text-sm text-text-secondary">
        {formatWhen(meetup.scheduledAt)}
      </Text>
      {meetup.placeNote ? (
        <Text className="mt-1.5 text-xs leading-4 text-text-tertiary">
          {meetup.placeNote}
        </Text>
      ) : null}
      <MeetupPlaceTrust
        verificationMethod={meetup.verificationMethod}
        sourceName={meetup.sourceName}
        sourceUrl={meetup.sourceUrl}
        amenities={meetup.amenities}
      />

      {busy ? (
        <View className="mt-3 items-center">
          <ActivityIndicator color="#F97362" />
        </View>
      ) : meetup.status === "proposed" && !meetup.mine ? (
        <View className="mt-3.5 flex-row gap-2.5">
          <Pressable
            onPress={() => onRespond(true)}
            accessibilityRole="button"
            className="flex-1 items-center rounded-xl bg-brand py-3"
          >
            <Text className="text-sm font-bold text-white">Uygunum</Text>
          </Pressable>
          <Pressable
            onPress={() => onRespond(false)}
            accessibilityRole="button"
            className="flex-1 items-center rounded-xl border border-border bg-surface py-3"
          >
            <Text className="text-sm font-semibold text-text-primary">Olmaz</Text>
          </Pressable>
        </View>
      ) : meetup.status === "proposed" ? (
        <View className="mt-3 flex-row items-center justify-between">
          <Text className="text-xs text-text-tertiary">Yanıt bekleniyor</Text>
          <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={8}>
            <Text className="text-xs font-semibold text-danger">Geri al</Text>
          </Pressable>
        </View>
      ) : accepted && !past ? (
        <View className="mt-3">
          <Text className="text-xs text-text-tertiary">
            Halka açık bir yerde buluşun, planınızı bir yakınınıza söyleyin.
          </Text>
          <View className="mt-2.5 flex-row items-center justify-between">
            <Pressable
              onPress={() => void addToCalendar()}
              disabled={addingToCalendar}
              accessibilityRole="button"
              accessibilityLabel="Takvime ekle"
              className="min-h-9 flex-row items-center rounded-lg border border-border bg-surface px-3 disabled:opacity-60"
            >
              {addingToCalendar ? (
                <ActivityIndicator color="#F97362" size="small" />
              ) : (
                <>
                  <Ionicons name="calendar-outline" color="#F97362" size={14} />
                  <Text className="ml-1.5 text-xs font-semibold text-text-primary">
                    Takvime ekle
                  </Text>
                </>
              )}
            </Pressable>
            <Pressable onPress={onCancel} accessibilityRole="button" hitSlop={8}>
              <Text className="ml-3 text-xs font-semibold text-danger">İptal</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
