import { Platform } from "react-native";

import {
  fitWithin,
  UPLOAD_JPEG_QUALITY,
  UPLOAD_MAX_EDGE,
} from "../domain/image-upload";

export type PreparedUpload = {
  body: ArrayBuffer;
  contentType: string;
  extension: string;
};

type SourcePhoto = { uri: string; mimeType?: string | null; fileName?: string | null };

function originalExtension(photo: SourcePhoto): string {
  const fromName = photo.fileName?.split(".").pop()?.toLowerCase();
  if (fromName && /^[a-z0-9]+$/.test(fromName)) return fromName;
  if (photo.mimeType === "image/png") return "png";
  if (photo.mimeType === "image/webp") return "webp";
  return "jpg";
}

async function readBody(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  return response.arrayBuffer();
}

/**
 * Yüklemeden önce: uzun kenar ≤ 1600 px, JPEG 0.8. HEIC/PNG da JPEG'e
 * döner — bucket MIME listesi ve her istemcide görüntülenebilirlik için.
 *
 * İşleme başarısız olursa (web, bozuk dosya, desteklenmeyen biçim)
 * ORİJİNAL yüklenir: boyutlandırma bir iyileştirme, yüklemenin şartı değil.
 * Bucket'taki 12 MB sınırı son savunma olarak duruyor.
 */
export async function prepareImageForUpload(photo: SourcePhoto): Promise<PreparedUpload> {
  if (Platform.OS !== "web") {
    try {
      const { ImageManipulator, SaveFormat } = await import("expo-image-manipulator");
      const context = ImageManipulator.manipulate(photo.uri);
      let image = await context.renderAsync();
      const target = fitWithin(image.width, image.height, UPLOAD_MAX_EDGE);
      if (target) {
        context.resize(target);
        image = await context.renderAsync();
      }
      const saved = await image.saveAsync({
        compress: UPLOAD_JPEG_QUALITY,
        format: SaveFormat.JPEG,
      });
      return {
        body: await readBody(saved.uri),
        contentType: "image/jpeg",
        extension: "jpg",
      };
    } catch (error) {
      console.warn("Fotoğraf küçültülemedi, orijinal yükleniyor:", error);
    }
  }

  return {
    body: await readBody(photo.uri),
    contentType: photo.mimeType ?? "image/jpeg",
    extension: originalExtension(photo),
  };
}
