import { expect, test, type Page } from "@playwright/test";
import {
  cleanupBrowserUsers,
  disconnectSeed,
  seedWorkspace,
  type SeededWorkspace,
} from "./helpers/seed";

/**
 * Saqlanmagan o'zgarishlar — ILOVA ICHIDAGI o'tishlar.
 *
 * ── Nega bu fayl bor ──────────────────────────────────────────────────────
 * Phase 4 auditi ochiq qoldirgan yagona nuqson aynan shu edi:
 * `beforeunload` faqat sahifani yopish/yangilashni ushlaydi, ilova
 * ichidagi o'tish esa (sarlavhadagi nom, sozlamalar, chiqish tugmasi)
 * qoralamani JIMGINA yo'qotardi.
 *
 * Node testlari buni ko'ra olmaydi: u yerda `<Link>` ham, klient
 * navigatsiyasi ham yo'q. Shuning uchun tekshiruv AYNAN brauzerda.
 *
 * ── Qamrab olinmagani ─────────────────────────────────────────────────────
 * Brauzerning "orqaga" tugmasi ataylab tekshirilmaydi — u qo'riqchi
 * qamrovidan tashqarida (sabab: lib/hooks/use-unsaved-guard.tsx).
 * Ishlamaydigan xatti-harakatni "kutilgan" deb yozib qo'yish soxta
 * ishonch bo'lardi.
 */

let workspace: SeededWorkspace;

test.beforeAll(async () => {
  await cleanupBrowserUsers();
  workspace = await seedWorkspace("http://localhost:3200", "navguard");
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

/** Muharrirni ochadi va sarlavha maydonini qaytaradi. */
async function openEditor(page: Page) {
  await page.goto(`/dashboard/presentations/${workspace.presentationId}/edit`, {
    waitUntil: "networkidle",
  });
  return page.locator("#presentation-title");
}

/*
  Har chaqiruvda BOSHQA sarlavha.

  Sabab: «saqlab chiqish» sinovi tahrirni bazaga yozadi. Keyingi sinov
  o'sha matnni qaytadan yozsa, qoralama o'zgarmagan bo'lib qolardi va
  "saqlanmagan o'zgarish" umuman paydo bo'lmasdi — ya'ni sinov o'zi
  tekshirmoqchi bo'lgan holatni yarata olmasdi.
*/
let titleCounter = 0;

/** Qoralamani o'zgartiradi — shundan keyin `dirty` bo'ladi. */
async function makeDirty(page: Page): Promise<string> {
  const value = `O'zgartirilgan sarlavha ${++titleCounter}`;
  const title = await openEditor(page);
  await title.fill(value);
  // Saqlash tugmasi yonishi — o'zgarish ro'yxatga olinganining dalili.
  await expect(page.getByRole("button", { name: /saqlash/i })).toBeEnabled();
  return value;
}

const dialog = (page: Page) => page.getByRole("dialog");

test.describe("saqlanmagan o'zgarish — ogohlantirish CHIQADI", () => {
  test("sarlavhadagi nom bosilganda", async ({ page }) => {
    await makeDirty(page);

    await page
      .getByRole("banner")
      .getByRole("link", { name: /searcher/i })
      .click();

    await expect(dialog(page)).toBeVisible();
    // Eng muhimi: o'tish BAJARILMAGAN.
    await expect(page).toHaveURL(/\/edit$/);
  });

  test("sozlamalar havolasi bosilganda", async ({ page }) => {
    await makeDirty(page);

    await page.getByRole("banner").getByRole("link", { name: "Sozlamalar" }).click();

    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/edit$/);
  });

  test("chiqish tugmasi bosilganda", async ({ page }) => {
    await makeDirty(page);

    await page
      .getByRole("banner")
      .getByRole("button", { name: "Chiqish", exact: true })
      .click();

    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/edit$/);
  });

  test("muharrirning o'z «orqaga» tugmasi bosilganda", async ({ page }) => {
    await makeDirty(page);

    await page.getByRole("button", { name: /prezentatsiyaga qaytish/i }).click();

    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/edit$/);
  });

  test("muharrir ichidagi havola bosilganda", async ({ page }) => {
    await makeDirty(page);

    await page.getByRole("link", { name: /prezentatsiyaga qaytish/i }).click();

    await expect(dialog(page)).toBeVisible();
    await expect(page).toHaveURL(/\/edit$/);
  });
});

