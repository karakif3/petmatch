import type { ReactNode } from "react";
import { Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppPressable } from "./pressable";

/**
 * Gruplu liste dili (iOS "inset grouped" kalıbı).
 *
 * Profil ekranı bugüne kadar her bölümde AYRI bir görsel dil
 * kullanıyordu: kimi bölüm kart, kimi çerçevesiz input listesi, kimi
 * radyo düğmeleri, kimi tam genişlikte çerçeveli düğme. Tek tek hiçbiri
 * yanlış değildi ama yan yana gelince ekran "form" gibi değil "farklı
 * zamanlarda eklenmiş parçalar" gibi okunuyordu — premium hissini en
 * çok düşüren şey buydu.
 *
 * Kural: **her şey bir bölüm başlığı + kart içinde satır.** Satırlar
 * arasında saç teli ayırıcı, sağda değer ve/veya ok, solda isteğe bağlı
 * renkli ikon kutusu.
 */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Text className="mb-2 ml-1 text-[11px] font-bold uppercase text-text-tertiary">
      {children}
    </Text>
  );
}

export function SectionCard({ children }: { children: ReactNode }) {
  return (
    <View className="mb-7 overflow-hidden rounded-2xl border border-border bg-surface">
      {children}
    </View>
  );
}

/** Satırlar arasındaki saç teli çizgi; ikon kutusunun hizasından başlar. */
export function RowSeparator({ inset = true }: { inset?: boolean }) {
  return <View className={`h-px bg-border ${inset ? "ml-14" : ""}`} />;
}

type RowProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBackground?: string;
  title: string;
  detail?: string;
  /** Sağda gösterilen mevcut değer (ör. "Herkese açık"). */
  value?: string;
  /** Satırın sağındaki içerik (ör. `Switch`). Ok yerine geçer. */
  accessory?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  accessibilityHint?: string;
  /**
   * Satır bir YERE GÖTÜRMÜYOR, yerinde bir eylem yapıyorsa (ör. "Çıkış
   * yap") ok gösterilmez — ok "burada bir alt ekran var" demektir.
   */
  hideChevron?: boolean;
};

/**
 * Tek satır. `onPress` verilirse TÜM satır dokunulabilir olur.
 *
 * Bu ikincisi erişilebilirlik açısından önemliydi: bildirim satırlarında
 * yalnızca `Switch`'in kendisi (≈50×30 pt) dokunulabilirdi, satırın geri
 * kalanı ölüydü — motor becerisi kısıtlı bir kullanıcı için 44 pt hedef
 * kuralının açıkça dışında.
 */
export function Row({
  icon,
  iconColor = "#6B5D55",
  iconBackground = "bg-bg-tertiary",
  title,
  detail,
  value,
  accessory,
  onPress,
  disabled,
  destructive,
  accessibilityHint,
  hideChevron,
}: RowProps) {
  const content = (
    <View className="min-h-[56px] flex-row items-center px-4 py-3">
      {icon ? (
        <View
          className={`mr-3 h-9 w-9 items-center justify-center rounded-[10px] ${iconBackground}`}
        >
          <Ionicons name={icon} color={iconColor} size={18} />
        </View>
      ) : null}
      <View className="flex-1 pr-3">
        <Text
          className={`text-[15px] font-semibold ${
            destructive ? "text-danger" : "text-text-primary"
          }`}
        >
          {title}
        </Text>
        {detail ? (
          <Text className="mt-0.5 text-xs leading-4 text-text-secondary">{detail}</Text>
        ) : null}
      </View>
      {value ? (
        <Text className="mr-1 max-w-[40%] text-right text-[13px] text-text-secondary" numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {accessory}
      {onPress && !accessory && !hideChevron ? (
        <Ionicons name="chevron-forward" color="#C4B7AE" size={18} />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <AppPressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={value ? `${title}: ${value}` : title}
      accessibilityHint={accessibilityHint}
      className="disabled:opacity-50"
    >
      {content}
    </AppPressable>
  );
}
