import type { ReactNode } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { AppPressable } from "./pressable";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const containerStyles: Record<Variant, string> = {
  primary: "bg-brand",
  secondary: "border border-border bg-surface",
  ghost: "bg-transparent",
  danger: "bg-danger",
};

const labelStyles: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-text-primary",
  ghost: "text-text-secondary",
  danger: "text-white",
};

const iconColors: Record<Variant, string> = {
  primary: "#FFFFFF",
  secondary: "#1F1A17",
  ghost: "#6B5D55",
  danger: "#FFFFFF",
};

export function Button({
  label,
  onPress,
  variant = "primary",
  icon: Icon,
  loading = false,
  disabled = false,
  className = "",
  accessibilityLabel,
  children,
}: {
  label: string;
  onPress: () => void;
  variant?: Variant;
  icon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
  accessibilityLabel?: string;
  children?: ReactNode;
}) {
  const blocked = disabled || loading;

  return (
    <AppPressable
      onPress={onPress}
      disabled={blocked}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: blocked, busy: loading }}
      className={`min-h-12 flex-row items-center justify-center rounded-xl px-5 disabled:opacity-50 ${containerStyles[variant]} ${className}`}
    >
      {loading ? (
        <ActivityIndicator color={iconColors[variant]} />
      ) : (
        <>
          {Icon ? <Icon size={19} strokeWidth={2.25} color={iconColors[variant]} /> : null}
          <View className={Icon ? "ml-2" : ""}>
            {children ?? (
              <Text className={`font-bold ${labelStyles[variant]}`}>{label}</Text>
            )}
          </View>
        </>
      )}
    </AppPressable>
  );
}
