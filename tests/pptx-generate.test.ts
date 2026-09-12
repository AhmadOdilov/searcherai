import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generatePptx } from "../lib/pptx/generate";
import type { PresentationContent, Slide } from "../lib/validations/presentation";

/**
 * .pptx generatsiya qatlami sinovlari.
 *
 * Hech narsa mock qilinmaydi — bu qatlam AI'ga, bazaga va sessiyaga
 * bog'lanmagan, shuning uchun to'g'ridan-to'g'ri chaqiriladi.
 */

/** .pptx — bu ZIP arxiv, ya'ni "PK" signature bilan boshlanadi. */
function assertValidPptx(buffer: Buffer, context: string): void {
  assert.ok(Buffer.isBuffer(buffer), `${context}: Buffer qaytishi kerak`);
  assert.ok(buffer.length > 0, `${context}: bo'sh bo'lmasligi kerak`);
  assert.equal(
    buffer.subarray(0, 2).toString("ascii"),
    "PK",
    `${context}: ZIP (PK) signature bo'lishi kerak`,
  );
  // Haqiqiy .pptx odatda 20KB dan katta (shablon fayllari bilan).
  assert.ok(
    buffer.length > 10_000,
    `${context}: fayl juda kichik (${buffer.length} bayt) — to'liq emas`,
  );
}

function slide(overrides: Partial<Slide> = {}): Slide {
  return {
    type: "content",
    heading: "Slayd sarlavhasi",
    bullets: ["Birinchi band", "Ikkinchi band"],
    ...overrides,
  };
}

function content(overrides: Partial<PresentationContent> = {}): PresentationContent {
  return {
    title: "Kasrlarni qo'shish va ayirish",
    slides: [
      { type: "title", heading: "Kasrlarni qo'shish", bullets: ["Matematika · 7-sinf"] },
      slide({ heading: "Maqsad" }),
      slide({ heading: "Asosiy qoida" }),
      slide({ heading: "Misollar" }),
      slide({ heading: "Mashqlar" }),
      { type: "summary", heading: "Xulosa", bullets: ["Asosiy fikr"] },
    ],
    ...overrides,
  };
}

describe("generatePptx — asosiy holat", () => {
  it("haqiqiy .pptx Buffer qaytaradi", async () => {
    const result = await generatePptx(content());

    assertValidPptx(result.buffer, "asosiy holat");
    assert.equal(result.slideCount, 6);
  });

  it("uch slayd turini ham chizadi", async () => {
    const result = await generatePptx(
      content({
        slides: [
          { type: "title", heading: "Sarlavha slaydi", bullets: ["Ost sarlavha"] },
          { type: "content", heading: "Mazmun", bullets: ["Band"] },
          { type: "summary", heading: "Xulosa", bullets: ["Yakun"] },
        ],
      }),
    );

    assertValidPptx(result.buffer, "uch tur");
    assert.equal(result.slideCount, 3);
  });

  it("so'zlovchi izohlari bilan ishlaydi", async () => {
    const result = await generatePptx(
      content({
        slides: [
          {
            type: "title",
            heading: "Sarlavha",
            bullets: [],
            speakerNotes: "O'qituvchi uchun izoh: darsni savol bilan boshlang.",
          },
          slide({ speakerNotes: "Bu yerda doskada misol yozing." }),
          slide(),
        ],
      }),
    );

    assertValidPptx(result.buffer, "so'zlovchi izohlari");
  });
});

