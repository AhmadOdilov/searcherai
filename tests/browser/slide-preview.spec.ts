import { expect, test, type Page } from "@playwright/test";
import {
  cleanupBrowserUsers,
  disconnectSeed,
  seedWorkspace,
  type SeededWorkspace,
} from "./helpers/seed";

/**
 * KO'RISH REJIMI V6 BLOKLARINI CHIZADIMI.
 *
 * ── Nega bu sinov bor ─────────────────────────────────────────────────────
 * Ko'rish rejimi slaydning atigi ikkita maydonini bilardi: `heading` va
 * `bullets`. `.pptx` renderer esa o'n beshtasini chizardi. Ya'ni kartali,
 * bosqichli, taqqoslashli, statistikali yoki iqtibosli slayd EKRANDA
 * BO'SH ko'rinar, yuklab olingan faylda esa to'la chiqardi.
 *
 * Buni hech bir sinov tutmagan edi, chunki brauzer seed'i faqat bandli
 * slaydlar yaratardi — ya'ni sinovlar nuqsonli yo'ldan hech qachon
 * yurmagan. Endi seed V6 bloklarini ham beradi.
 *
 * ── Qamrov taqsimoti ──────────────────────────────────────────────────────
 * Blok modeli va uning `.pptx` bilan mosligi birlik darajasida
 * tekshiriladi (`tests/preview-parity.test.ts`, ikkala yo'nalishda).
 * Bu yerdagi savol boshqacha va faqat brauzerda javob beriladi:
 * blok HAQIQATAN DOM'ga chiqdimi va ko'rinadimi.
 */

let workspace: SeededWorkspace;

