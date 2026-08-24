import type { ReactNode } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppPressable } from "./pressable";

/**
 * Yasal onay ve rıza kutucukları önceden `☑`/`☐` metin glifiydi —
 * ekran okuyucuya `accessibilityRole="checkbox"` hiç bildirilmiyordu,
 * VoiceOver bunu düz metin olarak okuyordu.
 */
export function Checkbox({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  children: ReactNode;
}) {
  return (
    <AppPressable
      onPress={() => onChange(!checked)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      className="flex-row items-start"
    >
      <View
        className={`mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-md border-2 ${
          checked ? "border-brand bg-brand" : "border-border bg-surface"
        }`}
      >
        {checked ? <Ionicons name="checkmark" size={16} color="#FFFFFF" /> : null}
      </View>
      <View className="flex-1">{children}</View>
    </AppPressable>
  );
}
