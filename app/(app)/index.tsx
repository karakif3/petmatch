import { SafeAreaView, Text, View } from "react-native";

export default function DiscoverScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <View className="px-6 pt-4 pb-2">
        <Text className="text-text-primary text-2xl font-bold">Keşfet</Text>
        <Text className="text-text-secondary text-sm mt-1">
          Yakınındaki uyumlu oyun arkadaşları
        </Text>
      </View>

      <View className="flex-1 items-center justify-center px-10">
        <Text className="text-text-tertiary text-center">
          Kart destesi henüz bağlanmadı.{"\n"}
          Eleme ve sıralama mantığı core/domain/matching.ts içinde hazır.
        </Text>
      </View>
    </SafeAreaView>
  );
}