test.beforeAll(async () => {
  await cleanupBrowserUsers();
  workspace = await seedWorkspace("http://localhost:3200", "preview");
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

/** Muharrirni ochib, ko'rish rejimini ishga tushiradi. */
async function openPreview(page: Page): Promise<void> {
  await page.goto(`/dashboard/presentations/${workspace.presentationId}/edit`, {
    waitUntil: "domcontentloaded",
  });
  await page.getByRole("button", { name: "Ko'rish" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
}

/** Ko'rish rejimida marker matni chiqquncha oldinga suradi. */
async function findSlideWith(page: Page, marker: string): Promise<void> {
  const dialog = page.getByRole("dialog");
  const next = page.getByRole("button", { name: "Keyingi slayd" });

  // Seed'da 24 ko'rinadigan slayd bor — chegara ataylab undan biroz katta.
  for (let step = 0; step < 30; step++) {
    if (await dialog.getByText(marker, { exact: false }).count()) return;
    if (await next.isDisabled()) break;
    await next.click();
  }

  throw new Error(`"${marker}" ko'rish rejimida topilmadi`);
}

test.describe("ko'rish rejimi — V6 bloklari ekranda", () => {
  /*
    Har bir blok turi uchun alohida sinov EMAS, bitta yurish: ko'rish
    rejimi slaydlarni ketma-ket ko'rsatadi va har bir markerni o'z
    o'rnida topamiz. Bu brauzer sinovini tez saqlaydi.
  */
  test("kartalar, bosqichlar, taqqoslash, statistika va iqtibos ko'rinadi", async ({
    page,
  }) => {
    await openPreview(page);
    const dialog = page.getByRole("dialog");

    // ── Kartalar ────────────────────────────────────────────────────
    await findSlideWith(page, "KARTA-ALFA");
    await expect(dialog.getByText("KARTA-BETA")).toBeVisible();
    await expect(dialog.getByText("KARTA-GAMMA")).toBeVisible();
    await expect(dialog.getByText("Karta tavsifi alfa")).toBeVisible();
    // Yorliq va manba ham chiziladi.
    await expect(dialog.getByText("YORLIQ-ALFA")).toBeVisible();
    await expect(dialog.getByText("MANBA-ALFA")).toBeVisible();

    // ── Bosqichlar ──────────────────────────────────────────────────
    await findSlideWith(page, "BOSQICH-ALFA");
    await expect(dialog.getByText("BOSQICH-BETA")).toBeVisible();
    await expect(dialog.getByText("Bosqich tavsifi gamma")).toBeVisible();

    // ── Taqqoslash ──────────────────────────────────────────────────
    await findSlideWith(page, "CHAP-USTUN");
    await expect(dialog.getByText("ONG-USTUN")).toBeVisible();
    await expect(dialog.getByText("CHAP-BETA")).toBeVisible();
    await expect(dialog.getByText("ONG-ALFA")).toBeVisible();

    // ── Statistika ──────────────────────────────────────────────────
    await findSlideWith(page, "STATISTIKA-IZOHI");
    await expect(dialog.getByText("78%")).toBeVisible();

    // ── Iqtibos ─────────────────────────────────────────────────────
    await findSlideWith(page, "IQTIBOS-MATNI");
    await expect(dialog.getByText("IQTIBOS-MUALLIFI")).toBeVisible();
  });

  test("bandli slaydlar avvalgidek ishlaydi", async ({ page }) => {
    await openPreview(page);
    const dialog = page.getByRole("dialog");

    // Muqova — birinchi slayd.
    await expect(dialog.getByText("Slayd 1")).toBeVisible();

    await findSlideWith(page, "Qisqa band");
  });

  test("slayd maydoni 16:9 nisbatda va toshmaydi", async ({ page }) => {
    /*
      Nisbat `.pptx` bilan bir xil bo'lishi kerak: bu yerda sig'magan
      matn faylda ham sig'maydi. Kartali slayd eng zich holat.
    */
    await openPreview(page);
    await findSlideWith(page, "KARTA-ALFA");

    const canvas = page.getByRole("dialog").locator("div.aspect-video").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("slayd maydoni topilmadi");

    expect(box.width / box.height).toBeGreaterThan(1.7);
    expect(box.width / box.height).toBeLessThan(1.8);

    // Gorizontal toshish yo'q.
    const overflow = await canvas.evaluate((node) => node.scrollWidth - node.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe("muharrir — V6 bloklari tahrirlanadi", () => {
  /*
    ── Nega bu sinov bor ───────────────────────────────────────────────────
    Muharrir uchta maydonni tahrirlardi: sarlavha, bandlar, so'zlovchi
    izohi. AI yozgan kartani, bosqichni yoki iqtibosni o'qituvchi TUZATA
    OLMASDI — yagona yo'l butun slaydni qaytadan yaratish edi, ya'ni
    yana AI chaqiruvi va yana pul.

    Ma'lumot yo'qolmasdi (forma `...slide` ni tarqatadi), lekin
    ko'rinmasdi ham — shuning uchun hech bir sinov buni sezmagan.
  */
  test("karta sarlavhasi tahrirlanadi va SAQLANADI", async ({ page }) => {
    await page.goto(`/dashboard/presentations/${workspace.presentationId}/edit`, {
      waitUntil: "domcontentloaded",
    });

    // Kartali slaydni ro'yxatdan tanlaymiz.
    await page
      .getByRole("button", { name: /Kartalar slaydi/ })
      .first()
      .click();

    const cardTitle = page.getByLabel("Karta sarlavhasi").first();
    await expect(cardTitle).toBeVisible();
    await expect(cardTitle).toHaveValue("KARTA-ALFA");

    await cardTitle.fill("KARTA-TAHRIRLANGAN");

    const save = page.getByRole("button", { name: /saqlash/i });
    await expect(save).toBeEnabled();

    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes(`/api/presentations/${workspace.presentationId}`) &&
          res.request().method() === "PATCH",
      ),
      save.click(),
    ]);
    expect(response.status()).toBe(200);

    // Yozuvda haqiqatan o'zgardimi — javobning o'zidan tekshiramiz.
    const body = (await response.json()) as {
      data: {
        presentation: { content: { slides: Array<{ cards?: { title: string }[] }> } };
      };
    };
    const titles = body.data.presentation.content.slides
      .flatMap((slide) => slide.cards ?? [])
      .map((card) => card.title);

    expect(titles).toContain("KARTA-TAHRIRLANGAN");
    expect(titles).not.toContain("KARTA-ALFA");
  });

  test("bosqich, iqtibos va statistika maydonlari ko'rinadi", async ({ page }) => {
    await page.goto(`/dashboard/presentations/${workspace.presentationId}/edit`, {
      waitUntil: "domcontentloaded",
    });

    await page
      .getByRole("button", { name: /Bosqichlar slaydi/ })
      .first()
      .click();
    await expect(page.getByLabel("Bosqich nomi").first()).toHaveValue("BOSQICH-ALFA");

    await page
      .getByRole("button", { name: /Iqtibos slaydi/ })
      .first()
      .click();
    await expect(page.getByLabel("Iqtibos muallifi")).toHaveValue("IQTIBOS-MUALLIFI");

    await page
      .getByRole("button", { name: /Statistika slaydi/ })
      .first()
      .click();
    await expect(page.getByLabel("Raqam izohi")).toHaveValue("STATISTIKA-IZOHI");
  });
});
