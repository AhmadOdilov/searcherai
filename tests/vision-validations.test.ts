import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MAX_IMAGE_BYTES,
  detectImageType,
  visionAnalysisSchema,
  visionInputSchema,
} from "../lib/validations/vision";
import { buildVisionSystemPrompt, buildVisionUserPrompt } from "../lib/vision/prompt";

/**
 * Rasm tahlili — sxema, format aniqlash va prompt sinovlari.
 * Baza ham, AI ham kerak emas.
 */

/** Haqiqiy PNG sarlavhasi bilan boshlanadigan bayt ketma-ketligi. */
function pngBytes(size = 64): Buffer {
  const buffer = Buffer.alloc(size, 0);
  buffer.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return buffer;
}

/** Haqiqiy JPEG sarlavhasi. */
function jpegBytes(size = 64): Buffer {
  const buffer = Buffer.alloc(size, 0);
  buffer.set([0xff, 0xd8, 0xff, 0xe0], 0);
  return buffer;
}

function validAnalysis() {
  return {
    description:
      "Rasmda darslik sahifasi ko'rsatilgan: kasrlarni qo'shish qoidasi va ikkita yechilgan misol bor.",
    subject: "Matematika",
    grade: "7-sinf",
    topic: "Kasrlarni qo'shish",
    keyContent: ["Umumiy maxrajga keltirish qoidasi", "Ikkita yechilgan misol"],
    usable: true,
  };
}

describe("detectImageType — fayl IMZOSI bo'yicha", () => {
  it("PNG ni taniydi", () => {
    assert.equal(detectImageType(pngBytes()), "image/png");
  });

  it("JPEG ni taniydi", () => {
    assert.equal(detectImageType(jpegBytes()), "image/jpeg");
  });

  it("boshqa formatni RAD ETADI", () => {
    // PDF sarlavhasi ("%PDF") — rasm emas.
    const pdf = Buffer.from("%PDF-1.7\n...", "utf8");
    assert.equal(detectImageType(pdf), null);
  });

  it("bo'sh buferni rad etadi", () => {
    assert.equal(detectImageType(Buffer.alloc(0)), null);
  });

  it("YOLG'ON e'lon qilingan turga aldanmaydi", () => {
    /*
      Eng muhim sinov: so'rovda "image/png" deb yozib, ichida boshqa
      narsa yuborish mumkin. Imzo esa formatning O'ZIDA yashaydi va uni
      almashtirib bo'lmaydi — shuning uchun biz faqat unga ishonamiz.
    */
    const executable = Buffer.from([0x4d, 0x5a, 0x90, 0x00]); // "MZ" — .exe
    assert.equal(detectImageType(executable), null);
  });
});

describe("visionInputSchema", () => {
  it("to'g'ri kirishni qabul qiladi", () => {
    const result = visionInputSchema.safeParse({
      image: `data:image/png;base64,${pngBytes().toString("base64")}`,
      language: "UZ",
    });
    assert.equal(result.success, true);
  });

  it("fan va sinf IXTIYORIY", () => {
    const result = visionInputSchema.safeParse({
      image: `data:image/png;base64,${pngBytes().toString("base64")}`,
    });
    assert.equal(result.success, true);
    assert.equal(result.data?.subject, undefined);
  });

  it("bo'sh rasmni rad etadi", () => {
    const result = visionInputSchema.safeParse({ image: "" });
    assert.equal(result.success, false);
    assert.equal(result.error?.issues[0]?.message, "errors.validation.imageRequired");
  });

  it("juda uzun satrni DEKODLAMASDAN rad etadi", () => {
    /*
      Birinchi, arzon to'siq: 8 MB dan uzun satr hatto `Buffer.from`
      gacha yetib bormaydi. Busiz 100 MB lik satr dekodlanguncha
      xotirani egallardi.
    */
    const result = visionInputSchema.safeParse({ image: "x".repeat(9 * 1024 * 1024) });
    assert.equal(result.success, false);
    assert.equal(result.error?.issues[0]?.message, "errors.validation.imageTooLarge");
  });

  it("til ko'rsatilmasa o'zbekcha bo'ladi", () => {
    const result = visionInputSchema.parse({
      image: `data:image/png;base64,${pngBytes().toString("base64")}`,
    });
    assert.equal(result.language, "UZ");
  });
});

