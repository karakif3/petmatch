import { Text, View } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { Button } from "./button";

export function EmptyState({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: "neutral" | "danger";
  action?: { label: string; onPress: () => void };
}) {
  const color = tone === "danger" ? "#E5484D" : "#C4B7AE";

  return (
    <View className="items-center px-8 py-12">
      <Icon color={color} size={48} strokeWidth={1.75} />
      <Text className="mt-4 text-center text-xl font-bold text-text-primary">{title}</Text>
      {description ? (
        <Text className="mt-2 text-center text-sm leading-5 text-text-secondary">{description}</Text>
      ) : null}
      {action ? (
        <Button
          label={action.label}
          onPress={action.onPress}
          variant="secondary"
          className="mt-5 self-stretch"
        />
      ) : null}
    </View>
  );
}
