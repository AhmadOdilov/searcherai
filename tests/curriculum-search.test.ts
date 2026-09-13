import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchTerms } from "../lib/curriculum/terms";
import { formatCurriculumContext as formatForLessonPlan } from "../lib/lesson-plans/prompt";
import { formatCurriculumContext as formatForCalendarPlan } from "../lib/calendar-plans/prompt";

/**
 * O'quv dasturi qidiruvi va kontekst yig'ish sinovlari.
 * Baza kerak emas — bu yerda faqat sof funksiyalar.
 */

function topic(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    topicName: "ODDIY KASRLAR",
    description: "Kasr tushunchasi. Kasrlarni taqqoslash. Qo'shish va ayirish.",
    expectedHours: 29,
    expectedOutcomes: ["kasrlarni taqqoslay oladi", "umumiy maxrajga keltira oladi"],
    source: "https://uzbmb.uz/...",
    ...overrides,
  } as {
    topicName: string;
    description: string;
    expectedHours: number | null;
    expectedOutcomes: string[];
    source: string;
  };
}

describe("searchTerms — qidiruv so'zlarini ajratish", () => {
  it("mavzudan ma'noli so'zlarni ajratadi", () => {
    const terms = searchTerms("Kasrlarni qo'shish va ayirish");
    assert.ok(terms.length > 0);
    // "va" — bog'lovchi, qidiruvga kirmasligi kerak.
    assert.ok(!terms.includes("va"));
  });

  it("qisqa so'zlarni tashlab ketadi", () => {
    // 4 belgidan qisqa so'z deyarli har qatorga tushadi va qidiruvni
    // ma'nosiz qiladi.
    const terms = searchTerms("Son va shu");
    assert.deepEqual(terms, []);
  });

  it("qo'shimchali shakl bilan O'ZAK shaklini bir joyga keltiradi", () => {
    /*
      Eng muhim holat: o'qituvchi "kasrlarni" deb yozadi, dasturda esa
      "KASRLAR" turadi. So'zning boshi olinsa, ikkalasi ham topiladi.
    */
    const withSuffix = searchTerms("kasrlarni qo'shish");
    const withoutSuffix = searchTerms("kasrlar");
    assert.ok(withSuffix.some((term) => withoutSuffix.includes(term)));
  });

  it("katta-kichik harf farq qilmaydi", () => {
    assert.deepEqual(searchTerms("KASRLAR"), searchTerms("kasrlar"));
  });

  it("juda ko'p so'z bo'lsa cheklaydi", () => {
    const terms = searchTerms(
      "birinchi ikkinchi uchinchi tortinchi beshinchi oltinchi yettinchi",
    );
    assert.ok(terms.length <= 5, `juda ko'p so'z: ${terms.length}`);
  });

  it("bo'sh mavzu bo'sh ro'yxat beradi", () => {
    assert.deepEqual(searchTerms(""), []);
    assert.deepEqual(searchTerms("   "), []);
  });
});

describe("formatCurriculumContext — dars ishlanmasi uchun", () => {
  it("bo'sh ro'yxatda BO'SH satr qaytaradi", () => {
    /*
      Eng muhim kafolat: dastur topilmasa promptga hech narsa
      qo'shilmasligi kerak. Bo'sh sarlavha qo'shilsa, model "dastur
      berilgan, lekin bo'sh" deb o'ylab chalkashardi.
    */
    assert.equal(formatForLessonPlan("UZ", []), "");
  });

  it("mavzu nomi, soat va natijalarni qo'shadi", () => {
    const context = formatForLessonPlan("UZ", [topic()]);
    assert.ok(context.includes("ODDIY KASRLAR"));
    assert.ok(context.includes("29"));
    assert.ok(context.includes("umumiy maxrajga keltira oladi"));
  });

  it("soat ko'rsatilmagan bo'lsa — qator umuman qo'shilmaydi", () => {
    const context = formatForLessonPlan("UZ", [topic({ expectedHours: null })]);
    assert.ok(!context.includes("soat:"), "bo'sh soat qatori qolib ketgan");
  });

  it("soat BUTUN BO'LIM uchun ekani aytiladi", () => {
    // Busiz model 29 soatni bitta darsga ajratib, bosqichlarni
    // 29 daqiqaga emas, 29 soatga cho'zardi.
    const context = formatForLessonPlan("UZ", [topic()]);
    assert.match(context, /BO['‘’]LIM uchun|butun/i);
  });

  it("har bir tilda O'Z tilida sarlavha beradi", () => {
    assert.match(formatForLessonPlan("UZ", [topic()]), /RASMIY O['‘’]QUV DASTURI/);
    assert.match(formatForLessonPlan("RU", [topic()]), /[а-яА-Я]/);
    assert.match(formatForLessonPlan("EN", [topic()]), /OFFICIAL CURRICULUM/);
  });
});

describe("formatCurriculumContext — kalendar reja uchun", () => {
  it("bo'sh ro'yxatda BO'SH satr qaytaradi", () => {
    assert.equal(formatForCalendarPlan("UZ", []), "");
  });

  it("bo'limlarni TARTIB RAQAMI bilan beradi", () => {
    // Kalendar rejada tartib muhim — model uni saqlashi kerak.
    const context = formatForCalendarPlan("UZ", [
      topic({ topicName: "BIRINCHI BOB" }),
      topic({ topicName: "IKKINCHI BOB" }),
    ]);
    assert.match(context, /1\.\s*BIRINCHI BOB/);
    assert.match(context, /2\.\s*IKKINCHI BOB/);
  });

  it("uzun tavsifni QISQARTIRADI", () => {
    /*
      11 ta bo'limning to'liq matni promptni 10 000 belgidan oshirib
      yuborardi va model asosiy topshiriqni yo'qotardi.
    */
    const long = "a".repeat(1000);
    const context = formatForCalendarPlan("UZ", [topic({ description: long })]);
    assert.ok(context.length < 1000, `qisqartirilmagan: ${context.length} belgi`);
    assert.ok(context.includes("…"), "qisqartirish belgisi yo'q");
  });

  it("tartibni buzmaslik KO'RSATILADI", () => {
    const context = formatForCalendarPlan("UZ", [topic()]);
    assert.match(context, /tartib/i);
  });
});
