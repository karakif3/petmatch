import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

export type OwnerDisclosure = {
  displayName: string | null;
  photoUrl: string | null;
  bio: string | null;
  gender: "female" | "male" | "other" | null;
  ageBucket: string | null;
  socialOpen: boolean;
  verified: boolean;
};

function genderLabel(gender: OwnerDisclosure["gender"]): string | null {
  if (gender === "female") return "Kadın";
  if (gender === "male") return "Erkek";
  if (gender === "other") return "Diğer";
  return null;
}

/**
 * Sahip profilinin alttan açılan paneli.
 *
 * Kartta sahip bloğu görünüyordu ama tıklanamıyordu: fotoğrafı ve bio'nun
 * ilk üç satırını görüp devamını görememek yarım kalmış bir vaatti.
 *
 * İki kural, ikisi de bilinçli:
 *
 * 1. **Tam ekran değil, panel.** Deste bağlamı kaybolmuyor; kullanıcı bakıp
 *    kapatıp kaydırmaya devam edebiliyor. Tam ekran bir profil, keşfet
 *    akışını kesip geri dönmeyi iş haline getirirdi.
 * 2. **Ek veri ÇEKİLMİYOR.** Panel yalnızca keşfet RPC'sinin zaten
 *    döndürdüğünü gösteriyor — tek fark bio'nun kırpılmaması. Buradan
 *    ayrı bir profil sorgusu atmak, `0021`'de sunucuda kurulan karşılıklı
 *    açıklama kuralını istemci tarafından delmek olurdu: sahibin
 *    görünürlüğü `hidden` ya da `after_match` ise RPC `owner` alanını zaten
 *    `null` veriyor ve panel hiç açılmıyor.
 */
export function OwnerSheet({
  owner,
  petName,
  visible,
  onClose,
}: {
  owner: OwnerDisclosure | null;
  petName: string;
  visible: boolean;
  onClose: () => void;
}) {
  if (!owner) return null;

  const gender = genderLabel(owner.gender);
  const facts = [gender, owner.ageBucket].filter(Boolean).join(" · ");

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        {/* İçeriğe dokunmak paneli kapatmasın. */}
        <Pressable
          onPress={(event) => event.stopPropagation()}
          className="max-h-[82%] rounded-t-3xl bg-bg-primary"
        >
          <View className="items-center pb-1 pt-3">
            <View className="h-1.5 w-11 rounded-full bg-border" />
          </View>

          <ScrollView contentContainerClassName="px-6 pb-10 pt-3">
            <View className="flex-row items-center">
              {owner.photoUrl ? (
                <Image
                  source={owner.photoUrl}
                  contentFit="cover"
                  style={{ width: 76, height: 76, borderRadius: 38 }}
                />
              ) : (
                <View className="h-[76px] w-[76px] items-center justify-center rounded-full bg-bg-tertiary">
                  <Ionicons name="person-outline" color="#9A8B82" size={32} />
                </View>
              )}
              <View className="ml-4 flex-1">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-xl font-bold text-text-primary">
                    {owner.displayName ?? "Pet sahibi"}
                  </Text>
                  {owner.verified ? (
                    <Ionicons name="shield-checkmark" color="#2FB8A6" size={19} />
                  ) : null}
                </View>
                <Text className="mt-1 text-sm text-text-secondary">
                  {facts || `${petName} ile birlikte`}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
                hitSlop={10}
                className="h-9 w-9 items-center justify-center rounded-full bg-bg-tertiary"
              >
                <Ionicons name="close" size={18} color="#6B5D55" />
              </Pressable>
            </View>

            {owner.socialOpen ? (
              <View className="mt-5 flex-row items-start rounded-2xl border border-brand/25 bg-brand/5 p-3.5">
                <Ionicons name="people-outline" color="#F97362" size={18} />
                <Text className="ml-2.5 flex-1 text-xs leading-5 text-text-secondary">
                  Sahip olarak da tanışmaya açık. Sohbet, petlerin yanı sıra
                  sizin de tanışmanıza açık demek.
                </Text>
              </View>
            ) : null}

            {owner.bio ? (
              <View className="mt-5">
                <Text className="mb-2 text-sm font-semibold text-text-primary">
                  Hakkında
                </Text>
                <Text className="text-sm leading-6 text-text-secondary">
                  {owner.bio}
                </Text>
              </View>
            ) : null}

            {owner.verified ? (
              <View className="mt-5 flex-row items-start rounded-2xl border border-accent/25 bg-accent/5 p-3.5">
                <Ionicons name="shield-checkmark" color="#2FB8A6" size={18} />
                <Text className="ml-2.5 flex-1 text-xs leading-5 text-text-secondary">
                  Bu profil, sahip ve peti birlikte gösteren bir fotoğrafla
                  doğrulandı.
                </Text>
              </View>
            ) : null}

            <Text className="mt-6 text-[11px] leading-4 text-text-tertiary">
              Burada yalnızca sahibin paylaşmayı seçtiği bilgiler görünür.
              Tam konum, iletişim bilgisi ve soyadı hiçbir zaman paylaşılmaz.
            </Text>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
