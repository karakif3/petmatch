import type { LucideIcon } from "lucide-react-native";

import { AppPressable } from "./pressable";

export function IconButton({
  icon: Icon,
  label,
  onPress,
  color = "#1F1A17",
  size = 22,
  className = "",
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
  color?: string;
  size?: number;
  className?: string;
}) {
  return (
    <AppPressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      className={`h-11 w-11 items-center justify-center rounded-full ${className}`}
    >
      <Icon color={color} size={size} strokeWidth={2.25} />
    </AppPressable>
  );
}
