import { Text, View } from "react-native";

import { formatAge } from "../core/domain/age";
import { sizeLabels, temperamentLabels } from "../core/domain/labels";
import type { Pet } from "../core/domain/types";
import { AppIcon } from "./ui/icon";
import { OwnerProfileSection, type OwnerDisclosure } from "./owner-sheet";

function distanceLabel(bucket: string | null | undefined): string | null {
  if (!bucket) return null;
  if (bucket === "<1") return "1 km’den yakın";
  if (bucket === "25+") return "25 km’den uzak";
  return `${bucket} km uzakta`;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <View className="rounded-full bg-bg-secondary px-3 py-1.5">
      <Text className="text-xs font-semibold text-text-secondary">{children}</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mt-4 rounded-2xl border border-border bg-surface px-4 py-4">
      <Text className="mb-2.5 text-[11px] font-bold uppercase tracking-wide text-text-tertiary">
        {title}
      </Text>
      {children}
    </View>
  );
}

/**
 * Pet profil gövdesi — Keşfet önizlemesi, eşleşme sonrası sayfa ve kendi
 * önizlemesi aynı hiyerarşiyi paylaşır. Kartta yığılmayan ayrıntı burada.
 */
export function PetProfileBody({
  pet,
  owner,
  city,
  distanceBucket,
  ownerHeader,
  hideIdentity = false,
}: {
  pet: Pet;
  owner: OwnerDisclosure | null;
  city?: string | null;
  distanceBucket?: string | null;
  ownerHeader?: React.ReactNode;
  /** Kahraman fotoğrafta ad/ırk zaten varsa gövdede tekrarlama. */
  hideIdentity?: boolean;
}) {
  const age = formatAge(pet.birthDate);
  const facts = [pet.breed, age, sizeLabels[pet.size]].filter(Boolean).join(" · ");
  const place = [city, distanceLabel(distanceBucket ?? null)].filter(Boolean).join(" · ");
  const compatibility = (
    [
      ["Kedilerle", pet.goodWithCats],
      ["Köpeklerle", pet.goodWithDogs],
      ["Çocuklarla", pet.goodWithKids],
    ] as const
  ).filter(([, value]) => value !== null);

  return (
    <View className="px-5 pb-2 pt-4">
      {hideIdentity ? null : (
        <>
          <View className="flex-row items-center gap-2">
            <Text className="text-2xl font-bold text-text-primary">{pet.name}</Text>
            <AppIcon
              name={pet.gender === "female" ? "venus" : "mars"}
              color={pet.gender === "female" ? "#E0523F" : "#5B7FC7"}
              size={19}
            />
          </View>
          {facts ? (
            <Text className="mt-1 text-sm text-text-secondary">{facts}</Text>
          ) : null}
          {place ? (
            <Text className="mt-1 text-sm text-text-secondary">{place}</Text>
          ) : null}
        </>
      )}

      <View className={`${hideIdentity ? "mt-1 " : "mt-4 "}flex-row flex-wrap gap-2`}>
        <Chip>Enerji {pet.energyLevel}/5</Chip>
        {pet.isNeutered ? <Chip>Kısırlaştırılmış</Chip> : null}
      </View>

      {pet.temperaments.length > 0 ? (
        <Section title="Mizaç">
          <View className="flex-row flex-wrap gap-2">
            {pet.temperaments.map((temperament) => (
              <Chip key={temperament}>{temperamentLabels[temperament]}</Chip>
            ))}
          </View>
        </Section>
      ) : null}

      {compatibility.length > 0 ? (
        <Section title="Uyumluluk">
          <View className="gap-2">
            {compatibility.map(([label, value]) => (
              <View key={label} className="flex-row items-center gap-2">
                <AppIcon
                  name={value ? "circle-check" : "ban"}
                  color={value ? "#2FB8A6" : "#C4B7AE"}
                  size={16}
                />
                <Text className="text-sm text-text-secondary">
                  {label} {value ? "iyi geçinir" : "geçinemez"}
                </Text>
              </View>
            ))}
          </View>
        </Section>
      ) : null}

      {pet.bio ? (
        <Section title="Hakkında">
          <Text className="text-sm leading-6 text-text-secondary">{pet.bio}</Text>
        </Section>
      ) : null}

      {owner ? (
        <View className="mt-6 rounded-2xl border border-border bg-surface px-4 py-5">
          <Text className="mb-4 text-[11px] font-bold uppercase tracking-wide text-text-tertiary">
            Sahibi
          </Text>
          {ownerHeader ? <View className="mb-4">{ownerHeader}</View> : null}
          <OwnerProfileSection owner={owner} petName={pet.name} />
        </View>
      ) : ownerHeader ? (
        ownerHeader
      ) : null}
    </View>
  );
}
