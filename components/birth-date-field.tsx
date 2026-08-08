import { useMemo, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";

import {
  adultCutoffDate,
  formatIsoDateForDisplay,
  parseIsoDate,
  toIsoDate,
} from "../core/domain/date-validation";

type Props = {
  label: string;
  helper?: string;
  value: string;
  onChange: (isoDate: string) => void;
};

/**
 * 18+ kapısını doğrulamayla değil, SEÇİLEMEZ kılarak uygular.
 *
 * Önceki hali serbest metin bir alandı: kullanıcı `YYYY-AA-GG` biçiminde
 * yazmak zorundaydı (okuduğu sıranın tersi), alfabetik klavyeyle karşılaşıp
 * sayı katmanına geçiyor, tireleri elle koyuyordu ve 18 yaş kuralını ancak
 * "Devam"a bastıktan sonra, formun en altında beliren bir hata kutusundan
 * öğreniyordu.
 *
 * Burada `maximumDate` doğrudan 18 yıl öncesine kilitli. Kural ihlal
 * edilemediği için ona ait doğrulama hatasına da gerek kalmıyor — hata
 * mesajı yazmak yerine hatayı imkânsız kıldık.
 */
export function BirthDateField({ label, helper, value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  const maximumDate = useMemo(() => adultCutoffDate(), []);

  // Takvim 18 yaşında değil, makul bir yerde açılsın: 28 yaş civarı hem
  // kullanıcının çoğunluğuna yakın hem de tekerleği az çeviriyor.
  const initialDate = useMemo(() => {
    const parsed = parseIsoDate(value);
    if (parsed) return parsed;
    const today = new Date();
    return new Date(today.getFullYear() - 28, today.getMonth(), today.getDate());
  }, [value]);

  const display = value ? formatIsoDateForDisplay(value) : null;

  const handleChange = (_event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS !== "ios") setOpen(false);
    if (selected) onChange(toIsoDate(selected));
  };

  return (
    <View className="mb-4">
      <Text className="mb-2 text-sm font-semibold text-text-primary">{label}</Text>

      <Pressable
        onPress={() => setOpen((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={
          display ? `${label}: ${display}. Değiştirmek için dokun.` : `${label} seç`
        }
        className={`rounded-xl border px-4 py-4 ${
          display ? "border-brand bg-brand/5" : "border-border bg-surface"
        }`}
      >
        <Text
          className={
            display ? "font-semibold text-text-primary" : "text-text-tertiary"
          }
        >
          {display ?? "Doğum tarihini seç"}
        </Text>
      </Pressable>

      {helper ? (
        <Text className="mt-2 text-xs text-text-tertiary">{helper}</Text>
      ) : null}

      {open ? (
        <View className="mt-2 overflow-hidden rounded-xl border border-border bg-surface">
          <DateTimePicker
            value={initialDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            maximumDate={maximumDate}
            locale="tr-TR"
            onChange={handleChange}
          />
          {Platform.OS === "ios" ? (
            <Pressable
              onPress={() => {
                // Tekerlek hiç çevrilmediyse seçim olayı hiç gelmez; kullanıcı
                // ekranda gördüğü tarihi onaylamış sayılmalı.
                if (!value) onChange(toIsoDate(initialDate));
                setOpen(false);
              }}
              className="items-center border-t border-border py-3"
            >
              <Text className="font-semibold text-brand-dark">Tamam</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
