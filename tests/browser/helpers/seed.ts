import { execFileSync } from "node:child_process";

/**
 * Brauzer testlari uchun ma'lumot tayyorlash.
 *
 * ── Nega ALOHIDA jarayon ──────────────────────────────────────────────────
 * Playwright TypeScript'ni CommonJS'ga o'giradi, Prisma'ning generatsiya
 * qilingan klienti esa faqat ESM. Bitta jarayonda ular birlashmaydi
 * ("Cannot use 'import.meta' outside a module").
 *
 * Shuning uchun baza ishi `tsx` ostidagi alohida jarayonda bajariladi
 * (`seed-worker.ts`) va natija JSON bo'lib qaytadi. Bu mavjud e2e
 * to'plami ishlatadigan naqshning o'zi.
 *
 * ── Nega ma'lumot AI'siz tayyorlanadi ─────────────────────────────────────
 * Brauzer testlari muharrirni tekshiradi, generatsiyani emas. HTTP orqali
 * yaratsak, har bir sinov haqiqiy AI so'rovi yuborardi: sekin, qimmat va
 * natijasi har safar boshqacha. Tayyor yozuv esa BASHORAT QILINADIGAN.
 */

export interface SeededWorkspace {
  cookie: { name: string; value: string };
  email: string;
  presentationId: string;
  calendarPlanId: string;
  lessonPlanId: string;
  longHeading: string;
}

const WORKER = "tests/browser/helpers/seed-worker.ts";

function runWorker(args: string[]): string {
  return execFileSync("npx", ["tsx", "--env-file-if-exists=.env", WORKER, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}

export async function seedWorkspace(
  baseUrl: string,
  suffix: string,
): Promise<SeededWorkspace> {
  const output = runWorker(["seed", baseUrl, suffix]);
  return JSON.parse(output) as SeededWorkspace;
}

export async function cleanupBrowserUsers(): Promise<void> {
  runWorker(["cleanup"]);
}

/** Alohida jarayon o'zi yopiladi — bu yerda qiladigan ish yo'q. */
export async function disconnectSeed(): Promise<void> {}
