import { expect, test } from "@playwright/test";
import {
  cleanupBrowserUsers,
  disconnectSeed,
  seedWorkspace,
  type SeededWorkspace,
} from "./helpers/seed";

/**
 * Kirishdan keyingi qaytish manzili — HAQIQIY brauzerda.
 *
 * ── Nega aynan brauzerda ──────────────────────────────────────────────────
 * Birlik sinovi (`tests/safe-redirect.test.ts`) funksiyaning o'zini
 * tekshiradi. Lekin bu yerdagi savol boshqacha: brauzer manzilni
 * funksiya bilan BIR XIL o'qiydimi?
 *
 * Aynan shu farq nuqsonni tug'digan edi — eski tekshiruv satrga
 * qarardi (`/` bilan boshlanadi, `//` bilan emas), brauzer esa
 * `/\begona.example` ni `https://begona.example/` deb yechardi. Nuqson
 * o'lchangan: probada brauzer HAQIQATAN tashqi manzilga so'rov
 * yuborgan.
 */

let workspace: SeededWorkspace;

test.beforeAll(async () => {
  await cleanupBrowserUsers();
  workspace = await seedWorkspace("http://localhost:3200", "kirish-qaytish");
});

test.afterAll(async () => {
  await cleanupBrowserUsers();
  await disconnectSeed();
});

/** Kirish formasini to'ldirib yuboradi. */
async function signIn(page: import("@playwright/test").Page, next: string) {
  await page.goto(`/login?next=${encodeURIComponent(next)}`, {
    waitUntil: "networkidle",
  });
  await page.locator('input[name="email"]').fill(workspace.email);
  await page.locator('input[name="password"]').fill("juda-maxfiy-parol");
  await page.locator('form button[type="submit"]').first().click();
}

/*
  Tashqi saytga o'tish urinishlari — hammasi `/dashboard` ga tushishi
  kerak. Ro'yxat qisqa va ANIQ: har biri boshqa mexanizm.
*/
const EXTERNAL = [
  // Teskari chiziq — brauzer uni oldinga chiziq deb o'qiydi. AYNAN
  // shu holat eski tekshiruvdan o'tib ketardi.
  { label: "teskari chiziq", next: "/\\begona.example" },
  // Klassik protokolsiz manzil — eski tekshiruv buni to'sardi.
  { label: "protokolsiz manzil", next: "//begona.example" },
  // To'liq manzil.
  { label: "to'liq manzil", next: "https://begona.example/kirish" },
];

for (const { label, next } of EXTERNAL) {
  test(`${label}: begona saytga OLIB CHIQMAYDI`, async ({ page, context }) => {
    // Tashqi so'rov ketsa — uni ushlaymiz va sinov yiqiladi.
    const external: string[] = [];
    await context.route("**://begona.example/**", (route) => {
      external.push(route.request().url());
      return route.abort();
    });

    await signIn(page, next);
    await page.waitForURL(/localhost:3200/, { timeout: 10_000 });

    expect(external, `brauzer tashqi manzilga so'rov yubordi`).toEqual([]);
    await expect(page).toHaveURL(/\/dashboard$/);
  });
}

test("ICHKI manzil saqlanadi — so'rov qismi bilan birga", async ({ page }) => {
  /*
    Himoya haddan tashqari qattiq bo'lib qolmasin: proxy `next` ga
    `pathname + search` ni yozadi va filtr yo'qolsa foydalanuvchi
    kirgandan keyin boshqa ro'yxatga tushib qolardi.
  */
  await signIn(page, "/dashboard/lesson-plans?status=READY");

  await page.waitForURL(/lesson-plans/, { timeout: 10_000 });
  await expect(page).toHaveURL(/\/dashboard\/lesson-plans\?status=READY$/);
});
