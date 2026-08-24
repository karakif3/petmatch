import { Text, View } from "react-native";
import { Image } from "expo-image";

import type { OwnerVisibility } from "../core/domain/types";
import { OwnerProfileSection, type OwnerDisclosure } from "./owner-sheet";
import { AppIcon } from "./ui/icon";

/**
 * "Karşı taraf ne görüyor" — görünürlük seçiminin canlı önizlemesi.
 *
 * Neden gerekiyor: kullanıcı üç seçenek arasından birini seçiyor ama
 * hiçbirinin karşı tarafta ne demek olduğunu göremiyordu. `Profilimi önizle`
 * yalnızca PET kartını gösteriyor, sahip katmanını bilerek hiç render
 * etmiyor — yani gizlilik kararı olan tek katman, önizlenemeyen katmandı.
 *
 * Neden AYRI bir üç durumlu anahtar yok: üç seçenek zaten hemen yukarıda
 * radyo olarak duruyor. İkinci bir seçici koymak aynı kararı iki yerde
 * sormak olurdu. Önizleme seçimi takip ediyor — dokun, sonucu gör.
 *
 * Sunucu mantığı BURADA TEKRARLANMIYOR: yaş aralığı (`owner_age_bucket()`)
 * ve karşılıklı açıklama kuralı (`0021`) sunucuda; önizleme onların yerine
 * geçmeye çalışmıyor, dipnotta ne olduklarını söylüyor.
 */
export function OwnerVisibilityPreview({
  visibility,
  owner,
  petName,
}: {
  visibility: OwnerVisibility;
  owner: OwnerDisclosure;
  petName: string;
}) {
  return (
    <View className="mb-7">
      <View className="mb-2.5 flex-row items-center gap-2">
        <AppIcon name="eye" color="#6B5D55" size={16} />
        <Text className="text-sm font-bold text-text-primary">
          Karşı taraf ne görüyor
        </Text>
      </View>

      {visibility === "hidden" ? (
        <View className="items-center rounded-2xl border border-border bg-surface px-5 py-7">
          <AppIcon name="eye-off" color="#C4B7AE" size={26} />
          <Text className="mt-3 text-center text-sm leading-5 text-text-secondary">
            Keşfette yalnızca {petName} görünür. Eşleşseniz bile profil
            sayfanda “Sahibi” bölümü hiç çıkmaz.
          </Text>
        </View>
      ) : (
        <View className="rounded-2xl border border-border bg-surface p-4">
          <Text className="mb-3 text-xs leading-4 text-text-tertiary">
            {visibility === "public"
              ? "Keşfet kartında ve seni görebilen herkese:"
              : "Yalnızca eşleştikten sonra — sohbette ve profil sayfasında:"}
          </Text>

          {/*
            `public` ayrıca DESTEDE bir iz bırakıyor: kartın üstündeki sahip
            hapı. Bu, "eşleşince" ile aradaki tek görünür fark — o yüzden
            önizlemede de yalnızca burada var.
          */}
          {visibility === "public" ? (
            <View className="mb-4 flex-row items-center gap-2 self-start rounded-full bg-text-primary/90 py-1.5 pl-1.5 pr-3">
              {owner.photoUrl ? (
                <Image
                  source={owner.photoUrl}
                  contentFit="cover"
                  style={{ width: 26, height: 26, borderRadius: 13 }}
                />
              ) : (
                <View className="h-[26px] w-[26px] items-center justify-center rounded-full bg-white/20">
                  <AppIcon name="user" color="#FFFFFF" size={13} />
                </View>
              )}
              <Text className="text-xs font-bold text-white">
                {owner.displayName ?? "Pet sahibi"}
              </Text>
              <AppIcon name="chevron-right" color="#FFFFFFB3" size={12} />
            </View>
          ) : null}

          <OwnerProfileSection owner={owner} petName={petName} />
        </View>
      )}

      <Text className="mt-2.5 text-[11px] leading-4 text-text-tertiary">
        Yaş aralığın ve cinsiyetin burada gösterilmiyor: karşı tarafa yalnızca
        kendi yaşını/cinsiyetini paylaşan kullanıcılara ve “25–29 yaş” gibi bir
        aralık olarak görünürler.
      </Text>
    </View>
  );
}
