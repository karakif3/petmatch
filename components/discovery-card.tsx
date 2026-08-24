import { useEffect, useState, type ReactNode } from "react";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import type { DiscoveryDeckCard } from "../core/api/discovery";
import { formatAge } from "../core/domain/age";
import { ownerInterestLabels, sizeLabels, temperamentLabels } from "../core/domain/labels";
import { shadowSm } from "../core/ui/shadow";
import { PhotoCarousel } from "./photo-carousel";
import { DecisionIcons } from "./ui/icon";
import { AppPressable } from "./ui/pressable";

const CARD_ASPECT = 3 / 4;
const MAX_OWNER_INTEREST_CHIPS = 2;

function distanceLabel(bucket: string | null): string | null {
  if (!bucket) return null;
  if (bucket === "<1") return "1 km’den yakın";
  if (bucket === "25+") return "25 km’den uzak";
  return `${bucket} km uzakta`;
}

function activityLabel(bucket: string | null): string | null {
  if (bucket === "today") return "Bugün aktif";
  if (bucket === "this_week") return "Bu hafta aktif";
  if (bucket === "this_month") return "Bu ay aktif";
  return null;
}

/** Foto üstünde okunabilirlik için tutarlı koyu-cam çip stili. */
function OverlayChip({ children }: { children: ReactNode }) {
  return (
    <View className="rounded-full border border-white/15 bg-black/45 px-2.5 py-1">
      <Text className="text-[11px] font-semibold text-white">{children}</Text>
    </View>
  );
}