describe("generatePptx — chegara holatlari", () => {
  it("BO'SH bandlar massivi bilan xato bermaydi", async () => {
    const result = await generatePptx(
      content({
        slides: [
          { type: "title", heading: "Faqat sarlavha", bullets: [] },
          { type: "content", heading: "Bandsiz mazmun", bullets: [] },
          { type: "summary", heading: "Bandsiz xulosa", bullets: [] },
        ],
      }),
    );

    assertValidPptx(result.buffer, "bo'sh bandlar");
    assert.equal(result.slideCount, 3);
  });

  it("bandlar ichida BO'SH satrlar bo'lsa ularni tashlab ketadi", async () => {
    const result = await generatePptx(
      content({
        slides: [
          slide({ bullets: ["To'g'ri band", "   ", "Yana bittasi", ""] }),
          slide(),
          slide(),
        ],
      }),
    );

    assertValidPptx(result.buffer, "bo'sh satrlar");
  });

  it("JUDA UZUN matn bilan xato bermaydi (qisqartiradi)", async () => {
    const veryLongHeading = "Juda uzun sarlavha ".repeat(30);
    const veryLongBullet = "Juda uzun band matni ".repeat(80);

    const result = await generatePptx(
      content({
        title: veryLongHeading,
        slides: [
          { type: "title", heading: veryLongHeading, bullets: [veryLongBullet] },
          slide({ heading: veryLongHeading, bullets: [veryLongBullet, veryLongBullet] }),
          slide(),
        ],
      }),
    );

    assertValidPptx(result.buffer, "uzun matn");
  });

  it("o'zbek lotin va kirill harflari bilan ishlaydi", async () => {
    const result = await generatePptx(
      content({
        title: "Oʻzbek tili: gʻoya, oʻquvchi, ishoʻra",
        slides: [
          {
            type: "title",
            heading: "Oʻzbekcha: oʻ gʻ ʻ — va apostrof: o' g'",
            bullets: ["Fan: Ona tili", "Sinf: 7-sinf"],
          },
          slide({
            heading: "Русский текст",
            bullets: ["Первый пункт", "Второй пункт — с тире"],
          }),
          slide({
            heading: "Maxsus belgilar: & < > \" ' © → ✓ №",
            bullets: ["100% natija", "a < b > c", "«qo'shtirnoq»"],
          }),
        ],
      }),
    );

    assertValidPptx(result.buffer, "maxsus harflar");
  });

  it("emoji va yangi qatorlar bilan ham yiqilmaydi", async () => {
    const result = await generatePptx(
      content({
        slides: [
          slide({ heading: "Emoji 📚 ✏️", bullets: ["Band 🎯", "Ikki\nqatorli band"] }),
          slide(),
          slide(),
        ],
      }),
    );

    assertValidPptx(result.buffer, "emoji va yangi qator");
  });

  it("20 slayd berilsa MAX_SLIDES gacha kesadi, xato bermaydi", async () => {
    // Sxema 10 slaydga cheklaydi, LEKIN bu qatlam sxemadan mustaqil
    // ishlashi kerak — o'z himoyasi bo'lishi shart.
    const manySlides: Slide[] = Array.from({ length: 20 }, (_, index) =>
      slide({ heading: `Slayd ${index + 1}` }),
    );

    const result = await generatePptx(content({ slides: manySlides }));

    assertValidPptx(result.buffer, "20 slayd");
    assert.equal(result.slideCount, 10, "MAX_SLIDES (10) gacha kesilishi kerak");
  });

  it("bitta slaydda 8 dan ko'p band berilsa kesadi", async () => {
    const manyBullets = Array.from({ length: 20 }, (_, i) => `Band ${i + 1}`);

    const result = await generatePptx(
      content({
        slides: [slide({ bullets: manyBullets }), slide(), slide()],
      }),
    );

    assertValidPptx(result.buffer, "20 band");
  });

  it("slaydlar massivi BO'SH bo'lsa ham yaroqli fayl qaytaradi", async () => {
    // Bo'sh .pptx ni ba'zi dasturlar buzuq fayl deb hisoblaydi, shuning
    // uchun hech bo'lmasa bitta slayd bo'lishi kerak.
    const result = await generatePptx(content({ slides: [] }));

    assertValidPptx(result.buffer, "bo'sh slaydlar");
    assert.equal(result.slideCount, 1);
  });

  it("har xil kirish uchun har xil fayl chiqadi", async () => {
    const first = await generatePptx(content({ title: "Birinchi" }));
    const second = await generatePptx(
      content({
        title: "Ikkinchi",
        slides: [slide({ heading: "Butunlay boshqa" }), slide(), slide()],
      }),
    );

    assert.notEqual(
      first.buffer.length,
      second.buffer.length,
      "mazmun boshqacha bo'lsa fayl ham boshqacha bo'lishi kerak",
    );
  });
});
