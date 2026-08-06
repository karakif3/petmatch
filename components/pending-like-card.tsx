import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { PendingLikeCard as PendingLikeCardData } from "../core/api/likes";

/**
 * "Kim beğendi" tuzeri — monetization.md: ücretsiz katman yalnızca SAYI
 * verir, kimlik ücretli katmana kadar açılmaz. Fotoğraf gerçek ama
 * `blurRadius` ile bulanık; isim/bio hiç render EDİLMİYOR (bulanık metin
 * ekran görüntüsünde okunabilir kalır, o yüzden hiç yazılmıyor).
 */
export function PendingLikeCard({ card }: { card: PendingLikeCardData }) {
  const photoUrl = card.photoUrls[0] ?? null;

  return (
    <View className="aspect-[3/4] w-[48%] overflow-hidden rounded-2xl bg-bg-tertiary">
      {photoUrl ? (
        <Image
          source={photoUrl}
          contentFit="cover"
          blurRadius={60}
          style={{ width: "100%", height: "100%" }}
        />
      ) : null}
      {/*
        Bulanıklık tek başına yetmez — sahip bir yazı/logo gibi keskin
        kenarlı bir şey paylaşmışsa (bazı test fotoğraflarında olduğu gibi)
        blurRadius onu okunaklı bırakabilir. Koyu örtü ikinci kat güvence.
      */}
      <View className="absolute inset-0 items-center justify-center bg-black/70">
        <View className="h-11 w-11 items-center justify-center rounded-full bg-white/90">
          <Ionicons name="lock-closed" size={19} color="#1F1A17" />
        </View>
        <Text className="mt-2 text-xs font-bold text-white">
          {card.species === "cat" ? "Bir kedi" : "Bir köpek"}
        </Text>
      </View>
    </View>
  );
}
