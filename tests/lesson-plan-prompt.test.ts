import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSystemPrompt,
  buildUserPrompt,
  lessonTypeName,
} from "../lib/lesson-plans/prompt";
import type { LessonPlanInput } from "../lib/validations/lesson-plan";

/**
 * Prompt yig'ish sinovlari.
 *
 * Nega bu muhim: til moslashuvi jim buziladi — agar prompt o'zbekcha
 * qolib "javobni ruscha ber" deb qo'shilsa, model ko'pincha aralash
 * natija qaytaradi va buni faqat qo'lda sinab bilish mumkin bo'ladi.
 */

function input(overrides: Partial<LessonPlanInput> = {}): LessonPlanInput {
  return {
    subject: "Matematika",
    grade: "7-sinf",
    topic: "Kasrlarni qo'shish",
    durationMinutes: 45,
    lessonType: "NEW_TOPIC",
    language: "UZ",
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("har bir til uchun mavjud va bo'sh emas", () => {
    for (const language of ["UZ", "RU", "EN"] as const) {
      const prompt = buildSystemPrompt(language);
      assert.ok(prompt.length > 200, `${language} prompti juda qisqa`);
    }
  });

  it("o'zbek tilida metodist roli beriladi", () => {
    const prompt = buildSystemPrompt("UZ");
    assert.match(prompt, /metodist/i);
  });

  it("prompt MATNI tanlangan tilda bo'ladi", () => {
    // Ruscha promptda kirill harflari bo'lishi, o'zbekcha so'zlar
    // bo'lmasligi kerak.
    const ru = buildSystemPrompt("RU");
    assert.match(ru, /[а-яА-Я]/, "ruscha promptda kirill bo'lishi kerak");
    assert.ok(
      !ru.includes("Siz tajribali metodist"),
      "ruscha promptda o'zbekcha matn qolmasligi kerak",
    );

    const en = buildSystemPrompt("EN");
    assert.match(en, /experienced teacher/i);
    assert.ok(!/[а-яА-Я]/.test(en), "inglizcha promptda kirill bo'lmasligi kerak");
  });

  it("JSON maydon nomlari HAMMA tilda inglizcha qoladi", () => {
    // Maydon nomlari zod sxemasining kalitlari — tarjima qilinsa
    // validatsiya yiqiladi.
    const requiredKeys = [
      "objective",
      "outcomes",
      "resources",
      "stages",
      "durationMinutes",
      "teacherActivity",
      "studentActivity",
    ];

    for (const language of ["UZ", "RU", "EN"] as const) {
      const prompt = buildSystemPrompt(language);
      for (const key of requiredKeys) {
        assert.ok(
          prompt.includes(`"${key}"`),
          `${language} promptida "${key}" maydoni ko'rsatilmagan`,
        );
      }
    }
  });
});

describe("buildUserPrompt", () => {
  it("barcha parametrlarni promptga kiritadi", () => {
    const prompt = buildUserPrompt(
      input({ subject: "Fizika", grade: "8-sinf", topic: "Nyuton qonunlari" }),
    );

    assert.match(prompt, /Fizika/);
    assert.match(prompt, /8-sinf/);
    assert.match(prompt, /Nyuton qonunlari/);
    assert.match(prompt, /45/);
  });

  it("vaqt yig'indisi talabini ANIQ son bilan ta'kidlaydi", () => {
    const prompt = buildUserPrompt(input({ durationMinutes: 90 }));

    assert.match(prompt, /MUHIM/);
    assert.match(prompt, /90/);
    // Yig'indini tekshirish ko'rsatmasi ham bo'lishi kerak.
    assert.match(prompt, /yig'indi/i);
  });

  it("dars turiga qarab metodik ko'rsatma beradi", () => {
    const newTopic = buildUserPrompt(input({ lessonType: "NEW_TOPIC" }));
    const reinforcement = buildUserPrompt(input({ lessonType: "REINFORCEMENT" }));
    const assessment = buildUserPrompt(input({ lessonType: "ASSESSMENT" }));

    // Har bir tur uchun ko'rsatma FARQLI bo'lishi kerak.
    assert.notEqual(newTopic, reinforcement);
    assert.notEqual(reinforcement, assessment);

    // Mustahkamlash darsida "yangi material bermaslik" ko'rsatmasi bo'lsin.
    assert.match(reinforcement, /Yangi material bermaslikka/);
    // Nazorat darsida baholash mezonlari talab qilinsin.
    assert.match(assessment, /mezon/i);
  });

  it("til bo'yicha prompt matni o'zgaradi", () => {
    const uz = buildUserPrompt(input({ language: "UZ" }));
    const ru = buildUserPrompt(input({ language: "RU" }));
    const en = buildUserPrompt(input({ language: "EN" }));

    assert.match(uz, /Fan:/);
    assert.match(ru, /Предмет:/);
    assert.match(en, /Subject:/);

    // Ruscha promptda o'zbekcha sarlavha qolmasligi kerak.
    assert.ok(!ru.includes("Fan:"));
    assert.ok(!en.includes("Предмет:"));
  });

  it("ruscha promptda vaqt talabi ham ruscha", () => {
    const ru = buildUserPrompt(input({ language: "RU", durationMinutes: 40 }));
    assert.match(ru, /ВАЖНО/);
    assert.match(ru, /40/);
  });
});

describe("lessonTypeName", () => {
  it("har bir til va tur uchun nom qaytaradi", () => {
    for (const language of ["UZ", "RU", "EN"] as const) {
      for (const lessonType of ["NEW_TOPIC", "REINFORCEMENT", "ASSESSMENT"] as const) {
        const name = lessonTypeName(language, lessonType);
        assert.ok(name.length > 0, `${language}/${lessonType} nomi bo'sh`);
      }
    }
  });

  it("tilga mos nom beradi", () => {
    assert.equal(lessonTypeName("UZ", "REINFORCEMENT"), "mustahkamlash");
    assert.equal(lessonTypeName("RU", "REINFORCEMENT"), "закрепление");
    assert.equal(lessonTypeName("EN", "REINFORCEMENT"), "reinforcement");
  });
});
