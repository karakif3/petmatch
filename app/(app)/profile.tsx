import { Pressable, SafeAreaView, Text, View } from "react-native";

import { useAuthStore } from "../../stores/auth";

export default function ProfileScreen() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <SafeAreaView className="flex-1 bg-bg-primary">
      <View className="px-6 pt-4">
        <Text className="text-text-primary text-2xl font-bold">Profil</Text>
        <Text className="text-text-secondary text-sm mt-1">{user?.email ?? "—"}</Text>
      </View>

      <View className="flex-1 justify-end px-6 pb-8">
        <Pressable
          onPress={signOut}
          className="border border-border rounded-xl py-4 items-center"
        >
          <Text className="text-danger font-semibold">Çıkış yap</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