test("toza qoralamada o'tish BITTA tarix yozuvi qo'shadi", async ({ page }) => {
  /*
    Qo'riqchi havolaga `onNavigate` orqali ulanadi. Toza holatda u
    o'tishga ARALASHMASLIGI kerak: `router.push` ni o'zi ham chaqirsa,
    bitta bosishga ikkita o'tish to'g'ri kelardi va "orqaga" tugmasi
    ikki marta bosishni talab qilardi.
  */
  await openEditor(page);
  const before = await page.evaluate(() => history.length);

  await page
    .getByRole("banner")
    .getByRole("link", { name: /searcher/i })
    .click();
  await expect(page).toHaveURL(/\/dashboard$/);

  const after = await page.evaluate(() => history.length);
  expect(after - before, `tarixga ${after - before} ta yozuv qo'shildi`).toBe(1);
});

test.describe("tasdiq oynasining tugmalari", () => {
  test("«shu yerda qolish» — sahifa o'zgarmaydi va qoralama saqlanadi", async ({
    page,
  }) => {
    const value = await makeDirty(page);
    await page
      .getByRole("banner")
      .getByRole("link", { name: /searcher/i })
      .click();

    await dialog(page)
      .getByRole("button", { name: /shu yerda qolish/i })
      .click();

    await expect(dialog(page)).toBeHidden();
    await expect(page).toHaveURL(/\/edit$/);
    // Tahrir JOYIDA — "qolish" ishni yo'qotmasligi kerak.
    await expect(page.locator("#presentation-title")).toHaveValue(value);
  });

  test("«saqlamasdan chiqish» — o'tish bajariladi", async ({ page }) => {
    await makeDirty(page);
    await page
      .getByRole("banner")
      .getByRole("link", { name: /searcher/i })
      .click();

    await dialog(page)
      .getByRole("button", { name: /saqlamasdan chiqish/i })
      .click();

    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("«saqlab chiqish» — avval saqlaydi, keyin o'tadi", async ({ page }) => {
    const value = await makeDirty(page);
    await page
      .getByRole("banner")
      .getByRole("link", { name: /searcher/i })
      .click();

    await dialog(page)
      .getByRole("button", { name: /saqlab chiqish/i })
      .click();

    await expect(page).toHaveURL(/\/dashboard$/);

    // Saqlangani HAQIQATDAN tekshiriladi: muharrirga qaytamiz.
    await openEditor(page);
    await expect(page.locator("#presentation-title")).toHaveValue(value);
  });
});

test.describe("ogohlantirish CHIQMAYDI", () => {
  test("o'zgarish yo'q bo'lsa o'tish darhol bajariladi", async ({ page }) => {
    await openEditor(page);

    await page
      .getByRole("banner")
      .getByRole("link", { name: /searcher/i })
      .click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(dialog(page)).toBeHidden();
  });

  test("SAQLAGANDAN keyin ogohlantirish qolmaydi", async ({ page }) => {
    await makeDirty(page);

    await page.getByRole("button", { name: /saqlash/i }).click();
    await expect(page.getByText(/^Saqlandi$/)).toBeVisible();

    await page
      .getByRole("banner")
      .getByRole("link", { name: /searcher/i })
      .click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(dialog(page)).toBeHidden();
  });

  test("muharrirdan chiqqandan keyin boshqa sahifada ogohlantirish yo'q", async ({
    page,
  }) => {
    await makeDirty(page);
    await page
      .getByRole("banner")
      .getByRole("link", { name: /searcher/i })
      .click();
    await dialog(page)
      .getByRole("button", { name: /saqlamasdan chiqish/i })
      .click();
    await expect(page).toHaveURL(/\/dashboard$/);

    /*
      Qo'riqchi belgisi muharrir bilan birga TOZALANISHI kerak.
      Aks holda foydalanuvchi butun ilova bo'ylab ogohlantirish
      olaverardi — nuqsonning eng bezovta qiladigan ko'rinishi.
    */
    await page.getByRole("banner").getByRole("link", { name: "Sozlamalar" }).click();

    await expect(page).toHaveURL(/\/dashboard\/settings$/);
    await expect(dialog(page)).toBeHidden();
  });
});

test("brauzer darajasidagi ogohlantirish (`beforeunload`) saqlanib qoladi", async ({
  page,
}) => {
  await makeDirty(page);

  /*
    Playwright `beforeunload` oynasini avtomatik rad etadi, ya'ni
    "chiqdimi yoki yo'qmi" deb tekshirib bo'lmaydi. Lekin hodisaning
    O'ZI ro'yxatga olinganini tekshirish mumkin: `preventDefault()`
    chaqirilgan bo'lsa, hodisa bekor qilingan hisoblanadi.

    Bu aynan brauzer ogohlantirishini chiqaradigan shart.
  */
  const cancelled = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });

  expect(cancelled, "saqlanmagan o'zgarishda beforeunload bekor qilinishi kerak").toBe(
    true,
  );
});

