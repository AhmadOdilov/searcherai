import assert from "node:assert/strict";
import { describe, it } from "node:test";
import JSZip from "jszip";
import { bulletFontSize, generatePptx } from "../lib/pptx/generate";
import { FONT } from "../lib/pptx/theme";
import {
  EDIT_MAX_SLIDES,
  type PresentationContent,
  type Slide,
} from "../lib/validations/presentation";

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

  it("TAHRIRLANGAN 20 slayd to'liq chiqadi", async () => {
    /*
      Ilgari bu yerda chegara 10 edi (AI javobi uchun). Tahrirlash
      qo'shilgach u noto'g'ri bo'lib qoldi: 14 slaydli ochiq dars
      tayyorlagan o'qituvchining oxirgi to'rtta slaydi JIM yo'qolardi.
    */
    const manySlides: Slide[] = Array.from({ length: 20 }, (_, index) =>
      slide({ heading: `Slayd ${index + 1}` }),
    );

    const result = await generatePptx(content({ slides: manySlides }));

    assertValidPptx(result.buffer, "20 slayd");
    assert.equal(result.slideCount, 20, "tahrirlangan slaydlar to'liq chiqishi kerak");
  });

  it(`${EDIT_MAX_SLIDES} dan ko'p slayd berilsa kesadi, xato bermaydi`, async () => {
    // Bu qatlam sxemadan MUSTAQIL ishlashi va o'z himoyasiga ega
    // bo'lishi kerak — juda katta fayl yasalmasin.
    const tooMany: Slide[] = Array.from({ length: EDIT_MAX_SLIDES + 5 }, (_, index) =>
      slide({ heading: `Slayd ${index + 1}` }),
    );

    const result = await generatePptx(content({ slides: tooMany }));

    assertValidPptx(result.buffer, "chegaradan ko'p slayd");
    assert.equal(result.slideCount, EDIT_MAX_SLIDES);
  });

  it("YASHIRILGAN slayd faylga tushmaydi", async () => {
    const mixed: Slide[] = [
      slide({ heading: "Ko'rinadi 1" }),
      { ...slide({ heading: "Yashirilgan" }), hidden: true },
      slide({ heading: "Ko'rinadi 2" }),
    ];

    const result = await generatePptx(content({ slides: mixed }));

    assertValidPptx(result.buffer, "yashirilgan slayd");
    assert.equal(result.slideCount, 2, "yashirilgan slayd faylga tushib qoldi");
  });

  it("HAMMA slayd yashirilgan bo'lsa ham yaroqli fayl chiqadi", async () => {
    /*
      Bo'sh .pptx ni ba'zi dasturlar buzuq fayl deb hisoblaydi.
      Generator bunday holatda sarlavha slaydini o'zi qo'shadi.
    */
    const allHidden: Slide[] = [
      { ...slide({ heading: "Bir" }), hidden: true },
      { ...slide({ heading: "Ikki" }), hidden: true },
    ];

    const result = await generatePptx(content({ title: "Zaxira", slides: allHidden }));

    assertValidPptx(result.buffer, "hammasi yashirilgan");
    assert.equal(result.slideCount, 1, "zaxira sarlavha slaydi qo'shilishi kerak");
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

/**
 * Slaydning XML'ini ochib beradi.
 *
 * .pptx — ZIP arxiv, har slayd `ppt/slides/slideN.xml` da. Rang va
 * shrift o'lchami aynan shu yerda yozilgan, ya'ni ularni tekshirishning
 * yagona yo'li — faylni ochish. `jszip` pptxgenjs bilan birga keladi
 * (u ham .pptx ni shu kutubxona bilan yig'adi).
 */
async function slideXml(buffer: Buffer, index: number): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file(`ppt/slides/slide${index}.xml`);
  assert.ok(file, `slide${index}.xml topilmadi`);
  return file.async("string");
}

/** XML'dagi barcha ranglar (RGB) — tartibi bilan. */
function colorsIn(xml: string): string[] {
  return [...xml.matchAll(/srgbClr val="([0-9A-F]{6})"/g)].map((match) => match[1]);
}

/**
 * XML'dagi matn bo'laklari — XML belgilari ochilgan holda.
 *
 * Apostrof `&apos;` ga aylanadi (XML qoidasi), shuning uchun matnni
 * XML'dan to'g'ridan-to'g'ri qidirib bo'lmaydi.
 */
function textsIn(xml: string): string[] {
  return [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((match) =>
    match[1]
      .replaceAll("&apos;", "'")
      .replaceAll("&quot;", '"')
      .replaceAll("&lt;", "<")
      .replaceAll("&gt;", ">")
      .replaceAll("&amp;", "&"),
  );
}

/** XML'dagi barcha shrift o'lchamlari — pptx ularni yuzdan bir birlikda yozadi. */
function fontSizesIn(xml: string): number[] {
  return [...xml.matchAll(/sz="(\d+)"/g)].map((match) => Number(match[1]) / 100);
}

describe("generatePptx — shablonlar", () => {
  it("«klassik» — oq fon, zumrad sarlavha", async () => {
    const { buffer } = await generatePptx(content(), "klassik");

    const title = await slideXml(buffer, 1);
    const body = await slideXml(buffer, 2);

    assert.match(title, /<a:srgbClr val="FFFFFF"\/>/, "sarlavha slaydi oq bo'lsin");
    assert.ok(colorsIn(body).includes("0F766E"), "sarlavha zumrad rangda bo'lsin");
  });

  it("«zamonaviy» — to'q fon, och matn", async () => {
    const { buffer } = await generatePptx(content(), "zamonaviy");

    const title = await slideXml(buffer, 1);
    const body = await slideXml(buffer, 2);

    // Fon — birinchi rang (`<p:bg>` slaydning boshida turadi).
    assert.equal(colorsIn(title)[0], "1C1A17", "sarlavha slaydi to'q bo'lsin");
    assert.equal(colorsIn(body)[0], "1C1A17", "mazmun slaydi ham to'q bo'lsin");
    assert.ok(colorsIn(body).includes("FFFFFF"), "sarlavha och rangda bo'lsin");
  });

  it("«rangli» — to'ldirilgan sarlavha slaydi va aksent tasma", async () => {
    const { buffer } = await generatePptx(content(), "rangli");

    const title = await slideXml(buffer, 1);
    const body = await slideXml(buffer, 2);

    assert.equal(colorsIn(title)[0], "0F766E", "sarlavha slaydi zumrad bo'lsin");
    // Tasma — to'rtburchak shakl; u faqat shu shablonda bor.
    assert.match(body, /prstGeom prst="rect"/, "aksent tasma yo'q");
  });

  it("shablonlar HAQIQATAN bir-biridan farq qiladi", async () => {
    /*
      Eng oddiy, lekin eng muhim tekshiruv: tanlov haqiqiy bo'lsin.
      Shablon parametri e'tiborsiz qolsa, uchala fayl bir xil chiqardi
      va foydalanuvchi buni faqat yuklab olib bilardi.
    */
    const [klassik, zamonaviy, rangli] = await Promise.all(
      ["klassik", "zamonaviy", "rangli"].map(async (template) =>
        slideXml((await generatePptx(content(), template)).buffer, 2),
      ),
    );

    assert.notEqual(klassik, zamonaviy);
    assert.notEqual(klassik, rangli);
    assert.notEqual(zamonaviy, rangli);
  });

  it("NOTANISH shablon nomi bilan yiqilmaydi — standartga tushadi", async () => {
    // Eski sahifadan yoki eski yozuvdan kelgan nom butun generatsiyani
    // buzmasligi kerak.
    const unknown = await generatePptx(content(), "yo-q-shablon");
    const fallback = await generatePptx(content(), "klassik");

    assertValidPptx(unknown.buffer, "notanish shablon");
    assert.equal(await slideXml(unknown.buffer, 1), await slideXml(fallback.buffer, 1));
  });

  it("shablon berilmasa ham ishlaydi", async () => {
    const result = await generatePptx(content());
    assertValidPptx(result.buffer, "shablonsiz");
  });
});

describe("generatePptx — matn slaydga sig'ishi", () => {
  it("qisqa bandlar KATTA shriftda yoziladi", async () => {
    const { buffer } = await generatePptx(
      content({
        slides: [slide({ heading: "Maqsad", bullets: ["Qisqa band", "Yana bitta"] })],
      }),
    );

    const sizes = fontSizesIn(await slideXml(buffer, 1));
    assert.ok(
      sizes.includes(FONT.bulletSize),
      `kutilgan ${FONT.bulletSize}pt, topilgan: ${sizes.join(", ")}`,
    );
  });

  it("KO'P va UZUN bandlar uchun shrift kichrayadi", async () => {
    /*
      Nega `shrinkText` yetarli emas: u PowerPoint ochilganda hisoblanadi,
      LibreOffice va telefondagi ko'ruvchilar esa uni e'tiborsiz
      qoldiradi — o'sha yerda matn slayddan chiqib ketardi. Shuning
      uchun o'lcham FAYLGA yoziladi.
    */
    const long =
      "Bu band ataylab uzun yozilgan: u bitta qatorga sig'maydi va slaydda " +
      "kamida ikki qator egallaydi, ya'ni sakkiztasi birga o'n oltita qator.";
    const { buffer } = await generatePptx(
      content({
        slides: [slide({ heading: "Ko'p matn", bullets: Array(8).fill(long) })],
      }),
    );

    const sizes = fontSizesIn(await slideXml(buffer, 1));
    assert.ok(
      sizes.includes(FONT.bulletSizeTight),
      `kutilgan ${FONT.bulletSizeTight}pt, topilgan: ${sizes.join(", ")}`,
    );
    assert.ok(!sizes.includes(FONT.bulletSize), "katta shrift qolib ketgan");
  });

  it("bulletFontSize — matn ko'paygani sari o'lcham kamayadi", async () => {
    const small = bulletFontSize(["Qisqa", "Band"]);
    const medium = bulletFontSize(
      Array(7).fill("O'rtacha uzunlikdagi band matni — bir qatorga sig'adi"),
    );
    const large = bulletFontSize(Array(8).fill("Juda uzun band matni ".repeat(5)));

    assert.equal(small, FONT.bulletSize);
    assert.ok(medium < small, "o'rtacha hajmda shrift kichraysin");
    assert.ok(large < medium, "katta hajmda yanada kichraysin");
    assert.equal(large, FONT.bulletSizeTight);
  });

  it("o'zbek va rus harflari faylda TO'LIQ saqlanadi", async () => {
    /*
      Ilgari faqat "yiqilmaydi" tekshirilardi. Lekin asosiy xavf
      boshqacha: harf faylga tushadi, lekin kesilgan yoki buzilgan
      holda. Shuning uchun matn XML'dan qidiriladi.
    */
    const uzbek = "Oʻsimliklar gʻoyasi: o'simlik va g'oya";
    const russian = "Предложение с буквами ё, ъ и щ";

    const { buffer } = await generatePptx(
      content({
        slides: [slide({ heading: uzbek, bullets: [russian, "Sonlar: 1, 2, 3"] })],
      }),
    );

    const texts = textsIn(await slideXml(buffer, 1));
    assert.ok(texts.includes(uzbek), `o'zbek sarlavhasi buzilgan: ${texts.join(" | ")}`);
    assert.ok(texts.includes(russian), `ruscha band buzilgan: ${texts.join(" | ")}`);
  });
});
