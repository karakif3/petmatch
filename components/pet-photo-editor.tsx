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

/** Kapak satırının yüksekliği; sağdaki iki küçük kare bunu tam dolduruyor. */
const HERO_HEIGHT = 224;

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

  const canAdd = photos.length < max;

  const Thumb = ({ photo, fill }: { photo: EditablePhoto; fill?: boolean }) => (
    <Pressable
      onPress={() => promote(photo.id)}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Bu fotoğrafı kapak yap"
      className={`overflow-hidden rounded-2xl border border-border bg-surface ${
        fill ? "flex-1" : "h-[72px] w-[72px]"
      }`}
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
  );

  const AddTile = ({ fill }: { fill?: boolean }) => (
    <Pressable
      onPress={onAdd}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel="Fotoğraf ekle"
      className={`items-center justify-center rounded-2xl border border-dashed border-brand bg-brand/5 ${
        fill ? "flex-1" : "h-[72px] w-[72px]"
      }`}
    >
      <Ionicons name="add" color="#F97362" size={22} />
    </Pressable>
  );

  if (!cover) {
    return (
      <Pressable
        onPress={onAdd}
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel="Fotoğraf ekle"
        style={{ height: HERO_HEIGHT }}
        className="w-full items-center justify-center rounded-3xl border border-dashed border-brand bg-brand/5"
      >
        <Ionicons name="camera-outline" color="#F97362" size={34} />
        <Text className="mt-2.5 font-bold text-brand-dark">Fotoğraf ekle</Text>
        <Text className="mt-1 text-xs text-text-tertiary">
          İlk fotoğraf kapak olur
        </Text>
      </Pressable>
    );
  }

  // Sağ sütun kapağın yanında iki yuva taşıyor; kalanlar alta iniyor.
  const side = rest.slice(0, 2);
  const below = rest.slice(2);
  const addGoesBeside = canAdd && side.length < 2;

  return (
    <View>
      <View className="flex-row gap-2.5" style={{ height: HERO_HEIGHT }}>
        <View className="flex-[1.9] overflow-hidden rounded-3xl border border-border bg-surface">
          <Image
            source={cover.uri}
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
          />
          <View className="absolute left-2.5 top-2.5 rounded-full bg-brand px-2.5 py-1">
            <Text className="text-[10px] font-bold text-white">Kapak</Text>
          </View>
          <Pressable
            onPress={() => remove(cover.id)}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Kapak fotoğrafını kaldır"
            hitSlop={8}
            className="absolute right-2.5 top-2.5 h-8 w-8 items-center justify-center rounded-full bg-black/55"
          >
            <Ionicons name="trash-outline" color="#FFFFFF" size={15} />
          </Pressable>
        </View>

        <View className="flex-1 gap-2.5">
          {side.map((photo) => (
            <Thumb key={photo.id} photo={photo} fill />
          ))}
          {addGoesBeside ? <AddTile fill /> : null}
          {/* Yuva boş kalırsa sağ sütun kapağın yüksekliğini korusun. */}
          {side.length + (addGoesBeside ? 1 : 0) < 2 ? (
            <View className="flex-1" />
          ) : null}
        </View>
      </View>

      {below.length > 0 || (canAdd && !addGoesBeside) ? (
        <View className="mt-2.5 flex-row flex-wrap gap-2.5">
          {below.map((photo) => (
            <Thumb key={photo.id} photo={photo} />
          ))}
          {canAdd && !addGoesBeside ? <AddTile /> : null}
        </View>
      ) : null}

      <Text className="mt-2.5 text-xs leading-4 text-text-tertiary">
        {rest.length > 0
          ? "Kapak, keşfette görünen fotoğraftır. Değiştirmek için küçük fotoğraflardan birine dokun."
          : "Kapak, keşfette görünen fotoğraftır."}
      </Text>
    </View>
  );
}
