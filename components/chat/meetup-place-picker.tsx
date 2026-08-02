import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import type { MeetupPlace } from "../../core/api/meetup-places";

/**
 * Buluşma yeri seçici.
 *
 * Yalnızca doğrulanmış yerler geliyor (sunucu öyle veriyor), o yüzden burada
 * ayrıca bir "acaba açık mı" uyarısı yok — liste boşsa seçici zaten hiç
 * açılmıyor, çağıran taraf butonu göstermiyor.
 */
export function MeetupPlacePicker({
  visible,
  places,
  onSelect,
  onClose,
}: {
  visible: boolean;
  places: MeetupPlace[];
  onSelect: (place: MeetupPlace) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          className="max-h-[70%] rounded-t-3xl bg-surface px-5 pb-8 pt-4"
          accessibilityViewIsModal
          onPress={(event) => event.stopPropagation()}
        >
          <View className="mb-1 h-1 w-10 self-center rounded-full bg-border" />

          <Text className="mt-3 text-lg font-bold text-text-primary">
            Buluşma yeri öner
          </Text>
          <Text className="mt-1 text-xs leading-4 text-text-secondary">
            Bölgende bilinen, halka açık noktalar. İlk buluşma için kalabalık bir
            yer seçmek ikiniz için de rahat olur.
          </Text>

          <ScrollView className="mt-4" keyboardShouldPersistTaps="handled">
            {places.map((place) => (
              <Pressable
                key={place.id}
                onPress={() => onSelect(place)}
                accessibilityRole="button"
                accessibilityLabel={`${place.name} öner`}
                className="mb-2 min-h-12 flex-row items-center rounded-2xl border border-border bg-bg-secondary px-4 py-3"
              >
                <Ionicons name="location-outline" size={18} color="#F97362" />
                <View className="ml-3 flex-1">
                  <Text className="text-sm font-semibold text-text-primary">
                    {place.name}
                  </Text>
                  {place.note ? (
                    <Text className="mt-0.5 text-xs text-text-secondary">{place.note}</Text>
                  ) : null}
                </View>
                <Ionicons name="chevron-forward" size={16} color="#C4B7AE" />
              </Pressable>
            ))}
          </ScrollView>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            className="mt-2 min-h-12 items-center justify-center"
          >
            <Text className="text-sm font-semibold text-text-secondary">Vazgeç</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
