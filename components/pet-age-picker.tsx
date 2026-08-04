import { Pressable, ScrollView, Text, View } from "react-native";

import { PET_AGE_OPTIONS, PET_AGE_UNKNOWN } from "../core/domain/pet-age";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

/**
 * Pete tam doğum tarihi sormak yerine yaş seçtirir.
 *
 * Gerekçe `core/domain/pet-age.ts` başında: sokaktan sahiplenen kullanıcı
 * doğum tarihini bilmiyor. "Bilmiyorum" listenin başında ve gerçek bir
 * seçenek — gizlenmiş bir kaçış yolu değil.
 */
export function PetAgePicker({ value, onChange }: Props) {
  const unknown = PET_AGE_OPTIONS.find((option) => option.value === PET_AGE_UNKNOWN)!;
  const known = PET_AGE_OPTIONS.filter((option) => option.value !== PET_AGE_UNKNOWN);

  const renderChip = (optionValue: string, label: string) => {
    const active = value === optionValue;
    return (
      <Pressable
        key={optionValue}
        onPress={() => onChange(optionValue)}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        className={`rounded-full border px-4 py-2.5 ${
          active ? "border-brand bg-brand/10" : "border-border bg-surface"
        }`}
      >
        <Text
          className={`text-sm ${
            active ? "font-semibold text-brand-dark" : "text-text-primary"
          }`}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-text-primary">Yaşı</Text>

      <View className="mb-2 flex-row">
        {renderChip(unknown.value, unknown.label)}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View className="flex-row gap-2 pr-6">
          {known.map((option) => renderChip(option.value, option.label))}
        </View>
      </ScrollView>

      <Text className="mt-2 text-xs text-text-tertiary">
        Yaklaşık yaş yeterli. Sonradan profilden değiştirebilirsin.
      </Text>
    </View>
  );
}