/*
  ── Tasdiq oynasining o'zi ham tekshiriladi ───────────────────────────────
  U YANGI interfeys bo'lagi va u boshqa qoidalarga bo'ysunmaydi degan
  sabab yo'q: telefonda toshmasligi, tugmalari barmoq bilan tegiladigan
  bo'lishi va klaviatura bilan boshqarilishi kerak.

  Muharrir joylashuvi `layout.spec.ts` da o'lchanadi, lekin u oynani
  UMUMAN ochmaydi — ya'ni bu yerdagi tekshiruvni qoplamaydi.
*/
const VIEWPORTS = [
  { width: 375, height: 812, label: "375 · telefon (kichik)" },
  { width: 390, height: 844, label: "390 · telefon" },
  { width: 430, height: 932, label: "430 · telefon (katta)" },
  { width: 768, height: 1024, label: "768 · planshet" },
  { width: 1024, height: 768, label: "1024 · kichik noutbuk" },
  { width: 1440, height: 900, label: "1440 · desktop" },
] as const;

test.describe("tasdiq oynasi — joylashuv va tegish nishonlari", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.label}: toshish yo'q, tugmalar 44px`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await makeDirty(page);
      await page
        .getByRole("banner")
        .getByRole("link", { name: /searcher/i })
        .click();

      await expect(dialog(page)).toBeVisible();

      const overflow = await page.evaluate(() => {
        const doc = document.documentElement;
        return doc.scrollWidth - doc.clientWidth;
      });
      expect(overflow, `gorizontal toshish: ${overflow}px`).toBe(0);

      const small = await dialog(page).evaluate((root) => {
        const tooSmall: string[] = [];
        for (const el of root.querySelectorAll("button")) {
          const rect = el.getBoundingClientRect();
          if (rect.height < 40) {
            tooSmall.push(
              `"${(el.textContent ?? "").trim()}" ${Math.round(rect.height)}px`,
            );
          }
        }
        return tooSmall;
      });
      expect(small, `kichik tugmalar: ${small.join(", ")}`).toEqual([]);
    });
  }

  test("ochilganda FOKUS oynaga ko'chadi va ESC uni yopadi", async ({ page }) => {
    await makeDirty(page);
    await page
      .getByRole("banner")
      .getByRole("link", { name: /searcher/i })
      .click();

    await expect(dialog(page)).toBeVisible();

    /*
      Fokus ortidagi sahifada qolsa, klaviatura bilan ishlaydigan
      foydalanuvchi oynani umuman topa olmasdi.
    */
    const focusInsideDialog = await page.evaluate(() => {
      const panel = document.querySelector('[role="dialog"]');
      return panel !== null && panel.contains(document.activeElement);
    });
    expect(focusInsideDialog, "fokus oyna ichida bo'lishi kerak").toBe(true);

    // ESC — eng xavfsiz tanlov: hech narsa yo'qolmaydi.
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toBeHidden();
    await expect(page).toHaveURL(/\/edit$/);
  });
});
