import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";

import type { MeetupPlace } from "../../core/api/meetup-places";
import { MeetupPlaceTrust } from "./meetup-place-trust";

/** Öneri varsayılanı: yarın 15:00. Kullanıcı çoğunlukla "yakın bir gün" istiyor. */
function defaultWhen(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(15, 0, 0, 0);
  return date;
}

/**
 * Yer seçildikten sonraki gün/saat adımı.
 *
 * Ayrı bir adım olmasının sebebi: buluşma bir KAYIT (0043) ve kaydın zamanı
 * zorunlu. Önceden akış yer seçip yazma alanına metin koyuyordu, kullanıcı
 * saati kendi yazıyordu; o metinden ne karşı taraf onay verebiliyordu ne de
 * sonradan "buluşma gerçekleşti mi" diye sorulabiliyordu.
 *
 * `minimumDate` şimdiye kilitli — sunucu da geçmişe öneriyi reddediyor, ama
 * kullanıcıya reddedilecek bir seçim yaptırmamak daha iyi.
 */
export function MeetupScheduleSheet({
  place,
  busy,
  onPropose,
  onClose,
}: {
  place: MeetupPlace | null;
  busy?: boolean;
  onPropose: (when: Date) => void;
  onClose: () => void;
}) {
  const [when, setWhen] = useState<Date>(defaultWhen);
  const minimumDate = useMemo(() => new Date(), []);

  if (!place) return null;

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (selected) setWhen(selected);
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          onPress={(event) => event.stopPropagation()}
          className="rounded-t-3xl bg-bg-primary px-6 pb-10 pt-4"
        >
          <View className="items-center pb-3">
            <View className="h-1.5 w-11 rounded-full bg-border" />
          </View>

          <View className="flex-row items-center">
            <Ionicons name="location-outline" color="#F97362" size={20} />
            <Text className="ml-2 flex-1 text-lg font-bold text-text-primary">
              {place.name}
            </Text>
          </View>
          <Text className="mt-1 text-xs text-text-secondary">
            Ne zaman buluşalım?
          </Text>
          <MeetupPlaceTrust
            verificationMethod={place.verificationMethod}
            sourceName={place.sourceName}
            sourceUrl={place.sourceUrl}
            amenities={place.amenities}
          />

          <View className="mt-2 overflow-hidden rounded-2xl border border-border bg-surface">
            <DateTimePicker
              value={when}
              mode="datetime"
              display={Platform.OS === "ios" ? "spinner" : "default"}
              minimumDate={minimumDate}
              locale="tr-TR"
              onChange={handleChange}
            />
          </View>

          <Pressable
            onPress={() => onPropose(when)}
            disabled={busy}
            accessibilityRole="button"
            className="mt-4 items-center rounded-xl bg-brand py-4 disabled:opacity-50"
          >
            <Text className="font-bold text-white">Buluşma öner</Text>
          </Pressable>
          <Pressable
            onPress={onClose}
            disabled={busy}
            accessibilityRole="button"
            className="mt-2 items-center py-3"
          >
            <Text className="text-sm font-semibold text-text-secondary">Vazgeç</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