describe("visionAnalysisSchema", () => {
  it("to'liq tahlilni qabul qiladi", () => {
    assert.equal(visionAnalysisSchema.safeParse(validAnalysis()).success, true);
  });

  it("`usable: false` va sabab bilan ham to'g'ri", () => {
    const unusable = {
      ...validAnalysis(),
      usable: false,
      problem: "Rasm juda xira, matnni o'qib bo'lmadi.",
    };
    assert.equal(visionAnalysisSchema.safeParse(unusable).success, true);
  });

  it("asosiy ma'lumot 2 tadan kam bo'lsa rad etadi", () => {
    const poor = { ...validAnalysis(), keyContent: ["faqat bitta"] };
    assert.equal(visionAnalysisSchema.safeParse(poor).success, false);
  });

  it("`usable` MAJBURIY — model buni aytishi shart", () => {
    /*
      Bu maydonsiz model xira rasmdan ham ishonch bilan "dars mavzusi"
      o'ylab topardi va o'qituvchi shunga ishonib dars tayyorlardi.
    */
    const { usable: _usable, ...withoutUsable } = validAnalysis();
    assert.equal(visionAnalysisSchema.safeParse(withoutUsable).success, false);
  });

  it("xato xabarlari TABIIY MATN — tarjima kaliti emas", () => {
    // Ular modelga qayta so'rovda yuboriladi, foydalanuvchiga emas.
    const result = visionAnalysisSchema.safeParse({
      ...validAnalysis(),
      description: "qisqa",
    });
    assert.equal(result.success, false);
    const message = result.error?.issues[0]?.message ?? "";
    assert.ok(!message.startsWith("errors."), `kalit emas, matn kutilgan: ${message}`);
  });
});

describe("vision promptlari", () => {
  it("har bir til uchun O'Z tilida tizim prompti bor", () => {
    assert.match(buildVisionSystemPrompt("UZ"), /o'qituvchi/i);
    assert.match(buildVisionSystemPrompt("RU"), /[а-яА-Я]/);
    assert.match(buildVisionSystemPrompt("EN"), /teacher/i);
  });

  it("model 'o'ylab topma' deb ogohlantiriladi", () => {
    // Vision modellarining asosiy xavfi — rasmda yo'q narsani yozish.
    assert.match(buildVisionSystemPrompt("UZ"), /usable/);
    assert.match(buildVisionSystemPrompt("RU"), /usable/);
    assert.match(buildVisionSystemPrompt("EN"), /usable/);
  });

  it("faqat JSON so'raydi", () => {
    for (const language of ["UZ", "RU", "EN"] as const) {
      assert.match(buildVisionSystemPrompt(language), /JSON/);
    }
  });

  it("fan va sinf berilsa promptga tushadi", () => {
    const prompt = buildVisionUserPrompt({
      image: "data:image/png;base64,AAA",
      subject: "Biologiya",
      grade: "6-sinf",
      language: "UZ",
    });
    assert.ok(prompt.includes("Biologiya"));
    assert.ok(prompt.includes("6-sinf"));
  });

  it("berilmasa BO'SH qator qoldirmaydi", () => {
    const prompt = buildVisionUserPrompt({
      image: "data:image/png;base64,AAA",
      language: "UZ",
    });
    assert.ok(!prompt.includes("Fan:"));
  });

  it("rasmning O'ZI promptga qo'shilmaydi", () => {
    /*
      Rasm alohida kanal orqali (`images`) ketadi. Agar u promptga ham
      tushsa, so'rov ikki barobar katta bo'lar va tokenlar behuda
      sarflanardi.
    */
    const prompt = buildVisionUserPrompt({
      image: "data:image/png;base64,IMAGEDATA123",
      language: "UZ",
    });
    assert.ok(!prompt.includes("IMAGEDATA123"));
    assert.ok(!prompt.includes("base64"));
  });
});

describe("chegara qiymatlari", () => {
  it("5 MB chegarasi kutilgan qiymatda", () => {
    // Sinov chegarani "muzlatib" qo'yadi: kimdir uni beixtiyor
    // o'zgartirsa, sabab bilan birga ko'rinadi.
    assert.equal(MAX_IMAGE_BYTES, 5 * 1024 * 1024);
  });
});
