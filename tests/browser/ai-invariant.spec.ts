import { expect, test, type Page, type Request } from "@playwright/test";
import {
  cleanupBrowserUsers,
  disconnectSeed,
  seedWorkspace,
  type SeededWorkspace,
} from "./helpers/seed";

/**
 * MAHSULOTNING ASOSIY INVARIANTI — tahrir AI'ni chaqirmaydi.
 *
 * ── Nega buni BRAUZERDA tekshirish kerak ──────────────────────────────────
 * Server tomonida bu allaqachon tekshirilgan: soxta AI serveriga
 * yuborilgan promptlar sanaladi. Lekin o'sha sinovlar API'ni to'g'ridan-
 * to'g'ri chaqiradi — HAQIQIY muharrir sahifasi qanday so'rov
 * yuborayotganini ko'rmaydi.
 *
 * Bu yerda esa brauzerdan chiqayotgan HAR BIR so'rov ushlanadi. Agar
 * kelajakda muharrirga tasodifan "qaytadan tayyorlash" chaqiruvi
 * qo'shilsa yoki avtosaqlash generatsiyani ishga tushirsa — bu sinov
 * darhol yiqiladi.
 *
 * Bu mahsulotning yagona eng muhim va'dasi: o'qituvchi natijani
 * tahrirlaganda AI'ga QAYTA PUL TO'LAMAYDI.
 */

/**
 * AI generatsiyasini ishga tushiradigan yo'llar.
 *
 * Ro'yxat ataylab TO'LIQ: yangi AI endpointi qo'shilsa, uni bu yerga
 * ham yozish kerak — aks holda invariant jim buziladi.
 */
const AI_ENDPOINTS = [
  /\/api\/lesson-plans\/[^/]+\/regenerate/,
  /\/api\/presentations\/[^/]+\/regenerate/,
  /\/api\/calendar-plans\/[^/]+\/regenerate/,
  // Yangi yozuv yaratish ham AI chaqiradi (POST).
  /\/api\/lesson-plans$/,
  /\/api\/presentations$/,
  /\/api\/calendar-plans$/,
  /\/api\/search/,
  /\/api\/vision-analyze/,
];

/** So'rov AI generatsiyasini ishga tushiradimi. */
function isAiRequest(request: Request): boolean {
  const url = new URL(request.url());
  const method = request.method();

  // Ro'yxatni O'QISH (GET) AI chaqirmaydi — faqat mutatsiyalar muhim.
  if (method === "GET" || method === "HEAD") return false;

  return AI_ENDPOINTS.some((pattern) => pattern.test(url.pathname));
}

/** Sahifadan chiqqan AI so'rovlarini yig'adi. */
function watchAiRequests(page: Page): string[] {
  const seen: string[] = [];
  page.on("request", (request) => {
    if (isAiRequest(request)) {
      seen.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
  return seen;
}

let workspace: SeededWorkspace;

test.beforeAll(async () => {
  await cleanupBrowserUsers();
  workspace = await seedWorkspace("http://localhost:3200", "invariant");
});

test.afterAll(async () => {
  await cleanupBrowserUsers();
  await disconnectSeed();
});

test.beforeEach(async ({ context }) => {
  await context.addCookies([
    {
      ...workspace.cookie,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
});

/** Saqlash tugmasini bosib, PATCH javobini kutadi. */
async function saveAndWait(page: Page): Promise<number> {
  const saveButton = page.getByRole("button", { name: /saqlash/i });
  await expect(saveButton).toBeEnabled();

  const [response] = await Promise.all([
    page.waitForResponse(
      (r) => r.request().method() === "PATCH" && r.url().includes("/api/"),
      { timeout: 30_000 },
    ),
    saveButton.click(),
  ]);

  return response.status();
}

test("prezentatsiyani tahrirlash — AI so'rovi 0", async ({ page }) => {
  const aiRequests = watchAiRequests(page);

  await page.goto(`/dashboard/presentations/${workspace.presentationId}/edit`, {
    waitUntil: "networkidle",
  });

  // Sarlavhani o'zgartiramiz.
  const title = page.locator("#presentation-title");
  await title.fill("Brauzerda qo'lda tahrirlangan sarlavha");

  const status = await saveAndWait(page);
  expect(status).toBe(200);

  // "Saqlandi" holati ko'rinishi kerak — saqlash haqiqatan tugagan.
  await expect(page.getByText(/saqlandi/i)).toBeVisible({ timeout: 10_000 });

  expect(aiRequests, `AI so'rovlari yuborildi: ${aiRequests.join(", ")}`).toEqual([]);
});

test("slaydni o'zgartirish va tartibini almashtirish — AI so'rovi 0", async ({
  page,
}) => {
  const aiRequests = watchAiRequests(page);

  await page.goto(`/dashboard/presentations/${workspace.presentationId}/edit`, {
    waitUntil: "networkidle",
  });

  // Ikkinchi slaydni tanlaymiz.
  const slideButtons = page.locator("ol li button").first();
  await slideButtons.click();

  // Sarlavhasini o'zgartiramiz.
  const heading = page.locator("textarea#slide-heading-0");
  await heading.fill("Tahrirlangan slayd sarlavhasi");

  // Pastga ko'chirish tugmasi.
  const moveDown = page.getByRole("button", { name: /pastga ko'chirish/i }).first();
  if (await moveDown.isEnabled()) await moveDown.click();

  const status = await saveAndWait(page);
  expect(status).toBe(200);

  expect(aiRequests, `AI so'rovlari yuborildi: ${aiRequests.join(", ")}`).toEqual([]);
});

test("kalendar rejani tahrirlash — AI so'rovi 0", async ({ page }) => {
  const aiRequests = watchAiRequests(page);

  await page.goto(`/dashboard/calendar-plans/${workspace.calendarPlanId}/edit`, {
    waitUntil: "networkidle",
  });

  const title = page.locator("#plan-title");
  await title.fill("Brauzerda tahrirlangan reja nomi");

  const status = await saveAndWait(page);
  expect(status).toBe(200);

  expect(aiRequests, `AI so'rovlari yuborildi: ${aiRequests.join(", ")}`).toEqual([]);
});

test("dars ishlanmasini tahrirlash — AI so'rovi 0", async ({ page }) => {
  const aiRequests = watchAiRequests(page);

  await page.goto(`/dashboard/lesson-plans/${workspace.lessonPlanId}/edit`, {
    waitUntil: "networkidle",
  });

  const objective = page.locator("#objective");
  await objective.fill("Brauzerda qo'lda yozilgan dars maqsadi matni.");

  const status = await saveAndWait(page);
  expect(status).toBe(200);

  expect(aiRequests, `AI so'rovlari yuborildi: ${aiRequests.join(", ")}`).toEqual([]);
});

test("saqlanmagan o'zgarish bo'lsa saqlash tugmasi YOQILADI", async ({ page }) => {
  await page.goto(`/dashboard/lesson-plans/${workspace.lessonPlanId}/edit`, {
    waitUntil: "networkidle",
  });

  const saveButton = page.getByRole("button", { name: /saqlash/i });
  // Boshida o'zgarish yo'q — tugma o'chirilgan.
  await expect(saveButton).toBeDisabled();

  await page.locator("#objective").fill("O'zgartirildi va endi saqlash mumkin.");
  await expect(saveButton).toBeEnabled();

  // Ogohlantirish matni ham ko'rinishi kerak.
  await expect(page.getByText(/saqlanmagan/i)).toBeVisible();
});
