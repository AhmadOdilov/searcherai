import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type PresentationPromptContext,
} from "../lib/presentations/prompt";
import { CONTENT_TYPES } from "../lib/presentations/storyline";
import { SHAPE_FIELDS } from "../lib/presentations/stage-prompts";
import type { LessonPlanContent } from "../lib/validations/lesson-plan";

/**
 * Prezentatsiya promptlari sinovlari.
 *
 * Eng muhimi: dars ishlanmasi berilganda uning MAZMUNI promptga
 * tushishi. Bu jim buziladigan narsa — prompt yig'ishda bitta qator
 * tushib qolsa, slaydlar darsga aloqasiz chiqadi va buni faqat natijani
 * o'qib bilish mumkin bo'lardi.
 */

const lessonPlan: LessonPlanContent = {
  objective: "O'quvchilar fotosintez jarayonining bosqichlarini tushuntirib bera oladi.",
  outcomes: [
    "O'quvchi fotosintez tenglamasini yozadi.",
    "O'quvchi yorug'lik va qorong'ulik bosqichlarini farqlaydi.",
  ],
  resources: ["Doska", "Barg namunalari"],
  stages: [
    {
      name: "Kirish",
      durationMinutes: 7,
      description: "O'simliklar qanday oziqlanadi degan savol bilan boshlanadi.",
      teacherActivity: "Savol beradi.",
      studentActivity: "Taxminlarini aytadilar.",
    },
    {
      name: "Yangi mavzu bayoni",
      durationMinutes: 20,
      description: "Fotosintez tenglamasi va bosqichlari tushuntiriladi.",
      teacherActivity: "Doskada sxema chizadi.",
      studentActivity: "Daftarga ko'chiradilar.",
    },
    {
      name: "Mustahkamlash",
      durationMinutes: 13,
      description: "Bargni kuzatish va savollarga javob berish.",
      teacherActivity: "Kuzatadi.",
      studentActivity: "Guruhlarda ishlaydilar.",
    },
    {
      name: "Uyga vazifa",
      durationMinutes: 5,
      description: "Tajriba o'tkazish topshirig'i beriladi.",
      teacherActivity: "Vazifani tushuntiradi.",
      studentActivity: "Yozib oladilar.",
    },
  ],
  assessmentCriteria: ["Tenglamani to'g'ri yozadi"],
};

