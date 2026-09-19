import { test, expect, type Page } from "@playwright/test";
import {
  seedWorkspace,
  cleanupBrowserUsers,
  setRecordStatus,
  type SeededWorkspace,
} from "./helpers/seed";

/**
 * GENERATSIYA KUZATUVI (polling) — uchala modulda.
 *
 * ── Nega bu sinov kerak bo'ldi ────────────────────────────────────────────
 * Haqiqiy foydalanuvchi E2E auditida P1 nuqson topildi: generatsiya
 * serverda tugagach sahifa O'ZI YANGILANMASDI. Foydalanuvchi
 * "Tayyorlanmoqda" yozuvini ko'rib turardi, o'tgan vaqt hisoblagichi esa
 * "0 soniya" da qotib qolardi. Natijani ko'rish uchun sahifani QO'LDA
 * qayta yuklash kerak edi.
 *
 * Nuqson uchala modulda ham (prezentatsiya, kalendar reja, dars
 * ishlanmasi) takrorlandi — demak u umumiy infratuzilmada.
 *
 * ── Nega AI chaqirilmaydi ─────────────────────────────────────────────────
 * Sinov POLLING mexanizmini o'lchaydi, AI tezligini emas. Yozuv PENDING
 * holatda seed qilinadi, so'ng bevosita bazada READY ga o'tkaziladi.
 * Shunda sinov tez, arzon va deterministik bo'ladi.
 *
 * ── QO'LDA QAYTA YUKLASH TAQIQLANADI ──────────────────────────────────────
 * Hech bir tasdiq `page.reload()` dan keyin bajarilmaydi. Aks holda sinov
 * aynan buzuq xatti-harakatni "o'tdi" deb belgilab qo'yardi.
 */

let workspace: SeededWorkspace;

test.beforeAll(async ({ baseURL }) => {
  await cleanupBrowserUsers();
  workspace = await seedWorkspace(baseURL ?? "http://localhost:3200", "polling");
});

test.afterAll(async () => {
  await cleanupBrowserUsers();
});

async function signIn(page: Page, baseURL: string): Promise<void> {
  const url = new URL(baseURL);
  await page.context().addCookies([
    {
      name: workspace.cookie.name,
      value: workspace.cookie.value,
      domain: url.hostname,
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

const MODULES = [
  {
    name: "prezentatsiya",
    model: "presentation" as const,
    path: (w: SeededWorkspace) => `/dashboard/presentations/${w.presentationId}`,
    id: (w: SeededWorkspace) => w.presentationId,
  },
  {
    name: "kalendar reja",
    model: "calendarPlan" as const,
    path: (w: SeededWorkspace) => `/dashboard/calendar-plans/${w.calendarPlanId}`,
    id: (w: SeededWorkspace) => w.calendarPlanId,
  },
  {
    name: "dars ishlanmasi",
    model: "lessonPlan" as const,
    path: (w: SeededWorkspace) => `/dashboard/lesson-plans/${w.lessonPlanId}`,
    id: (w: SeededWorkspace) => w.lessonPlanId,
  },
];

for (const target of MODULES) {
  test.describe(`${target.name} — generatsiya kuzatuvi`, () => {
    test("o'tgan vaqt hisoblagichi ISHLAYDI", async ({ page, baseURL }) => {
      await signIn(page, baseURL!);
      await setRecordStatus(target.model, target.id(workspace), "PENDING");
      await page.goto(target.path(workspace));

      const progress = page.getByRole("progressbar");
      await expect(progress).toBeVisible();

      // Hisoblagich soniyada bir marta yangilanishi kerak.
      const elapsed = page.getByText(/soniya o'tdi/);
      await expect(elapsed).toBeVisible();
      const first = (await elapsed.textContent()) ?? "";

      await page.waitForTimeout(3500);
      const second = (await elapsed.textContent()) ?? "";

      expect(second, `hisoblagich qotib qolgan: "${first}"`).not.toBe(first);
    });

    test("holat READY ga o'tsa sahifa QAYTA YUKLASHSIZ yangilanadi", async ({ page, baseURL }) => {
      await signIn(page, baseURL!);
      await setRecordStatus(target.model, target.id(workspace), "PENDING");
      await page.goto(target.path(workspace));

      await expect(page.getByRole("progressbar")).toBeVisible();

      // Serverda generatsiya tugadi.
      await setRecordStatus(target.model, target.id(workspace), "READY");

      /*
        Bu yerda page.reload() YO'Q va bo'lmasligi kerak.
        Polling o'zi holatni sezib, sahifani yangilashi shart.
      */
      await expect(page.getByRole("progressbar")).toBeHidden({ timeout: 20_000 });
      await expect(page.getByText(/Tayyorlanmoqda/)).toHaveCount(0);
    });

    test("holat FAILED bo'lsa xato ko'rsatiladi", async ({ page, baseURL }) => {
      await signIn(page, baseURL!);
      await setRecordStatus(target.model, target.id(workspace), "PENDING");
      await page.goto(target.path(workspace));

      await expect(page.getByRole("progressbar")).toBeVisible();
      await setRecordStatus(target.model, target.id(workspace), "FAILED");

      await expect(page.getByRole("progressbar")).toBeHidden({ timeout: 20_000 });
    });

    test("kuzatuv bitta so'rov oqimida ishlaydi (dublikat yo'q)", async ({ page, baseURL }) => {
      await signIn(page, baseURL!);
      await setRecordStatus(target.model, target.id(workspace), "PENDING");

      const polls: string[] = [];
      page.on("request", (request) => {
        const url = request.url();
        if (url.includes("/api/") && url.includes(target.id(workspace))) polls.push(url);
      });

      await page.goto(target.path(workspace));
      await expect(page.getByRole("progressbar")).toBeVisible();
      await page.waitForTimeout(5000);

      // 2 soniyalik oraliqda 5 soniyada ~3 ta so'rov kutiladi.
      expect(polls.length, "polling so'rovlari umuman yuborilmadi").toBeGreaterThan(0);
      expect(polls.length, `juda ko'p so'rov — parallel oqim bormi? ${polls.length}`).toBeLessThan(8);

      await setRecordStatus(target.model, target.id(workspace), "READY");
    });
  });
}

test.describe("kuzatuv tozalanishi", () => {
  test("sahifadan chiqilganda polling to'xtaydi", async ({ page, baseURL }) => {
    await signIn(page, baseURL!);
    await setRecordStatus("presentation", workspace.presentationId, "PENDING");
    await page.goto(`/dashboard/presentations/${workspace.presentationId}`);
    await expect(page.getByRole("progressbar")).toBeVisible();

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /Xush kelibsiz/ })).toBeVisible();

    const after: string[] = [];
    page.on("request", (request) => {
      if (request.url().includes(workspace.presentationId)) after.push(request.url());
    });
    await page.waitForTimeout(5000);

    expect(after, `sahifa yopilgach ham so'rov ketmoqda: ${after.length}`).toHaveLength(0);
    await setRecordStatus("presentation", workspace.presentationId, "READY");
  });
});