export function DiscoveryCard({
  card,
  onOwnerPress,
  variant = "discovery",
  fill = false,
}: {
  card: DiscoveryDeckCard;
  /** Sahip teaser'ına dokunulduğunda; verilmezse blok tıklanamaz kalır. */
  onOwnerPress?: () => void;
  /**
   * "preview": kullanıcı KENDİ kartına bakıyor (Profil → Profilimi önizle).
   * Uyum rozeti, mesafe ve sahip teaser'ı kendine göre anlamsız — bu yüzden
   * gizleniyor. Geri kalan (foto, mizaç/bilgi çipleri) karşı tarafın
   * gördüğüyle birebir aynı.
   */
  variant?: "discovery" | "preview";
  /**
   * Keşfet'te kart, başlık ile yüzen düğme şeridi arasındaki BOŞLUĞU
   * dolduruyor (sabit 3:4 değil). Sebep: 3:4'te kartın toplam yüksekliği
   * ekranı aşıyor, sayfa kaydırılabilir hale geliyor ve kartın alt satırı
   * (ad · ırk/boyut · mesafe) düğme şeridinin altında kalıyordu — kullanıcı
   * bilgiyi göremeden karar veriyordu. Önizleme modalında oran korunuyor.
   */
  fill?: boolean;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);
  // Kart değişince (yeni aday) önceki kartın fotoğraf sayfasında kalınmasın.
  useEffect(() => {
    setPhotoIndex(0);
  }, [card.id]);

  const age = formatAge(card.birthDate);
  const activity = activityLabel(card.activityBucket);
  const compatibility = Math.round(card.compatibility.total * 100);
  const details = [card.breed, age, sizeLabels[card.size]].filter(Boolean).join(" · ");
  const showCompatibility = variant === "discovery";
  const showDistance = variant === "discovery";

  /*
   * Kartın YÜZÜNE (fotoğrafın üstüne) taşınan "ilgi çekici bilgiler" —
   * önceden ayrı bir "Ayrıntılar için dokun" panelinin arkasındaydı. Artık
   * ayrı bir panel YOK: ilk fotoğrafa sığmayan bilgiler bir SONRAKİ
   * fotoğrafta beliriyor. Sıra öncelik sırası: enerji/şehir/kısırlaştırma →
   * mizaç → bio → sahip teaser'ı (sahip görünürse).
   */
  const extraBlocks: ReactNode[] = [];

  const factChips: string[] = [];
  if (card.city) factChips.push(card.city);
  factChips.push(`Enerji ${card.energyLevel}/5`);
  if (card.isNeutered) factChips.push("Kısırlaştırılmış");
  extraBlocks.push(
    <View key="facts" className="flex-row flex-wrap gap-1.5">
      {factChips.map((chip) => (
        <OverlayChip key={chip}>{chip}</OverlayChip>
      ))}
    </View>,
  );

  if (card.temperaments.length > 0) {
    extraBlocks.push(
      <View key="temperament" className="flex-row flex-wrap gap-1.5">
        {card.temperaments.map((temperament) => (
          <OverlayChip key={temperament}>{temperamentLabels[temperament]}</OverlayChip>
        ))}
      </View>,
    );
  }

  if (card.bio) {
    // Kutu YOK: kartın altında üst üste binen dolu kutular (bio + sahip)
    // fotoğrafın üstüne yapıştırılmış bir liste gibi okunuyordu. Metin
    // doğrudan gradyanın üstünde duruyor; okunurluğu kutu değil gradyan
    // sağlıyor (aşağıdaki `LinearGradient` bu yüzden dipte daha koyu).
    extraBlocks.push(
      <Text key="bio" className="text-[13px] leading-5 text-white/90" numberOfLines={2}>
        {card.bio}
      </Text>,
    );
  }

  // Sahip teaser'ı yalnızca `discovery` modunda: kendi kartını önizlerken
  // kendi ilgi alanlarını kendine göstermenin anlamı yok. Sahip verisi zaten
  // yalnızca `owner_visibility = 'public'` iken doluyor (RPC tarafında
  // gated) — istemci burada ek bir görünürlük kontrolü YAPMIYOR, 0021'deki
  // kuralı ikinci kez uygulamak yerine sunucuya güveniyor.
  if (variant === "discovery" && card.owner) {
    const owner = card.owner;
    const interestChips = owner.interests.slice(0, MAX_OWNER_INTEREST_CHIPS);
    extraBlocks.push(
      <AppPressable
        key="owner"
        onPress={onOwnerPress}
        disabled={!onOwnerPress}
        accessibilityRole={onOwnerPress ? "button" : undefined}
        accessibilityLabel={
          onOwnerPress ? `${owner.displayName ?? "Pet sahibi"} profilini aç` : undefined
        }
        // `self-start`: kutu içeriğine göre daralıyor. Tam genişlikte
        // olduğunda ne olduğu belirsiz bir şerit gibi duruyordu; artık
        // "sahip" olduğu belli bir hap. Sağdaki ok, dokunulabilir
        // olduğunu söyleyen tek görsel işaret (önceden hiçbiri yoktu).
        className="max-w-full flex-row items-center gap-2 self-start rounded-full border border-white/15 bg-black/50 py-1.5 pl-1.5 pr-3"
      >
        {owner.photoUrl ? (
          <Image
            source={owner.photoUrl}
            contentFit="cover"
            style={{ width: 32, height: 32, borderRadius: 16 }}
          />
        ) : (
          <View className="h-8 w-8 items-center justify-center rounded-full bg-white/20">
            <Ionicons name="person-outline" color="#FFFFFF" size={16} />
          </View>
        )}
        <Text className="text-xs font-bold text-white" numberOfLines={1}>
          {owner.displayName ?? "Pet sahibi"}
        </Text>
        {owner.verified ? (
          <Ionicons name="shield-checkmark" color="#5ED3C3" size={14} />
        ) : null}
        {interestChips.map((interest) => (
          <View key={interest} className="rounded-full bg-white/20 px-2 py-0.5">
            <Text className="text-[10px] font-semibold text-white">
              {ownerInterestLabels[interest]}
            </Text>
          </View>
        ))}
        {/*
          Sahip ilgi alanı GİRMEMİŞ olabilir (`profiles.interests` boş) —
          o zaman hap yalnızca bir isimden ibaret kalıyor ve neden orada
          durduğu anlaşılmıyordu. Boşken niyeti söyleyen bir metin
          giriyor; dolu olduğunda gereksiz gürültü olmasın diye
          yalnızca boşken.
        */}
        {interestChips.length === 0 ? (
          <Text className="text-[10px] font-semibold text-white/70">Sahibini gör</Text>
        ) : null}
        {onOwnerPress ? (
          <Ionicons name="chevron-forward" color="#FFFFFFB3" size={13} />
        ) : null}
      </AppPressable>,
    );
  }

  const photoCount = Math.max(1, card.photoUrls.length);
  // Sayfa 0 çekirdek bilgiye (ad/yaş/mesafe) ayrılmış; fazladan içerik
  // sonraki sayfalara dağılıyor. Tek fotoğrafta gidecek başka sayfa
  // olmadığı için hepsi aynı sayfada, çekirdek bilginin ÜSTÜNDE toplanıyor
  // — veri kaybı olmasın diye.
  const extraPageCount = Math.max(1, photoCount - 1);
  const buckets: ReactNode[][] = Array.from({ length: extraPageCount }, () => []);
  extraBlocks.forEach((block, i) => {
    buckets[Math.min(i, extraPageCount - 1)].push(block);
  });
  const currentExtra =
    photoCount === 1 ? buckets[0] : photoIndex === 0 ? [] : buckets[photoIndex - 1];

  return (
    <View
      className={`relative w-full overflow-hidden rounded-3xl border border-border bg-surface ${
        fill ? "flex-1" : ""
      }`}
      style={shadowSm}
    >
      <PhotoCarousel
        photoUrls={card.photoUrls}
        aspectRatio={CARD_ASPECT}
        fill={fill}
        index={photoIndex}
        onIndexChange={setPhotoIndex}
      />

      {/*
        Alt okunabilirlik gradyanı — foto tam kadraj, metin üstüne biniyor.
        Sayfa başına birden fazla bilgi bloğu eklenince (mizaç/bio/sahip
        teaser'ı) üst sıradaki bloklar önceden yalnızca tek satırlık içerik
        için ayarlanmış gradyanın zayıf kaldığı bölgeye düşüyordu. Üç durak +
        daha yüksek tepe opaklık, kartta kaç blok olursa olsun okunurluğu
        koruyor.
      */}
      <LinearGradient
        pointerEvents="none"
        // Bio ve sahip bloğundan kutular kaldırıldığı için okunurluğu
        // tamamen bu gradyan taşıyor: dip daha koyu, geçiş daha uzun.
        colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.45)", "rgba(0,0,0,0.92)"]}
        locations={[0, 0.45, 1]}
        style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "75%" }}
      />

      {activity ? (
        <View className="absolute left-3 top-3 flex-row items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5">
          <View className="h-2 w-2 rounded-full bg-accent" />
          <Text className="text-[11px] font-bold text-white">{activity}</Text>
        </View>
      ) : null}

      {/*
        Yeniden dolaşım (`0060`): deste tükendiği için geri gelen kart.
        Söylenmezse kullanıcı aynı profilleri görüp ürünün bozulduğunu
        sanar — etiket, tekrarı hata olmaktan çıkarıp bilinçli bir ikinci
        şansa çeviriyor. Aktiflik hapı varsa onun altına iniyor.
      */}
      {card.previouslyPassed ? (
        <View
          className={`absolute left-3 ${
            activity ? "top-14" : "top-3"
          } flex-row items-center gap-1.5 rounded-full bg-black/40 px-2.5 py-1.5`}
        >
          <Ionicons name="refresh-outline" color="#FFFFFF" size={12} />
          <Text className="text-[11px] font-bold text-white">Daha önce geçtin</Text>
        </View>
      ) : null}

      {showCompatibility ? (
        <View
          style={shadowSm}
          // top-16: `app/(app)/index.tsx` bu kartın ÜSTÜNE, aynı `right-3
          // top-3` köşesine güvenlik düğmesini biniyor (ayrı bir sorumluluk,
          // kart bunu bilmiyor) — ikisi çakışmasın diye rozet bir satır
          // aşağıda duruyor.
          className="absolute right-3 top-16 flex-row items-center gap-1 rounded-full bg-white/95 px-3 py-1.5"
        >
          <DecisionIcons.compatibility size={13} color="#1E9384" strokeWidth={2.25} />
          <Text className="text-xs font-bold text-accent-dark">%{compatibility} uyum</Text>
        </View>
      ) : null}

      {/*
        `key`: fotoğraf sayfası değişince bu bloğun içeriği (hangi çipler/
        bio/sahip teaser'ı gösterileceği) tamamen değişiyor — `key` React'a
        eskiyi güncellemek yerine yeniden mount etmesini söylüyor.
      */}
      {/*
        Sıra BİLEREK böyle: önce KİM (ad + cinsiyet), sonra NE (ırk/yaş/
        boyut · mesafe), sonra ayrıntı (çipler/bio/sahip). Önceki hâlde
        ikincil bilgi bloklarının HEPSİ adın üstündeydi; kartın en büyük
        tipografisi en altta kalıyor, göz önce üç koyu kutuya çarpıyordu.
        Kimlik en üstte olunca kart tek bakışta okunuyor.
      */}
      <View
        key={`bottom-${card.id}-${photoIndex}`}
        className="absolute inset-x-0 bottom-0 px-4 pb-4 pt-12"
      >
        <View className="flex-row items-center gap-2">
          <Text className="text-[28px] font-bold leading-9 text-white" numberOfLines={1}>
            {card.name}
          </Text>
          <Ionicons
            name={card.gender === "female" ? "female" : "male"}
            color={card.gender === "female" ? "#FFB6D0" : "#AFC9F2"}
            size={19}
          />
        </View>
        {/*
          Mesafe eskiden sağda ayrı bir hapta duruyor ve adla aynı satırda
          yer için yarışıyordu. Aynı cümlenin parçası: "Küçük · 2 km
          uzakta". Bir bilgi daha az kutu demek.
        */}
        {details || (showDistance && distanceLabel(card.distanceBucket)) ? (
          <Text className="mt-0.5 text-[13px] font-semibold text-white/85" numberOfLines={1}>
            {[details, showDistance ? distanceLabel(card.distanceBucket) : null]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        ) : null}

        {currentExtra.length > 0 ? (
          <View className="mt-2.5 gap-1.5">
            {currentExtra.map((node, i) => (
              <View key={i}>{node}</View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  );
}
