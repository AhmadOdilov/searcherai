/**
 * `next build` dan keyin: `.env*` fayllarini standalone paketidan olib tashlaydi.
 *
 * ── Muammo ────────────────────────────────────────────────────────────────
 * `output: "standalone"` bilan Next.js loyihadagi `.env` va
 * `.env.production` fayllarini natija papkasiga NUSXALAYDI. Bu framework
 * ichida qattiq yozilgan va sozlama bilan o'chirilmaydi — manba:
 * `node_modules/next/dist/build/index.js`, `writeStandaloneDirectory()`.
 * `outputFileTracingExcludes` ham yordam bermaydi: nusxalash izlarni
 * yig'uvchidan (file tracing) TASHQARIDA, alohida sikl bilan bajariladi.
 *
 * Natijada mahalliy `npm run build` dan keyin `.next/standalone/.env`
 * paydo bo'ladi va uning ichida HAQIQIY qiymatlar turadi: `AUTH_SECRET`,
 * `AI_API_KEY`, parolli `DATABASE_URL`.
 *
 * ── Nega baribir kerak, Dockerfile allaqachon o'chirsa ham ────────────────
 * Docker yo'lida ikkita himoya bor:
 *   1. `.dockerignore` — `.env` build kontekstiga umuman tushmaydi;
 *   2. Dockerfile'dagi `rm -f .next/standalone/.env*` — ikkinchi chiziq.
 *
 * Lekin ikkalasi ham FAQAT Docker yo'lida ishlaydi. Docker'siz qilingan
 * build (dasturchining noutbuki, CI artefakti, `rsync` bilan qo'lda
 * deploy) hech qanday himoyasiz qoladi — sir shunchaki `.next/` ichida
 * yotaveradi.
 *
 * Bu aynan Phase 5 dagi `storage/` muammosining takrori: himoya
 * `.dockerignore` da edi va u "tasodifiy himoya" deb baholanib,
 * `next.config.ts` ga ko'chirilgan edi. Bu yerda `next.config.ts`
 * yordam bera olmaydi (nusxalash sozlanmaydi), shuning uchun himoya
 * build'ning O'ZIGA — `postbuild` qadamiga qo'yiladi.
 *
 * ── Nega fayl o'chiriladi, ogohlantirish berilmaydi ───────────────────────
 * Ogohlantirishni o'qish shart emas va u e'tibordan qoladi. Fayl esa
 * paketda KERAK EMAS: production'da muhit o'zgaruvchilari konteynerga
 * (yoki systemd birligiga) tashqaridan beriladi, `.env` fayli orqali
 * emas. Ya'ni o'chirish hech qanday ishlayotgan oqimni buzmaydi.
 */

import { readdir, rm } from "node:fs/promises";
import path from "node:path";

const STANDALONE = path.join(process.cwd(), ".next", "standalone");

let entries;
try {
  entries = await readdir(STANDALONE);
} catch {
  /*
    Papka yo'q — build `standalone` rejimisiz qilingan yoki umuman
    bajarilmagan. Bu xato emas: `postbuild` har qanday build'dan keyin
    ishlaydi.
  */
  process.exit(0);
}

const leaked = entries.filter((name) => name === ".env" || name.startsWith(".env."));

for (const name of leaked) {
  await rm(path.join(STANDALONE, name), { force: true });
}

if (leaked.length > 0) {
  console.log(
    `[build] standalone paketidan olib tashlandi: ${leaked.join(", ")} ` +
      `(sirlar deploy paketiga tushmasligi kerak)`,
  );
}
