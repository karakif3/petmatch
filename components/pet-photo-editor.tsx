import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Image } from "expo-image";
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";

import { lightHaptic } from "../core/ui/haptics";
import { AppPressable } from "./ui/pressable";
import { AppIcon } from "./ui/icon";

export type EditablePhoto = { id: string; uri: string };

type Props = {
  photos: EditablePhoto[];
  max: number;
  busy?: boolean;
  onChange: (photos: EditablePhoto[]) => void;
  onAdd: () => void;
};

/** Kapak satırının yüksekliği; sağdaki iki küçük kare bunu tam dolduruyor. */
const HERO_HEIGHT = 224;

function PhotoImage({ uri, compact = false }: { uri: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  if (failed) {
    return (
      <View className="h-full w-full items-center justify-center bg-bg-tertiary px-3">
        <AppIcon name="image" color="#9A8B82" size={compact ? 20 : 30} />
        {!compact ? (
          <Text className="mt-2 text-center text-xs leading-4 text-text-secondary">
            Bu fotoğraf görüntülenemiyor. Yeniden yüklemeyi dene.
          </Text>
        ) : null}
      </View>
    );
  }

  return (
    <Image
      source={uri}
      contentFit="cover"
      style={{ width: "100%", height: "100%" }}
      onError={() => setFailed(true)}
    />
  );
}

/**
 * Kapak fotoğrafını ayrıcalıklı ama ekranı yutmayan bir düzende gösterir.
 *
 * İki iterasyondan geçti:
 *
 * 1. **İlk hali:** altı fotoğraf da eşit boyutta yatay şeritte. Kapak görsel
 *    olarak ayrıcalıklı değildi (oysa destede görünen tek fotoğraf o) ve
 *    sıralama oklarla yapılıyordu — 4. fotoğrafı kapak yapmak üç basış
 *    istiyor, kaç basışta biteceği belli olmuyordu.
 * 2. **İkinci hali:** kapak tam genişlik 4:5. Sorunu çözdü ama ekranın
 *    tamamını kapladı; ad, ırk, yaş gibi alanlar kaydırmadan görünmüyordu.
 *
 * Buradaki düzen ikisinin arası: kapak solda, sabit yükseklikte ve hâlâ
 * belirgin; diğerleri **sağına ve altına** yerleşiyor. Böylece fotoğraf
 * bölümü ekranın yarısından azını kaplıyor ve formun geri kalanı aynı
 * ekranda kalıyor.
 *
 * Küçük fotoğrafa dokunmak onu doğrudan kapak yapıyor — tek dokunuş, ve
 * sonuç dokunmadan önce görülebiliyor.
 */
export function PetPhotoEditor({ photos, max, busy, onChange, onAdd }: Props) {
  const [cover, ...rest] = photos;

  const promote = (id: string) => {
    const picked = photos.find((photo) => photo.id === id);
    if (!picked) return;
    onChange([picked, ...photos.filter((photo) => photo.id !== id)]);
  };

  const remove = (id: string) =>
    onChange(photos.filter((photo) => photo.id !== id));

  const moveRest = (id: string, offset: -1 | 1) => {
    if (!cover) return;
    const index = rest.findIndex((photo) => photo.id === id);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= rest.length) return;
    const next = [...rest];
    [next[index], next[target]] = [next[target], next[index]];
    lightHaptic();
    onChange([cover, ...next]);
  };

  const canAdd = photos.length < max;

  const Thumb = ({
    photo,
    drag,
    isActive,
  }: {
    photo: EditablePhoto;
    drag: () => void;
    isActive: boolean;
  }) => (
    <AppPressable
      onPress={() => promote(photo.id)}
      onLongPress={() => {
        drag();
      }}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Bu fotoğrafı kapak yap"
      accessibilityHint="Sıralamak için basılı tutup sürükle"
      accessibilityActions={[
        { name: "decrement", label: "Sola taşı" },
        { name: "increment", label: "Sağa taşı" },
      ]}
      onAccessibilityAction={(event) =>
        moveRest(photo.id, event.nativeEvent.actionName === "decrement" ? -1 : 1)
      }
      className={`h-[72px] w-[72px] overflow-hidden rounded-2xl border bg-surface ${
        isActive ? "border-brand opacity-80" : "border-border"
      }`}
    >
      <PhotoImage uri={photo.uri} compact />
      <AppPressable
        onPress={(event) => {
          event.stopPropagation();
          remove(photo.id);
        }}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Fotoğrafı kaldır"
        hitSlop={8}
        className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"
      >
        <AppIcon name="x" color="#FFFFFF" size={13} />
      </AppPressable>
    </AppPressable>
  );

  const AddTile = () => (
    <AppPressable
      onPress={onAdd}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Fotoğraf ekle"
      className="h-[72px] w-[72px] items-center justify-center rounded-2xl border border-dashed border-brand bg-brand/5"
    >
      <AppIcon name="plus" color="#F97362" size={22} />
    </AppPressable>
  );

  if (!cover) {
    return (
      <AppPressable
        onPress={onAdd}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Fotoğraf ekle"
        style={{ height: HERO_HEIGHT }}
        className="w-full items-center justify-center rounded-3xl border border-dashed border-brand bg-brand/5"
      >
        <AppIcon name="camera" color="#F97362" size={34} />
        <Text className="mt-2.5 font-bold text-brand-dark">Fotoğraf ekle</Text>
        <Text className="mt-1 text-xs text-text-tertiary">
          İlk fotoğraf kapak olur
        </Text>
      </AppPressable>
    );
  }

  return (
    <View>
      <View
        className="w-full overflow-hidden rounded-3xl border border-border bg-surface"
        style={{ height: HERO_HEIGHT }}
      >
          <PhotoImage uri={cover.uri} />
          <View className="absolute left-2.5 top-2.5 rounded-full bg-brand px-2.5 py-1">
            <Text className="text-[10px] font-bold text-white">Kapak</Text>
          </View>
          <AppPressable
            onPress={() => remove(cover.id)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Kapak fotoğrafını kaldır"
            hitSlop={8}
            className="absolute right-2.5 top-2.5 h-8 w-8 items-center justify-center rounded-full bg-black/55"
          >
            <AppIcon name="trash-2" color="#FFFFFF" size={15} />
          </AppPressable>
      </View>

      {rest.length > 0 || canAdd ? (
        <View className="mt-2.5 flex-row gap-2.5">
          {rest.length > 0 ? (
            <DraggableFlatList
              horizontal
              data={rest}
              keyExtractor={(photo) => photo.id}
              onDragEnd={({ data }) => onChange([cover, ...data])}
              onDragBegin={lightHaptic}
              activationDistance={8}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 10 }}
              renderItem={({ item, drag, isActive }: RenderItemParams<EditablePhoto>) => (
                <ScaleDecorator>
                  <Thumb photo={item} drag={drag} isActive={isActive} />
                </ScaleDecorator>
              )}
              style={{ flex: 1 }}
            />
          ) : (
            <View className="flex-1" />
          )}
          {canAdd ? <AddTile /> : null}
        </View>
      ) : null}

      <Text className="mt-2.5 text-xs leading-4 text-text-tertiary">
        {rest.length > 0
          ? "Küçük fotoğrafa dokunarak kapak yap; basılı tutup sürükleyerek sırala."
          : "Kapak, keşfette görünen fotoğraftır."}
      </Text>
    </View>
  );
}
