import { SafeAreaView, Text, View } from "react-native";

export default function MatchesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <View className="px-6 pt-4 pb-2">
        <Text className="text-text-primary text-2xl font-bold">Eşleşmeler</Text>
      </View>

      <View className="flex-1 items-center justify-center px-10">
        <Text className="text-text-tertiary text-center">
          Henüz eşleşme yok.{"\n"}
          Eşleşme kaydı karşılıklı beğenide trigger ile oluşur.
        </Text>
      </View>
    </SafeAreaView>
  );
}
