#!/usr/bin/env node
/**
 * Veritabanı davranış testleri.
 *
 * Tek kullanımlık bir Postgres container'ı açar, TÜM migration'ları sıfırdan
 * uygular, sonra `supabase/tests/*.test.sql` dosyalarını çalıştırır.
 *
 * Neden böyle: vitest suite'i saf domain'i koruyor ama kullanıcıyı asıl
 * koruyan katman RLS politikaları ve RPC yetki kontrolleri — onlar yalnızca
 * gerçek bir Postgres'te doğrulanabilir. Ayrıca migration'ların baştan
 * uygulanabilir olduğunu da bu koşum kanıtlıyor (staging ve felaket kurtarma
 * bunun üzerine kurulu).
 *
 * Kullanım:  npm run test:db
 * Gerekli:   Docker + yerelde bir supabase/postgres imajı
 */
import { execSync, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MIGRATIONS = path.join(ROOT, "supabase", "migrations");
const TESTS = path.join(ROOT, "supabase", "tests");
const CONTAINER = "petmatch_test_db";

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

function sh(command, options = {}) {
  return execSync(command, { encoding: "utf8", stdio: "pipe", ...options });
}

/**
 * İmajı yerelden seçiyoruz. Bazı ağlarda Docker Hub'a TLS çıkışı engelli ve
 * `docker pull` başarısız oluyor; yerel imaj varsa koşum yine de çalışmalı.
 */
function resolvePostgresImage() {
  const images = sh('docker images --format "{{.Repository}}:{{.Tag}}"')
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const supabase = images.find((image) => /supabase\/postgres:/.test(image));
  if (supabase) return supabase;

  const plain = images.find((image) => /^postgres:/.test(image));
  if (plain) return plain;

  throw new Error(
    "Yerelde supabase/postgres veya postgres imajı bulunamadı.\n" +
      "  docker pull public.ecr.aws/supabase/postgres:17.6.1.111",
  );
}

/**
 * `tests.assert` sonucunu NOTICE olarak yazıyor — yani stderr'e. Bu yüzden
 * spawnSync kullanıp iki akışı da topluyoruz; `-t -A` de boş assert
 * satırlarının çıktıyı doldurmasını engelliyor.
 */
function psql({ user = "postgres", file, sql, admin = false }) {
  const args = ["exec", "-i"];
  if (admin) args.push("-e", "PGPASSWORD=x");
  args.push(CONTAINER, "psql", "-U", user);
  if (admin) args.push("-h", "127.0.0.1");
  args.push("-d", "postgres", "-q", "-t", "-A", "-v", "ON_ERROR_STOP=1");
  if (sql) args.push("-c", sql);

  const result = spawnSync("docker", args, {
    encoding: "utf8",
    input: file ? readFileSync(file, "utf8") : undefined,
  });

  const stdout = result.stdout || "";
  const stderr = result.stderr || "";

  if (result.status !== 0) {
    const error = new Error(`psql çıkış kodu ${result.status}`);
    error.stdout = stdout;
    error.stderr = stderr;
    throw error;
  }

  return { stdout, stderr };
}

/** psql NOTICE satırlarını okunur hale getirir. */
function formatNotices(stderr) {
  return stderr
    .split("\n")
    .filter((line) => line.startsWith("NOTICE:"))
    .map((line) => line.replace(/^NOTICE:\s*/, ""))
    .join("\n");
}

function waitForPostgres() {
  // İlk açılışta imaj initdb sunucusundan gerçek sunucuya geçiyor; iki kez
  // beklemezsek geçiş anında bağlantı kopuyor.
  for (let round = 0; round < 2; round += 1) {
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      try {
        psql({ sql: "select 1" });
        ready = true;
        break;
      } catch {
        sh("sleep 2");
      }
    }
    if (!ready) throw new Error("Postgres 120 saniyede hazır olmadı.");
    if (round === 0) sh("sleep 8");
  }
}

function cleanup() {
  try {
    sh(`docker rm -f ${CONTAINER}`);
  } catch {
    // container zaten yok
  }
}

function main() {
  try {
    sh("docker info");
  } catch {
    console.error(`${RED}Docker çalışmıyor.${RESET} Bu koşum Docker gerektiriyor.`);
    process.exit(1);
  }

  const image = resolvePostgresImage();
  console.log(`${DIM}imaj: ${image}${RESET}`);

  cleanup();
  sh(`docker run -d --name ${CONTAINER} -e POSTGRES_PASSWORD=x ${image}`);

  let failed = 0;

  try {
    waitForPostgres();

    // Supabase servislerinin yarattığı nesnelerin taklidi (supabase_admin gerekir).
    psql({ user: "supabase_admin", admin: true, file: path.join(TESTS, "_bootstrap.sql") });

    const migrations = readdirSync(MIGRATIONS).filter((f) => f.endsWith(".sql")).sort();
    for (const migration of migrations) {
      try {
        psql({ file: path.join(MIGRATIONS, migration) });
      } catch (error) {
        console.error(`${RED}✗ migration ${migration}${RESET}`);
        console.error(String(error.stderr || error.message).trim());
        cleanup();
        process.exit(1);
      }
    }
    console.log(`${GREEN}✓${RESET} ${migrations.length} migration sıfırdan uygulandı`);

    psql({ file: path.join(TESTS, "_helpers.sql") });

    const suites = readdirSync(TESTS).filter((f) => f.endsWith(".test.sql")).sort();
    for (const suite of suites) {
      try {
        const { stderr } = psql({ file: path.join(TESTS, suite) });
        const notices = formatNotices(stderr);
        if (notices) console.log(notices);
        console.log(`${GREEN}✓${RESET} ${suite}\n`);
      } catch (error) {
        failed += 1;
        const notices = formatNotices(String(error.stderr || ""));
        if (notices) console.log(notices);
        console.error(`${RED}✗ ${suite}${RESET}`);
        console.error(
          String(error.stderr || "")
            .split("\n")
            .filter((line) => /FAIL|ERROR/.test(line))
            .map((line) => `    ${line}`)
            .join("\n") + "\n",
        );
      }
    }

    console.log(
      failed === 0
        ? `\n${GREEN}Tüm veritabanı testleri geçti${RESET} (${suites.length} dosya)`
        : `\n${RED}${failed}/${suites.length} test dosyası düştü${RESET}`,
    );
  } finally {
    cleanup();
  }

  process.exit(failed === 0 ? 0 : 1);
}

main();
