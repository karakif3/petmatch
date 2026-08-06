import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { PendingLikeCard as PendingLikeCardData } from "../core/api/likes";

/**
 * "Kim beğendi" tuzeri — monetization.md: ücretsiz katman yalnızca SAYI
 * verir, kimlik ücretli katmana kadar açılmaz.
 *
 * Bilinçli bir yumuşatma var: sahibi `socialOpen` ise (yani zaten Keşfet'te
 * adı + fotoğrafıyla görünüyor — 0021 bunu `public` görünürlük + ad + avatar
 * şartına bağlıyor) kart açık gösterilir. Bu, YENİ bir kimlik sızdırmıyor;
 * sadece "bu kişi seni beğendi" eşlemesini bu kohort için erken açıyor.
 * İleride gerçek premium eklenince koşul `socialOpen || isPremium` olur.
 *
 * Kilitli haldeyken fotoğraf gerçek ama `blurRadius` ile bulanık; isim/bio
 * hiç render EDİLMİYOR (bulanık metin ekran görüntüsünde okunabilir kalır,
 * o yüzden hiç yazılmıyor). Koyu örtü ikinci kat güvence — bazı fotoğraflara
 * gömülü keskin kenarlı yazı blurRadius'u delebiliyor.
 */
export function PendingLikeCard({ card }: { card: PendingLikeCardData }) {
  const photoUrl = card.photoUrls[0] ?? null;
  const unlocked = card.owner?.socialOpen ?? false;

  if (unlocked) {
    return (
      <View className="aspect-[3/4] w-[48%] overflow-hidden rounded-2xl bg-bg-tertiary">
        {photoUrl ? (
          <Image source={photoUrl} contentFit="cover" style={{ width: "100%", height: "100%" }} />
        ) : (
          <View className="h-full w-full items-center justify-center">
            <Ionicons name="paw" color="#C4B7AE" size={40} />
          </View>
        )}
        {card.owner?.photoUrl ? (
          <View className="absolute left-2.5 top-2.5 h-9 w-9 overflow-hidden rounded-full border-2 border-white">
            <Image source={card.owner.photoUrl} contentFit="cover" style={{ width: "100%", height: "100%" }} />
          </View>
        ) : null}
        <View className="absolute inset-x-0 bottom-0 bg-black/55 px-2.5 py-2">
          <Text className="text-sm font-bold text-white" numberOfLines={1}>
            {card.name}
          </Text>
          {card.owner?.displayName ? (
            <Text className="text-[11px] text-white/85" numberOfLines={1}>
              {card.owner.displayName}
            </Text>
          ) : null}
        </View>
      </View>
    );
  }

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
