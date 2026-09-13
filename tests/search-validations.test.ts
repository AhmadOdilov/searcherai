import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { searchAnswerSchema, searchInputSchema } from "../lib/validations/search";
import { buildSearchSystemPrompt, buildSearchUserPrompt } from "../lib/search/prompt";

/**
 * AI qidiruv — sxema va prompt sinovlari. Baza ham, AI ham kerak emas.
 */

function validAnswer() {
  return {
    answer:
      "Fotosintez — o'simlikning yorug'lik yordamida suv va karbonat angidriddan oziq moddasi hosil qilish jarayoni. Bu jarayon barg hujayralaridagi xloroplastlarda kechadi.",
    keyPoints: [
      "Yorug'lik kerak",
      "Suv va karbonat angidrid — xomashyo",
      "Kislorod ajralib chiqadi",
    ],
    classroomIdeas: [
      "Derazadagi gulni ikki hafta qorong'ida saqlab, natijani solishtiring.",
      "Doskaga oddiy sxema chizib, o'quvchilardan strelkalarni to'ldirishni so'rang.",
    ],
  };
}

describe("searchInputSchema", () => {
  it("to'g'ri savolni qabul qiladi", () => {
    const result = searchInputSchema.safeParse({
      question: "Fotosintezni qanday tushuntiraman?",
      language: "UZ",
    });
    assert.equal(result.success, true);
  });

  it("fan va sinf IXTIYORIY", () => {
    // Ular bo'lmasa ham javob olinadi — faqat aniqligi pasayadi.
    const result = searchInputSchema.safeParse({ question: "Kasrlar nima?" });
    assert.equal(result.success, true);
    assert.equal(result.data?.subject, undefined);
    assert.equal(result.data?.grade, undefined);
  });

  it("til ko'rsatilmasa o'zbekcha bo'ladi", () => {
    const result = searchInputSchema.parse({ question: "Kasrlar nima?" });
    assert.equal(result.language, "UZ");
  });

  it("juda qisqa savolni rad etadi va TARJIMA KALITI qaytaradi", () => {
    const result = searchInputSchema.safeParse({ question: "a" });
    assert.equal(result.success, false);
    // Forma xatolari foydalanuvchiga ko'rsatiladi, ya'ni tarjima kerak.
    assert.equal(result.error?.issues[0]?.message, "errors.validation.questionTooShort");
  });

  it("juda uzun savolni rad etadi", () => {
    const result = searchInputSchema.safeParse({ question: "a".repeat(501) });
    assert.equal(result.success, false);
    assert.equal(result.error?.issues[0]?.message, "errors.validation.questionTooLong");
  });

  it("savol atrofidagi bo'shliqlarni olib tashlaydi", () => {
    const result = searchInputSchema.parse({ question: "   Kasrlar nima?   " });
    assert.equal(result.question, "Kasrlar nima?");
  });
});

describe("searchAnswerSchema", () => {
  it("to'liq javobni qabul qiladi", () => {
    assert.equal(searchAnswerSchema.safeParse(validAnswer()).success, true);
  });

  it("`caution` ixtiyoriy", () => {
    const withCaution = {
      ...validAnswer(),
      caution: "6-sinf darsligida bu jarayon soddalashtirilgan holda berilgan.",
    };
    assert.equal(searchAnswerSchema.safeParse(withCaution).success, true);
  });

  it("asosiy nuqtalar 3 tadan kam bo'lsa rad etadi", () => {
    const answer = { ...validAnswer(), keyPoints: ["bitta", "ikkita"] };
    assert.equal(searchAnswerSchema.safeParse(answer).success, false);
  });

  it("sinfda qo'llash g'oyalari 2 tadan kam bo'lsa rad etadi", () => {
    const answer = { ...validAnswer(), classroomIdeas: ["faqat bitta g'oya bor"] };
    assert.equal(searchAnswerSchema.safeParse(answer).success, false);
  });

  it("javob xabarlari TABIIY MATN — tarjima kaliti emas", () => {
    /*
      Bu xabarlar foydalanuvchiga emas, MODELGA yuboriladi (generateJson
      qayta so'rovda ularni promptga qo'shadi). Model esa
      "errors.validation.x" kalitini tushunmaydi.
    */
    const result = searchAnswerSchema.safeParse({ ...validAnswer(), answer: "qisqa" });
    assert.equal(result.success, false);
    const message = result.error?.issues[0]?.message ?? "";
    assert.ok(!message.startsWith("errors."), `kalit emas, matn kutilgan: ${message}`);
    assert.ok(message.length > 10);
  });
});

describe("qidiruv promptlari", () => {
  it("har bir til uchun O'Z tilida tizim prompti bor", () => {
    assert.match(buildSearchSystemPrompt("UZ"), /o'qituvchi/i);
    assert.match(buildSearchSystemPrompt("RU"), /[а-яА-Я]/);
    assert.match(buildSearchSystemPrompt("EN"), /teacher/i);
  });

  it("faqat JSON so'raydi", () => {
    for (const language of ["UZ", "RU", "EN"] as const) {
      assert.match(buildSearchSystemPrompt(language), /JSON/);
    }
  });

  it("savolni promptga qo'shadi", () => {
    const prompt = buildSearchUserPrompt({
      question: "Fotosintez nima?",
      language: "UZ",
    });
    assert.ok(prompt.includes("Fotosintez nima?"));
  });

  it("fan va sinf berilsa ular ham promptga tushadi", () => {
    const prompt = buildSearchUserPrompt({
      question: "Fotosintez nima?",
      subject: "Biologiya",
      grade: "6-sinf",
      language: "UZ",
    });
    assert.ok(prompt.includes("Biologiya"));
    assert.ok(prompt.includes("6-sinf"));
  });

  it("berilmagan maydonlar promptda BO'SH qator qoldirmaydi", () => {
    // Bo'sh "Fan:" qatori modelni chalkashtiradi — u yo'q bo'lishi kerak.
    const prompt = buildSearchUserPrompt({
      question: "Fotosintez nima?",
      language: "UZ",
    });
    assert.ok(!prompt.includes("Fan:"));
    assert.ok(!prompt.includes("Sinf:"));
  });

  it("javob shakli so'ralgan tilda tushuntiriladi", () => {
    assert.match(
      buildSearchUserPrompt({ question: "Что такое дроби?", language: "RU" }),
      /Формат/,
    );
    assert.match(
      buildSearchUserPrompt({ question: "What are fractions?", language: "EN" }),
      /shape/,
    );
  });
});
