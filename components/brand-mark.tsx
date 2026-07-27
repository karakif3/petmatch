import { Image } from "expo-image";

export function BrandMark({ size = 72 }: { size?: number }) {
  return (
    <Image
      source={require("../assets/icon.png")}
      contentFit="cover"
      accessibilityLabel="PetMatch"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
      }}
    />
  );
}
