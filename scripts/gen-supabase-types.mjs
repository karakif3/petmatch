/**
 * Supabase tiplerini üretir. Proje ref'i env'den okunur — repoda hard-code
 * proje kimliği tutmuyoruz ki başka bir hesaba taşımak kolay olsun.
 *
 *   SUPABASE_PROJECT_ID=<ref> npm run gen:types
 */
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { loadEnvFile } from "node:process";

// Expo `.env` dosyasını uygulama çalışırken otomatik yükler; bu bağımsız Node
// script'i ise açıkça yüklemelidir. Mevcut shell değişkenleri önceliğini korur.
try {
  loadEnvFile(".env");
} catch (error) {
  if (error?.code !== "ENOENT") throw error;
}

const projectId = process.env.SUPABASE_PROJECT_ID?.trim();
const supabaseBin = process.env.SUPABASE_BIN?.trim() || "supabase";

if (!projectId) {
  console.error(
    "SUPABASE_PROJECT_ID tanımlı değil.\n" +
      "  .env dosyasına ekle veya: SUPABASE_PROJECT_ID=<ref> npm run gen:types",
  );
  process.exit(1);
}

const output = execFileSync(
  supabaseBin,
  ["gen", "types", "typescript", "--project-id", projectId],
  { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 },
);

writeFileSync("types/database.ts", output);
console.log("types/database.ts güncellendi.");
