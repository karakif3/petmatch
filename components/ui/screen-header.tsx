import { Text, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";

import { IconButton } from "./icon-button";

export function ScreenHeader({
  title,
  subtitle,
  onBack,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}) {
  return (
    <View className="mb-6 flex-row items-center">
      {onBack ? (
        <IconButton icon={ArrowLeft} label="Geri" onPress={onBack} className="mr-2 bg-surface" />
      ) : null}
      <View className="flex-1">
        <Text accessibilityRole="header" className="text-2xl font-bold text-text-primary">
          {title}
        </Text>
        {subtitle ? <Text className="mt-1 text-xs text-text-tertiary">{subtitle}</Text> : null}
      </View>
    </View>
  );
}