function context(
  overrides: Partial<PresentationPromptContext> = {},
): PresentationPromptContext {
  return {
    topic: "Fotosintez jarayoni",
    subject: "Biologiya",
    grade: "7-sinf",
    language: "UZ",
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("har bir til uchun mavjud va bo'sh emas", () => {
    for (const language of ["UZ", "RU", "EN"] as const) {
      assert.ok(
        buildSystemPrompt(language).length > 300,
        `${language} prompti juda qisqa`,
      );
    }
  });

  /*
    ── Bu sinov TESKARISIGA o'zgardi (Phase 0) ─────────────────────────────
    Ilgari u system promptda "5 dan 15 gacha slayd" oralig'i BORLIGINI
    talab qilardi. Ko'p bosqichli quvurda bu ziddiyat: slaydlar soni
    brifda hal qilinadi va `contentSchemaFor` AYNAN rejadagi sonni
    talab qiladi. Oraliq aytilsa model ikki ko'rsatma orasida qoladi.

    DIQQAT: bu yerda raqam qidirish MUMKIN EMAS. Yangi promptda
    "10-15 so'z" degan tavsiya bor va u `String(MAX_SLIDES)` ni
    tasodifan qanoatlantiradi — ya'ni raqamga asoslangan tekshiruv
    yolg'on ijobiy beradi. Shuning uchun eski BUYRUQ matni qidiriladi.
  */
  it("slaydlar sonini BELGILAMAYDI — uni reja hal qiladi", () => {
    const forbidden: Record<"UZ" | "RU" | "EN", string> = {
      UZ: "Slaydlar soni:",
      RU: "Количество слайдов:",
      EN: "Number of slides:",
    };

    for (const language of ["UZ", "RU", "EN"] as const) {
      assert.ok(
        !buildSystemPrompt(language).includes(forbidden[language]),
        `${language}: system prompt hali ham slaydlar sonini buyurmoqda`,
      );
    }
  });

  /*
    ── P0-3 REGRESSIYASI ──────────────────────────────────────────────────
    System prompt V6 blok shartnomasini bilmasdi: `cards`, `steps`,
    `comparison`, `statistic`, `chart`, `quote`, `keyMessage` so'zlari
    unda UMUMAN yo'q edi. `stage-prompts.ts` esa aynan shu maydonlarni
    so'rardi — model ikki zid ko'rsatma orasida qolib, odatda
    bandlar yozardi va kartalar faylga tushmasdi.

    Shartnoma `SHAPE_FIELDS` da yozilgan; ikkala prompt ham shundan
    kelib chiqishi kerak.
  */
  it("HAR BIR mazmun shakli va uning maydoni system promptda bor", () => {
    for (const language of ["UZ", "RU", "EN"] as const) {
      const prompt = buildSystemPrompt(language);

      for (const contentType of CONTENT_TYPES) {
        assert.ok(
          prompt.includes(contentType),
          `${language}: "${contentType}" mazmun shakli tushuntirilmagan`,
        );

        /*
          `SHAPE_FIELDS` dagi asosiy maydon nomi: "cards: [...]" → "cards",
          "keyMessage (bullets: [])" → "keyMessage". Shuning uchun ":" bo'yicha
          bo'lish yetarli emas — birinchi identifikator olinadi.
        */
        const field = SHAPE_FIELDS[contentType].match(/^[A-Za-z]+/)?.[0] ?? "";
        assert.ok(field.length > 0, `${contentType}: maydon nomi o'qilmadi`);
        assert.ok(
          prompt.includes(`"${field}"`),
          `${language}: "${contentType}" uchun "${field}" maydoni ko'rsatilmagan`,
        );
      }
    }
  });

  it("mavjud bo'lmagan maydon o'ylab topish TAQIQLANADI", () => {
    assert.match(buildSystemPrompt("UZ"), /O'YLAB TOPMANG/);
    assert.match(buildSystemPrompt("RU"), /НЕ ВЫДУМЫВАЙТЕ/);
    assert.match(buildSystemPrompt("EN"), /Do NOT invent/);
  });

  it("shakl bandlar BO'LMASA bullets bo'sh massiv ekani aytiladi", () => {
    for (const language of ["UZ", "RU", "EN"] as const) {
      assert.match(
        buildSystemPrompt(language),
        /\[\]/,
        `${language}: bo'sh massiv ko'rsatmasi yo'q`,
      );
    }
  });

  it("bandlar QISQA bo'lishini talab qiladi", () => {
    // Bu prezentatsiya sifatining asosiy shartlaridan biri — slaydga
    // konspekt yozilib qolmasligi kerak.
    assert.match(buildSystemPrompt("UZ"), /QISQA/);
    assert.match(buildSystemPrompt("RU"), /КОРОТКИМ/);
    assert.match(buildSystemPrompt("EN"), /SHORT/);
  });

  it("uch slayd turini ham tushuntiradi", () => {
    for (const language of ["UZ", "RU", "EN"] as const) {
      const prompt = buildSystemPrompt(language);
      for (const type of ["title", "content", "summary"]) {
        assert.ok(prompt.includes(`"${type}"`), `${language}: ${type} yo'q`);
      }
    }
  });

  it("JSON maydon nomlari HAMMA tilda inglizcha qoladi", () => {
    // Maydon nomlari zod sxemasining kalitlari — tarjima qilinsa
    // validatsiya yiqiladi.
    for (const language of ["UZ", "RU", "EN"] as const) {
      const prompt = buildSystemPrompt(language);
      for (const key of ["title", "slides", "heading", "bullets", "speakerNotes"]) {
        assert.ok(prompt.includes(`"${key}"`), `${language}: "${key}" yo'q`);
      }
    }
  });

  it("prompt matni tanlangan tilda bo'ladi", () => {
    const ru = buildSystemPrompt("RU");
    assert.match(ru, /[а-яА-Я]/);
    assert.ok(!ru.includes("Siz tajribali"));

    const en = buildSystemPrompt("EN");
    assert.ok(!/[а-яА-Я]/.test(en));
  });
});

describe("buildUserPrompt — mustaqil rejim", () => {
  it("mavzu, fan va sinfni kiritadi", () => {
    const prompt = buildUserPrompt(context());

    assert.match(prompt, /Fotosintez jarayoni/);
    assert.match(prompt, /Biologiya/);
    assert.match(prompt, /7-sinf/);
  });

  it("fan va sinf berilmasa ularsiz ishlaydi", () => {
    const prompt = buildUserPrompt(context({ subject: undefined, grade: undefined }));

    assert.match(prompt, /Fotosintez jarayoni/);
    assert.ok(!prompt.includes("Fan:"));
    assert.ok(!prompt.includes("Sinf"));
  });

  it("mustaqil rejimda mavzuni ochish ko'rsatmasini beradi", () => {
    const prompt = buildUserPrompt(context());
    assert.match(prompt, /mantiqiy ketma-ketlikda/);
  });

  it("dars ishlanmasi bo'limi BO'LMAYDI", () => {
    const prompt = buildUserPrompt(context());
    assert.ok(!prompt.includes("Dars maqsadi"));
    assert.ok(!prompt.includes("Dars bosqichlari"));
  });
});

describe("buildUserPrompt — DARS ISHLANMASI asosida", () => {
  it("maqsadni promptga kiritadi", () => {
    const prompt = buildUserPrompt(context({ lessonPlan }));
    assert.ok(
      prompt.includes(lessonPlan.objective),
      "dars maqsadi promptda bo'lishi kerak",
    );
  });

  it("kutilayotgan natijalarni kiritadi", () => {
    const prompt = buildUserPrompt(context({ lessonPlan }));
    for (const outcome of lessonPlan.outcomes) {
      assert.ok(prompt.includes(outcome), `natija tushib qolgan: ${outcome}`);
    }
  });

  it("BARCHA dars bosqichlarini nomi, vaqti va tavsifi bilan kiritadi", () => {
    const prompt = buildUserPrompt(context({ lessonPlan }));

    for (const stage of lessonPlan.stages) {
      assert.ok(prompt.includes(stage.name), `bosqich nomi yo'q: ${stage.name}`);
      assert.ok(
        prompt.includes(stage.description),
        `bosqich tavsifi yo'q: ${stage.name}`,
      );
      assert.ok(
        prompt.includes(String(stage.durationMinutes)),
        `bosqich vaqti yo'q: ${stage.name}`,
      );
    }
  });

  it("bosqichlarni TARTIB RAQAMI bilan beradi", () => {
    const prompt = buildUserPrompt(context({ lessonPlan }));
    assert.match(prompt, /1\. Kirish/);
    assert.match(prompt, /4\. Uyga vazifa/);
  });

  it("har bosqichga bitta slayd ko'rsatmasini beradi", () => {
    // Bu aynan foydalanuvchi so'ragan xatti-harakat: slaydlar dars
    // oqimiga mos kelsin.
    const prompt = buildUserPrompt(context({ lessonPlan }));
    assert.match(prompt, /MUHIM/);
    assert.match(prompt, /har bir dars bosqichi uchun taxminan bitta/);
  });

  it("mustaqil rejim ko'rsatmasi BERILMAYDI", () => {
    const prompt = buildUserPrompt(context({ lessonPlan }));
    assert.ok(!prompt.includes("mustaqil ravishda"));
  });

  it("ikki rejim promptlari SEZILARLI farq qiladi", () => {
    const withPlan = buildUserPrompt(context({ lessonPlan }));
    const without = buildUserPrompt(context());

    assert.ok(
      withPlan.length > without.length + 300,
      "dars ishlanmasi prompti ancha uzunroq bo'lishi kerak",
    );
  });
});

describe("buildUserPrompt — tillar", () => {
  it("har bir tilda sarlavhalar mos bo'ladi", () => {
    assert.match(buildUserPrompt(context({ language: "UZ" })), /Mavzu:/);
    assert.match(buildUserPrompt(context({ language: "RU" })), /Тема:/);
    assert.match(buildUserPrompt(context({ language: "EN" })), /Topic:/);
  });

  it("dars ishlanmasi bo'limi ham tarjima qilinadi", () => {
    const ru = buildUserPrompt(context({ language: "RU", lessonPlan }));
    assert.match(ru, /Цель урока/);
    assert.match(ru, /Этапы урока/);
    assert.match(ru, /ВАЖНО/);
    assert.ok(!ru.includes("Dars maqsadi"));

    const en = buildUserPrompt(context({ language: "EN", lessonPlan }));
    assert.match(en, /Lesson objective/);
    assert.match(en, /Lesson stages/);
    assert.match(en, /IMPORTANT/);
  });

  it("dars mazmuni tarjima QILINMAYDI (u allaqachon kerakli tilda)", () => {
    // Dars ishlanmasi qaysi tilda yaratilgan bo'lsa, shu tilda keladi —
    // prompt yig'uvchi uni o'zgartirmasligi kerak.
    const ru = buildUserPrompt(context({ language: "RU", lessonPlan }));
    assert.ok(ru.includes(lessonPlan.objective));
  });
});
