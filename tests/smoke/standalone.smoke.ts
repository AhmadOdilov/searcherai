import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { STANDALONE_DIR } from "./helpers/target.ts";

/**
 * Deploy PAKETINING tarkibi — `next build` nima chiqarganiga qarash.
 *
 * ── Nega bu alohida qatlam ────────────────────────────────────────────────
 * Phase 5 va Phase 6 dagi ikkala artefakt nuqsoni ham ishlayotgan
 * ilovada UMUMAN ko'rinmasdi: ilova to'g'ri javob berardi, testlar
 * yashil edi, lekin deploy paketining ichida u yerda bo'lmasligi kerak
 * bo'lgan narsa yotardi:
 *
 *  · Phase 5 — o'qituvchilarning .pptx/.xlsx fayllari (`storage/`);
 *  · Phase 6 — `.env`, ichida AUTH_SECRET, AI_API_KEY va parolli
 *    DATABASE_URL.
 *
 * Ikkalasini ham faqat paketga QARAB topish mumkin edi.
 *
 * ── Ro'yxat qayerdan keladi ───────────────────────────────────────────────
 * `global-setup.ts` fayllar ro'yxatini staging'dan OLDIN oladi. Sabab:
 * ishga tushirish uchun paketga `public/`, `.next/static` va bo'sh
 * `storage/` qo'shiladi (Dockerfile ham shunday qiladi). Tekshiruv
 * BUILD nima chiqarganiga qarashi kerak, biz keyin nima
 * qo'shganimizga emas.
 */

/**
 * Ro'yxat DANGASA o'qiladi.
 *
 * Modul darajasidagi `await` bu yerda ishlatib bo'lmaydi: sinov
 * fayllari `tsx` orqali CommonJS'ga o'giriladi va u yerda yuqori
 * darajadagi `await` yo'q. Natija keshlanadi — fayl bir marta
 * o'qiladi.
 */
let cached: string[] | null = null;

async function bundleFiles(): Promise<string[]> {
  if (cached !== null) return cached;

  const location = process.env.SMOKE_BUNDLE_SNAPSHOT;
  assert.ok(
    location,
    "SMOKE_BUNDLE_SNAPSHOT sozlanmagan — smoke testi `npm run test:smoke` orqali ishga tushirilsin",
  );

  cached = JSON.parse(await readFile(location, "utf8")) as string[];
  return cached;
}

/**
 * Sir sifatida qidiriladigan qiymatlar.
 *
 * Qiymatlarning O'ZI hech qachon chop etilmaydi — nosozlikda faqat
 * o'zgaruvchi nomi va fayl yo'li ko'rsatiladi.
 *
 * 16 belgidan qisqa qiymatlar chetlab o'tiladi: qisqa satr paketda
 * tasodifan uchrab, yolg'on qizil berishi mumkin.
 */
function secretsToHunt(): Array<{ name: string; value: string }> {
  const candidates = ["AUTH_SECRET", "AI_API_KEY", "DATABASE_URL"];
  const found: Array<{ name: string; value: string }> = [];

  for (const name of candidates) {
    const value = process.env[name];
    if (value !== undefined && value.length >= 16) found.push({ name, value });
  }
  return found;
}

describe("standalone paketi — sirlar", () => {
  it(".env paketga TUSHMAGAN", async () => {
    const snapshot = await bundleFiles();
    const leaked = snapshot.filter((file) => file === ".env" || file.startsWith(".env."));

    assert.deepEqual(leaked, [], `paketda .env fayllari qoldi: ${leaked.join(", ")}`);
  });

  it("build chiqargan fayllar ichida sir qiymati YO'Q", async () => {
    /*
      Nima qidiriladi: serverning o'z kodi, klient bo'laklari va
      source map'lar. `node_modules` chetlab o'tiladi — u bog'liqlik
      kodi va u yerga bizning sirimiz tushishi mumkin emas.
    */
    const secrets = secretsToHunt();
    assert.ok(
      secrets.length > 0,
      "tekshirish uchun birorta ham sir topilmadi — muhit sozlanmagan",
    );

    const snapshot = await bundleFiles();
    const scannable = snapshot.filter(
      (file) =>
        file === "server.js" ||
        file.startsWith(".next/") ||
        file.endsWith(".js") ||
        file.endsWith(".map") ||
        file.endsWith(".json"),
    );
    assert.ok(scannable.length > 0, "tekshiriladigan fayl topilmadi");

    for (const relative of scannable) {
      const full = path.join(STANDALONE_DIR, relative);
      const info = await stat(full).catch(() => null);
      // Juda katta fayllar yo'q, lekin himoya sifatida chegara qo'yamiz.
      if (info === null || info.size > 32 * 1024 * 1024) continue;

      const contents = await readFile(full, "utf8").catch(() => "");
      for (const secret of secrets) {
        assert.ok(
          !contents.includes(secret.value),
          // ATAYLAB: faqat nom va yo'l. Qiymatning o'zi hech qachon chiqmaydi.
          `${secret.name} qiymati paketdagi faylga tushgan: ${relative}`,
        );
      }
    }
  });
});

describe("standalone paketi — ortiqcha fayllar", () => {
  it("o'qituvchilarning fayllari (storage/) paketda YO'Q", async () => {
    const snapshot = await bundleFiles();
    const leaked = snapshot.filter((file) => file.startsWith("storage/"));

    assert.deepEqual(
      leaked,
      [],
      `paketda saqlagich fayllari qoldi: ${leaked.join(", ")}`,
    );
  });

  it("sinov fayllari paketda YO'Q", async () => {
    const snapshot = await bundleFiles();
    const leaked = snapshot.filter(
      (file) =>
        file.startsWith("tests/") || /\.(test|e2e|spec|smoke)\.[cm]?[jt]sx?$/.test(file),
    );

    assert.deepEqual(leaked, [], `paketda sinov fayllari qoldi: ${leaked.join(", ")}`);
  });

  it("hujjatlar va deploy sozlamalari paketda YO'Q", async () => {
    const snapshot = await bundleFiles();
    const leaked = snapshot.filter(
      (file) =>
        file.endsWith(".md") ||
        file === "Dockerfile" ||
        file.startsWith("docker-compose") ||
        file.startsWith("nginx/") ||
        file.startsWith("prisma/") ||
        file.startsWith(".github/"),
    );

    assert.deepEqual(leaked, [], `paketda ortiqcha fayllar qoldi: ${leaked.join(", ")}`);
  });

  it("ishga tushirish uchun kerakli narsalar esa JOYIDA", async () => {
    const snapshot = await bundleFiles();
    /*
      Teskari tomon: tekshiruv shunchaki "paket bo'sh" bo'lgani uchun
      yashil bo'lib qolmasin.
    */
    assert.ok(snapshot.includes("server.js"), "paketda server.js yo'q");
    assert.ok(snapshot.includes("package.json"), "paketda package.json yo'q");
    assert.ok(
      snapshot.some((file) => file.startsWith(".next/server/")),
      "paketda server kodi yo'q",
    );
  });
});
