import { defineConfig, devices } from "@playwright/test";

/**
 * Brauzer testlari sozlamasi.
 *
 * ── Nega bu qatlam kerak bo'ldi ───────────────────────────────────────────
 * Phase 2.1 auditida HAQIQIY nuqson qochib ketdi: slaydlar ro'yxatidagi
 * `truncate` (`white-space: nowrap`) grid elementini 833px ga cho'zib,
 * 375px ekranda 474px gorizontal toshish bergan. 478 birlik va 220
 * uchidan-uchgacha testning birortasi buni ko'rmadi — ular DOM
 * o'lchamini umuman bilmaydi.
 *
 * Shuning uchun bu qatlamning vazifasi ANIQ: mavjud testlar ko'ra
 * olmaydigan narsalarni tekshirish — joylashuv, o'lcham, fokus va
 * brauzerdan chiqayotgan tarmoq so'rovlari.
 *
 * ── Nega `node:test` bilan to'qnashmaydi ──────────────────────────────────
 * Ikkalasi alohida ishlovchi va alohida skript: `npm test` va
 * `npm run test:e2e` `node --test` ni, `npm run test:browser` esa
 * Playwright'ni ishga tushiradi. Fayl namunalari ham kesishmaydi
 * (`tests/browser/**` va `tests/**\/*.test.ts`).
 *
 * ── Nega faqat Chromium ───────────────────────────────────────────────────
 * Tekshirilayotgan narsa — CSS joylashuvi va tegish nishonlari. Ular
 * brauzerlar orasida farq qilmaydi darajada standart. Uchta brauzer
 * ishga tushirish CI vaqtini uch barobar oshirar, lekin yangi nuqson
 * topmasdi. Kerak bo'lsa keyin qo'shiladi.
 */
export default defineConfig({
  testDir: "./tests/browser",
  /*
    Sinovlar bitta bazani baham ko'radi va ma'lumot yaratadi, shuning
    uchun ketma-ket. Tezlik bu yerda ikkinchi darajali — brauzer
    to'plami ataylab kichik.
  */
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : [["list"]],

  use: {
    /*
      `localhost`, `127.0.0.1` EMAS.

      Next dev serveri `/_next/hmr` kabi ichki resurslarni begona
      origindan so'ralganda bloklaydi. `127.0.0.1` u uchun boshqa origin
      hisoblanadi va natijada klient kodi HIDRATSIYA BO'LMAYDI: sahifa
      ko'rinadi, lekin tugmalar jonlanmaydi.

      Bu ilova sozlamasi bilan ham hal qilinardi (`allowedDevOrigins`),
      lekin bu sinovga xos muammo — ilovaga tegmaymiz.
    */
    baseURL: process.env.BROWSER_BASE_URL ?? "http://localhost:3200",
    // Nosozlik sababini ko'rish uchun — muvaffaqiyatda saqlanmaydi.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  /*
    Server sinovlar tomonidan ko'tariladi.

    `next dev` ataylab: `next build` CI'da ~1 daqiqa oladi va brauzer
    testlari uchun production optimizatsiyasi kerak emas — ular
    joylashuvni tekshiradi, tezlikni emas.
  */
  webServer: {
    command: "npm run dev -- --port 3200",
    url: "http://localhost:3200/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      /*
        Ro'yxatdan o'tish cheklovi sinovlar uchun ko'tariladi.

        Standart qiymat soatiga 10/IP. Brauzer to'plami har ishga
        tushishda bir nechta hisob ochadi va hammasi 127.0.0.1 dan
        keladi — productiondagi chegara ularni birinchi fayldayoq
        to'xtatardi.

        Xuddi shu yondashuv `tests/e2e/helpers/global-server.ts` da ham
        ishlatiladi.
      */
      REGISTER_MAX_PER_IP: "1000",

      /*
        `APP_URL` port bilan MOS bo'lishi SHART.

        CSRF himoyasi (`lib/api/csrf.ts`) so'rovning `Origin` sarlavhasini
        aynan `APP_URL` bilan solishtiradi. Brauzer `http://localhost:3200`
        yuboradi, `.env` dagi qiymat esa 3000 — natijada har bir
        saqlash 403 bilan rad etilardi.

        Bu himoya TO'G'RI ishlayotganining dalili: birinchi ishga
        tushirishdayoq u brauzerdan kelgan haqiqiy so'rovni ushladi.
        Node testlari buni ko'rmaydi — ular `Origin` sarlavhasini
        umuman yubormaydi.
      */
      APP_URL: "http://localhost:3200",
    },
  },
});
