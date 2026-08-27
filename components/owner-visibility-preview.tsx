import { Text, View } from "react-native";

import type { OwnerVisibility } from "../core/domain/types";
import { OwnerDiscoverPill } from "./owner-discover-pill";
import type { OwnerDisclosure } from "./owner-sheet";
import { AppIcon } from "./ui/icon";

/**
 * Görünürlük seçiminin canlı özeti — tam profil kopyası değil.
 *
 * Tam `OwnerProfileSection` buraya konunca kapak hapı + avatar + extra
 * kare aynı dosyayı üç kez gösteriyordu. Önizleme tek yüzey taklit eder:
 * public → keşfet hapı; after_match / hidden → kısa metin.
 */
export function OwnerVisibilityPreview({
  visibility,
  owner,
  petName,
  unsaved = false,
}: {
  visibility: OwnerVisibility;
  owner: OwnerDisclosure;
  petName: string;
  unsaved?: boolean;
}) {
  return (
    <View className="mb-7">
      <View className="mb-2.5 flex-row items-center gap-2">
        <AppIcon name="eye" color="#6B5D55" size={16} />
        <Text className="text-sm font-bold text-text-primary">
          Karşı taraf ne görüyor
        </Text>
        {unsaved ? (
          <View className="rounded-full bg-bg-tertiary px-2 py-0.5">
            <Text className="text-[10px] font-bold text-text-tertiary">
              Henüz kaydedilmedi
            </Text>
          </View>
        ) : null}
      </View>

      {visibility === "public" ? (
        <View className="rounded-2xl border border-border bg-surface p-4">
          <Text className="mb-2.5 text-[10px] font-bold uppercase tracking-wide text-text-tertiary">
            Keşfet kartında
          </Text>
          <OwnerDiscoverPill variant="preview" owner={owner} />
          <Text className="mt-3 text-xs leading-4 text-text-secondary">
            Pet profilinde adın, yaş aralığın, fotoğrafların ve bio’n da
            çıkar. Keşfet hapına yalnızca kapak konur.
          </Text>
        </View>
      ) : visibility === "after_match" ? (
        <View className="rounded-2xl border border-border bg-surface px-4 py-4">
          <Text className="text-sm leading-5 text-text-secondary">
            Keşfette yalnızca {petName} görünür. Eşleşince sohbet ve pet
            profilinde adın ile fotoğrafın açılır.
          </Text>
        </View>
      ) : (
        <View className="items-center rounded-2xl border border-border bg-surface px-5 py-7">
          <AppIcon name="eye-off" color="#C4B7AE" size={26} />
          <Text className="mt-3 text-center text-sm leading-5 text-text-secondary">
            Keşfette yalnızca {petName} görünür. Eşleşseniz bile “Sahibi”
            bölümü çıkmaz.
          </Text>
        </View>
      )}

      <Text className="mt-2.5 text-[11px] leading-4 text-text-tertiary">
        Yaş kesin yıl değil, “25–29 yaş” gibi bir aralık. Gizlemek istersen
        bu sayfadan değiştirmen yeterli — Keşfet’te ayrı bir gizleme tuşu yok.
      </Text>
    </View>
  );
}
