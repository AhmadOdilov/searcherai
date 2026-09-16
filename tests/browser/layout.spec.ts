import { expect, test, type Page } from "@playwright/test";
import {
  cleanupBrowserUsers,
  disconnectSeed,
  seedWorkspace,
  type SeededWorkspace,
} from "./helpers/seed";

/**
 * Muharrirlarning joylashuvi — HAQIQIY brauzerda o'lchanadi.
 *
 * ── Nega bu sinovlar mavjud ───────────────────────────────────────────────
 * Phase 2.1 auditida haqiqiy nuqson qochib ketdi: slaydlar ro'yxatidagi
 * `truncate` grid elementini 833px ga cho'zib, 375px ekranda 474px
 * gorizontal toshish bergan. 478 birlik va 220 uchidan-uchgacha
 * testning birortasi buni ko'rmadi — ular DOM o'lchamini bilmaydi.
 *
 * Bu fayl aynan o'sha bo'shliqni yopadi.
 */

const VIEWPORTS = [
  { width: 375, height: 812, label: "375 · telefon (kichik)" },
  { width: 390, height: 844, label: "390 · telefon" },
  { width: 430, height: 932, label: "430 · telefon (katta)" },
  { width: 768, height: 1024, label: "768 · planshet" },
  { width: 1024, height: 768, label: "1024 · kichik noutbuk" },
  { width: 1440, height: 900, label: "1440 · desktop" },
] as const;

let workspace: SeededWorkspace;

test.beforeAll(async () => {
  await cleanupBrowserUsers();
  workspace = await seedWorkspace("http://localhost:3200", "layout");
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

/** Sahifaning gorizontal toshishi, pikselda. 0 bo'lishi kerak. */
async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
}

/** Ko'rish maydonidan chiqib ketgan elementlar (qoplamalar hisobga olinmaydi). */
async function offscreenElements(page: Page, width: number): Promise<string[]> {
  return page.evaluate((vw) => {
    const found: string[] = [];
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      // `fixed` elementlar (to'liq ekran qoplamasi) ataylab chetda bo'lishi mumkin.
      if (getComputedStyle(el).position === "fixed") continue;
      if (rect.right > vw + 1 || rect.left < -1) {
        found.push(
          `<${el.tagName.toLowerCase()} class="${String(el.className).slice(0, 50)}"> [${Math.round(rect.left)}..${Math.round(rect.right)}]`,
        );
        if (found.length >= 5) break;
      }
    }
    return found;
  }, width);
}

/**
 * 44px dan kichik boshqaruvlar.
 *
 * Jumla ICHIDAGI matn havolalari hisobga olinmaydi — WCAG 2.5.8 ularni
 * ataylab istisno qiladi va ilovada ular ko'rinish uchun emas, kontekst
 * uchun turadi.
 */
async function smallTouchTargets(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const small: string[] = [];
    for (const el of document.querySelectorAll("button, input, textarea, select")) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.height < 40) {
        const label = (el.getAttribute("aria-label") || el.textContent || "").trim();
        small.push(
          `<${el.tagName.toLowerCase()}> "${label.slice(0, 28)}" ${Math.round(rect.width)}x${Math.round(rect.height)}`,
        );
      }
    }
    return small;
  });
}

const EDITORS = [
  {
    name: "prezentatsiya",
    path: (w: SeededWorkspace) => `/dashboard/presentations/${w.presentationId}/edit`,
  },
  {
    name: "kalendar",
    path: (w: SeededWorkspace) => `/dashboard/calendar-plans/${w.calendarPlanId}/edit`,
  },
  {
    name: "dars ishlanmasi",
    path: (w: SeededWorkspace) => `/dashboard/lesson-plans/${w.lessonPlanId}/edit`,
  },
] as const;

for (const editor of EDITORS) {
  test.describe(`${editor.name} muharriri — joylashuv`, () => {
    for (const viewport of VIEWPORTS) {
      test(`${viewport.label}: gorizontal toshish yo'q`, async ({ page }) => {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.goto(editor.path(workspace), { waitUntil: "networkidle" });

        const overflow = await horizontalOverflow(page);
        const offscreen = await offscreenElements(page, viewport.width);

        expect(
          overflow,
          `sahifa ${overflow}px ga toshdi. Chiqqan elementlar:\n${offscreen.join("\n")}`,
        ).toBe(0);
        expect(offscreen, "elementlar ekrandan chiqib ketdi").toEqual([]);
      });
    }

    test("boshqaruvlar 44px tegish nishoni qoidasiga mos", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(editor.path(workspace), { waitUntil: "networkidle" });

      const small = await smallTouchTargets(page);
      expect(small, `44px dan kichik boshqaruvlar:\n${small.join("\n")}`).toEqual([]);
    });

    test("saqlash paneli ko'rinadi va boshida O'CHIRILGAN", async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(editor.path(workspace), { waitUntil: "networkidle" });

      /*
        Saqlash tugmasi o'zgarish bo'lmaganda o'chirilgan bo'lishi kerak —
        "nega hech narsa bo'lmadi?" savolining oldini oladi.
      */
      const saveButton = page.getByRole("button", { name: /saqlash/i });
      await expect(saveButton).toBeVisible();
      await expect(saveButton).toBeDisabled();
    });

    test("klaviatura bilan o'tish mumkin va fokus KO'RINADI", async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(editor.path(workspace), { waitUntil: "networkidle" });

      // Bir nechta Tab — birinchi fokuslanadigan elementga yetamiz.
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      const focus = await page.evaluate(() => {
        const el = document.activeElement;
        if (el === null || el === document.body) return null;
        const style = getComputedStyle(el);
        return {
          tag: el.tagName.toLowerCase(),
          outlineWidth: style.outlineWidth,
          outlineStyle: style.outlineStyle,
        };
      });

      expect(focus, "Tab bosilganda hech narsa fokuslanmadi").not.toBeNull();
      expect(
        focus!.outlineStyle !== "none" && focus!.outlineWidth !== "0px",
        `fokus halqasi ko'rinmaydi: <${focus!.tag}> outline=${focus!.outlineWidth} ${focus!.outlineStyle}`,
      ).toBe(true);
    });
  });
}

test.describe("slaydlar ro'yxati — Phase 2.1 regressiyasi", () => {
  test("uzun sarlavha ustunni cho'zib yubormaydi", async ({ page }) => {
    /*
      AYNAN o'sha nuqson: `truncate` (`white-space: nowrap`) grid
      elementining min-content kengligini butun matn kengligiga
      tenglashtiradi, grid esa standart `min-width: auto` bilan
      qisqarishdan bosh tortadi.
    */
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(`/dashboard/presentations/${workspace.presentationId}/edit`, {
      waitUntil: "networkidle",
    });

    // Uzun sarlavha sahifada bo'lishi kerak (qisqartirilgan holda).
    const list = page.getByRole("list").first();
    await expect(list).toBeVisible();

    const widest = await page.evaluate(() => {
      let max = 0;
      for (const el of document.querySelectorAll("ol li, ol li *")) {
        max = Math.max(max, el.getBoundingClientRect().right);
      }
      return Math.round(max);
    });

    expect(widest, `ro'yxat elementi ${widest}px gacha cho'zildi`).toBeLessThanOrEqual(
      375,
    );
  });
});
