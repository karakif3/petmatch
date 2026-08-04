import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

export type EditablePhoto = { id: string; uri: string };

type Props = {
  photos: EditablePhoto[];
  max: number;
  busy?: boolean;
  onChange: (photos: EditablePhoto[]) => void;
  onAdd: () => void;
};

/**
 * Kapak fotoğrafını büyük, diğerlerini küçük gösteren düzenleyici.
 *
 * Önceki hali altı fotoğrafı da eşit boyutta yatay bir şeritte diziyordu ve
 * iki sorunu vardı:
 *
 * 1. **Kapak görsel olarak ayrıcalıklı değildi.** Oysa keşfet destesinde
 *    kullanıcının gördüğü tek fotoğraf o; düzenleme ekranı bu önem farkını
 *    yansıtmıyordu.
 * 2. **Sıralama oklarla yapılıyordu.** 4. fotoğrafı kapak yapmak için "geri"
 *    okuna üç kez basmak gerekiyordu ve kaç basışta biteceği belli değildi.
 *
 * Burada kapak tek büyük alan; küçük fotoğrafa dokunmak onu doğrudan kapak
 * yapıyor. N basış yerine tek dokunuş, ve sonucu dokunmadan önce görülebiliyor.
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

  if (!cover) {
    return (
      <Pressable
        onPress={onAdd}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Fotoğraf ekle"
        className="aspect-[4/5] w-full items-center justify-center rounded-3xl border border-dashed border-brand bg-brand/5"
      >
        <Ionicons name="camera-outline" color="#F97362" size={38} />
        <Text className="mt-3 font-bold text-brand-dark">Fotoğraf ekle</Text>
        <Text className="mt-1 text-xs text-text-tertiary">
          İlk fotoğraf kapak olur
        </Text>
      </Pressable>
    );
  }

  return (
    <View>
      <View className="overflow-hidden rounded-3xl border border-border bg-surface">
        <Image
          source={cover.uri}
          contentFit="cover"
          style={{ width: "100%", aspectRatio: 4 / 5 }}
        />
        <View className="absolute left-3 top-3 rounded-full bg-brand px-3 py-1.5">
          <Text className="text-[11px] font-bold text-white">Kapak</Text>
        </View>
        <Pressable
          onPress={() => remove(cover.id)}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel="Kapak fotoğrafını kaldır"
          hitSlop={8}
          className="absolute right-3 top-3 h-9 w-9 items-center justify-center rounded-full bg-black/55"
        >
          <Ionicons name="trash-outline" color="#FFFFFF" size={17} />
        </Pressable>
      </View>

      <View className="mt-3 flex-row flex-wrap gap-2.5">
        {rest.map((photo) => (
          <Pressable
            key={photo.id}
            onPress={() => promote(photo.id)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Bu fotoğrafı kapak yap"
            className="h-[74px] w-[74px] overflow-hidden rounded-2xl border border-border bg-surface"
          >
            <Image
              source={photo.uri}
              contentFit="cover"
              style={{ width: "100%", height: "100%" }}
            />
            <Pressable
              onPress={() => remove(photo.id)}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Fotoğrafı kaldır"
              hitSlop={8}
              className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-black/60"
            >
              <Ionicons name="close" color="#FFFFFF" size={13} />
            </Pressable>
          </Pressable>
        ))}

        {photos.length < max ? (
          <Pressable
            onPress={onAdd}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Fotoğraf ekle"
            className="h-[74px] w-[74px] items-center justify-center rounded-2xl border border-dashed border-brand bg-brand/5"
          >
            <Ionicons name="add" color="#F97362" size={24} />
          </Pressable>
        ) : null}
      </View>

      <Text className="mt-2.5 text-xs leading-4 text-text-tertiary">
        {rest.length > 0
          ? "Kapak, keşfette görünen fotoğraftır. Değiştirmek için küçük fotoğraflardan birine dokun."
          : "Kapak, keşfette görünen fotoğraftır."}
      </Text>
    </View>
  );
}
