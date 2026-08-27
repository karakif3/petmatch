import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useState } from "react";

import { ownerInterestLabels } from "../core/domain/labels";
import type { ConnectionTag, OwnerInterest } from "../core/domain/types";
import { useTranslation } from "../core/i18n";
import { PhotoLightbox } from "./photo-lightbox";
import { AppIcon } from "./ui/icon";
import { AppPressable } from "./ui/pressable";

export type OwnerDisclosure = {
  displayName: string | null;
  photoUrl: string | null;
  /** Kapaktan sonraki galeri; Keşfet hapına konmaz. */
  extraPhotoUrls?: string[];
  bio: string | null;
  gender: "female" | "male" | "other" | null;
  ageBucket: string | null;
  socialOpen: boolean;
  verified: boolean;
  interests?: OwnerInterest[];
  /** Yalnızca profil gövdesinde; Keşfet hapına konmaz (`0066`). */
  connectionTag?: ConnectionTag | null;
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
/**
 * Sahip bilgisinin GÖVDESİ — panelden de tam profil sayfasından da aynısı.
 *
 * Ayrı bir bileşen olmasının sebebi ayrışmayı engellemek: sahip bilgisi iki
 * yüzeyde birden görünüyor (sohbetteki hızlı bakış paneli ve pet profil
 * sayfasındaki bölüm). İki yerde ayrı ayrı yazılsaydı biri güncellenip
 * diğeri unutulurdu — bu depoda tam da o hata sınıfı ("iki yerde aynı
 * kural") defalarca temizlendi.
 *
 * Görünürlük kararı BURADA verilmiyor: `owner` null ise çağıran hiç render
 * etmiyor. Kim ne görebilir sorusunun tek yanıtı sunucuda (`0021`, `0047`).
 */
export function OwnerProfileSection({
  owner,
  petName,
}: {
  owner: OwnerDisclosure;
  petName: string;
}) {
  const t = useTranslation();
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const gender = genderLabel(owner.gender);
  const facts = [gender, owner.ageBucket].filter(Boolean).join(" · ");
  const interests = owner.interests ?? [];
  const gallery = [owner.photoUrl, ...(owner.extraPhotoUrls ?? [])].filter(
    (url): url is string => Boolean(url),
  );
  const extras = owner.extraPhotoUrls ?? [];
  const connectionLabel =
    owner.connectionTag === "new_friends"
      ? t("ownerConnection.tagNewFriends")
      : owner.connectionTag === "open_minded"
        ? t("ownerConnection.tagOpenMinded")
        : owner.connectionTag === "not_sure_yet"
          ? t("ownerConnection.tagNotSureYet")
          : null;

  return (
    <>
      <View className="flex-row items-center">
        <AppPressable
          onPress={() => gallery.length && setLightboxIndex(0)}
          disabled={!gallery.length}
          accessibilityRole="button"
          accessibilityLabel="Sahip fotoğraflarını aç"
        >
          {owner.photoUrl ? (
            <Image
              source={owner.photoUrl}
              contentFit="cover"
              style={{ width: 84, height: 84, borderRadius: 42 }}
            />
          ) : (
            <View className="h-[84px] w-[84px] items-center justify-center rounded-full bg-bg-tertiary">
              <AppIcon name="user" color="#9A8B82" size={32} />
            </View>
          )}
        </AppPressable>
        <View className="ml-4 flex-1">
          <View className="flex-row flex-wrap items-center gap-2">
            <Text className="text-xl font-bold text-text-primary">
              {owner.displayName ?? "Pet sahibi"}
            </Text>
            {owner.verified ? (
              <AppIcon name="shield-check" color="#2FB8A6" size={19} />
            ) : null}
          </View>
          <Text className="mt-1 text-sm text-text-secondary">
            {facts || `${petName} ile birlikte`}
          </Text>
        </View>
      </View>

      {extras.length > 0 ? (
        <View className="mt-4">
          <Text className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-tertiary">
            Diğer fotoğrafları
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="-mx-1"
            contentContainerClassName="gap-2.5 px-1"
          >
            {extras.map((url, index) => (
              <AppPressable
                key={`${index}-${url}`}
                onPress={() => setLightboxIndex((owner.photoUrl ? 1 : 0) + index)}
                accessibilityRole="button"
                accessibilityLabel={`Sahip fotoğrafı ${index + 2}`}
                className="overflow-hidden rounded-2xl"
              >
                <Image
                  source={url}
                  contentFit="cover"
                  style={{ width: 112, height: 112 }}
                />
              </AppPressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <PhotoLightbox
        visible={lightboxIndex !== null}
        photoUrls={gallery}
        index={lightboxIndex ?? 0}
        onIndexChange={setLightboxIndex}
        onClose={() => setLightboxIndex(null)}
      />

      {interests.length > 0 ? (
        <View className="mt-4 flex-row flex-wrap gap-1.5">
          {interests.map((interest) => (
            <View
              key={interest}
              className="rounded-full border border-border bg-bg-secondary px-2.5 py-1"
            >
              <Text className="text-[11px] font-semibold text-text-secondary">
                {ownerInterestLabels[interest]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {owner.socialOpen ? (
        <View className="mt-5 flex-row items-start rounded-2xl border border-brand/25 bg-brand/5 p-3.5">
          <AppIcon name="users" color="#F97362" size={18} />
          <View className="ml-2.5 flex-1">
            <Text className="text-xs leading-5 text-text-secondary">
              Sahip olarak da tanışmaya açık. Sohbet, petlerin yanı sıra sizin de
              tanışmanıza açık demek.
            </Text>
            {connectionLabel ? (
              <View className="mt-2.5 self-start rounded-full bg-brand/15 px-2.5 py-1">
                <Text className="text-[11px] font-bold text-brand-dark">
                  {connectionLabel}
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      {owner.bio ? (
        <View className="mt-5">
          <Text className="mb-2 text-sm font-semibold text-text-primary">Hakkında</Text>
          <Text className="text-sm leading-6 text-text-secondary">{owner.bio}</Text>
        </View>
      ) : null}

      {owner.verified ? (
        <View className="mt-5 flex-row items-start rounded-2xl border border-accent/25 bg-accent/5 p-3.5">
          <AppIcon name="shield-check" color="#2FB8A6" size={18} />
          <Text className="ml-2.5 flex-1 text-xs leading-5 text-text-secondary">
            Bu profil, sahip ve peti birlikte gösteren bir fotoğrafla doğrulandı.
          </Text>
        </View>
      ) : null}

      <Text className="mt-6 text-[11px] leading-4 text-text-tertiary">
        Burada yalnızca sahibin paylaşmayı seçtiği bilgiler görünür. Tam konum,
        iletişim bilgisi ve soyadı hiçbir zaman paylaşılmaz.
      </Text>
    </>
  );
}

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
            <View className="mb-1 flex-row justify-end">
              <Pressable
                onPress={onClose}
                accessibilityRole="button"
                accessibilityLabel="Kapat"
                hitSlop={10}
                className="h-9 w-9 items-center justify-center rounded-full bg-bg-tertiary"
              >
                <AppIcon name="x" size={18} color="#6B5D55" />
              </Pressable>
            </View>
            <OwnerProfileSection owner={owner} petName={petName} />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
