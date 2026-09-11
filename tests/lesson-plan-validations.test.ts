import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  lessonPlanContentSchema,
  lessonPlanContentSchemaFor,
  lessonPlanInputSchema,
  lessonPlanListQuerySchema,
  parseLessonPlanContent,
  totalStageMinutes,
} from "../lib/validations/lesson-plan";

/**
 * Dars ishlanmasi sxemalari sinovlari — baza va AI kerak emas.
 */

/** To'g'ri kontent namunasi — yig'indi 45 daqiqa. */
function validContent(stageMinutes = [7, 20, 13, 5]) {
  return {
    objective: "O'quvchilar kasrlarni qo'shish va ayirish qoidalarini o'zlashtiradi.",
    outcomes: [
      "O'quvchi bir xil maxrajli kasrlarni qo'shadi.",
      "O'quvchi turli maxrajli kasrlarni umumiy maxrajga keltiradi.",
    ],
    resources: ["Doska", "Darslik"],
    stages: stageMinutes.map((minutes, index) => ({
      name: `Bosqich ${index + 1}`,
      durationMinutes: minutes,
      description: "Bosqichda nima bo'lishining yetarlicha uzun tavsifi.",
      teacherActivity: "Tushuntiradi va savol beradi.",
      studentActivity: "Tinglaydi va mashq bajaradi.",
    })),
  };
}

describe("lessonPlanInputSchema", () => {
  it("to'g'ri ma'lumotni qabul qiladi", () => {
    const parsed = lessonPlanInputSchema.parse({
      subject: "Matematika",
      grade: "7-sinf",
      topic: "Kasrlarni qo'shish",
      durationMinutes: 45,
      lessonType: "NEW_TOPIC",
      language: "UZ",
    });

    assert.equal(parsed.subject, "Matematika");
    assert.equal(parsed.durationMinutes, 45);
  });

  it("ko'rsatilmagan maydonlarga standart qiymat beradi", () => {
    const parsed = lessonPlanInputSchema.parse({
      subject: "Tarix",
      grade: "9-sinf",
      topic: "Amir Temur davri",
    });

    assert.equal(parsed.durationMinutes, 45);
    assert.equal(parsed.lessonType, "NEW_TOPIC");
    assert.equal(parsed.language, "UZ");
  });

  it("formadan kelgan MATN ko'rinishidagi raqamni o'giradi", () => {
    // HTML forma hamma qiymatni satr sifatida yuboradi.
    const parsed = lessonPlanInputSchema.parse({
      subject: "Fizika",
      grade: "8-sinf",
      topic: "Nyuton qonunlari",
      durationMinutes: "90",
    });

    assert.equal(parsed.durationMinutes, 90);
    assert.equal(typeof parsed.durationMinutes, "number");
  });

  it("bo'shliqni kesadi", () => {
    const parsed = lessonPlanInputSchema.parse({
      subject: "  Biologiya  ",
      grade: " 6-sinf ",
      topic: "  Hujayra tuzilishi  ",
    });

    assert.equal(parsed.subject, "Biologiya");
    assert.equal(parsed.grade, "6-sinf");
    assert.equal(parsed.topic, "Hujayra tuzilishi");
  });

  it("juda qisqa mavzuni rad etadi", () => {
    const result = lessonPlanInputSchema.safeParse({
      subject: "Matematika",
      grade: "7-sinf",
      topic: "ab",
    });

    assert.equal(result.success, false);
    assert.ok(result.error!.issues.some((i) => i.path[0] === "topic"));
  });

  it("mantiqsiz davomiylikni rad etadi", () => {
    for (const durationMinutes of [5, 300, -45, 0]) {
      const result = lessonPlanInputSchema.safeParse({
        subject: "Matematika",
        grade: "7-sinf",
        topic: "Kasrlar",
        durationMinutes,
      });
      assert.equal(result.success, false, `${durationMinutes} daqiqa rad etilishi kerak`);
    }
  });

  it("noto'g'ri dars turi va tilni rad etadi", () => {
    const badType = lessonPlanInputSchema.safeParse({
      subject: "Matematika",
      grade: "7-sinf",
      topic: "Kasrlar",
      lessonType: "BOSHQA_TUR",
    });
    assert.equal(badType.success, false);

    const badLanguage = lessonPlanInputSchema.safeParse({
      subject: "Matematika",
      grade: "7-sinf",
      topic: "Kasrlar",
      language: "DE",
    });
    assert.equal(badLanguage.success, false);
  });

  it("userId ni QABUL QILMAYDI", () => {
    // Egalik faqat sessiyadan aniqlanadi — so'rovdan userId o'tib
    // ketmasligi kerak.
    const parsed = lessonPlanInputSchema.parse({
      subject: "Matematika",
      grade: "7-sinf",
      topic: "Kasrlar",
      userId: "boshqa-foydalanuvchi-id",
    });

    assert.equal("userId" in parsed, false);
  });
});

describe("lessonPlanContentSchema", () => {
  it("to'g'ri kontentni qabul qiladi", () => {
    const result = lessonPlanContentSchema.safeParse(validContent());
    assert.equal(result.success, true);
  });

  it("baholash mezonlarisiz ham o'tadi (ixtiyoriy)", () => {
    const content = validContent();
    const result = lessonPlanContentSchema.safeParse(content);
    assert.equal(result.success, true);
    assert.equal(result.data!.assessmentCriteria, undefined);
  });

  it("bitta kutilayotgan natijani rad etadi (kamida 2 kerak)", () => {
    const content = { ...validContent(), outcomes: ["Faqat bitta natija"] };
    const result = lessonPlanContentSchema.safeParse(content);

    assert.equal(result.success, false);
    assert.ok(result.error!.issues.some((i) => i.path[0] === "outcomes"));
  });

  it("2 bosqichni rad etadi (kamida 3 kerak)", () => {
    const content = validContent([20, 25]);
    const result = lessonPlanContentSchema.safeParse(content);

    assert.equal(result.success, false);
    assert.ok(result.error!.issues.some((i) => i.path[0] === "stages"));
  });

  it("juda qisqa maqsadni rad etadi", () => {
    const content = { ...validContent(), objective: "Bilim" };
    const result = lessonPlanContentSchema.safeParse(content);

    assert.equal(result.success, false);
    assert.ok(result.error!.issues.some((i) => i.path[0] === "objective"));
  });

  it("bosqichda o'quvchi faoliyati yo'q bo'lsa rad etadi", () => {
    const content = validContent();
    content.stages[1].studentActivity = "";
    const result = lessonPlanContentSchema.safeParse(content);

    assert.equal(result.success, false);
    assert.ok(
      result.error!.issues.some(
        (i) => i.path[0] === "stages" && i.path[2] === "studentActivity",
      ),
    );
  });

  it("bosqich davomiyligi butun son bo'lmasa rad etadi", () => {
    const content = validContent();
    content.stages[0].durationMinutes = 7.5;
    const result = lessonPlanContentSchema.safeParse(content);

    assert.equal(result.success, false);
  });
});

describe("lessonPlanContentSchemaFor — vaqt yig'indisi", () => {
  it("yig'indi aniq mos kelsa o'tadi", () => {
    const result = lessonPlanContentSchemaFor(45).safeParse(validContent());
    assert.equal(result.success, true);
  });

  it("kichik farqni KECHIRADI", () => {
    // 43 ≈ 45 — bu amalda yaroqli natija, generatsiyani yiqitmasligi kerak.
    const result = lessonPlanContentSchemaFor(45).safeParse(validContent([7, 19, 12, 5]));
    assert.equal(result.success, true);
  });

  it("mantiqsiz kichik yig'indini rad etadi", () => {
    // 45 daqiqalik darsga jami 9 daqiqa — bu xato.
    const result = lessonPlanContentSchemaFor(45).safeParse(validContent([3, 3, 3]));

    assert.equal(result.success, false);
    const issue = result.error!.issues.find((i) => i.path[0] === "stages");
    assert.ok(issue);
    // Xato xabari modelga QAYTA so'rovda yuboriladi — unda aniq son
    // bo'lishi kerak.
    assert.match(issue.message, /45/);
  });

  it("mantiqsiz katta yig'indini rad etadi", () => {
    const result = lessonPlanContentSchemaFor(45).safeParse(
      validContent([40, 40, 40, 40]),
    );
    assert.equal(result.success, false);
  });

  it("90 daqiqalik dars uchun chegara boshqacha", () => {
    // 45 uchun rad etilgan yig'indi (160) 90 uchun ham rad etiladi,
    // lekin 100 — 90 uchun o'tadi.
    assert.equal(
      lessonPlanContentSchemaFor(90).safeParse(validContent([25, 25, 25, 25])).success,
      true,
    );
    assert.equal(
      lessonPlanContentSchemaFor(45).safeParse(validContent([25, 25, 25, 25])).success,
      false,
    );
  });
});

describe("parseLessonPlanContent — bazadan o'qish", () => {
  it("to'g'ri kontentni qaytaradi", () => {
    const parsed = parseLessonPlanContent(validContent());
    assert.ok(parsed);
    assert.equal(parsed.stages.length, 4);
  });

  it("noto'g'ri shaklda null qaytaradi, xato TASHLAMAYDI", () => {
    // Eski yozuvlar boshqa shaklda bo'lishi mumkin — sahifa qulamasligi kerak.
    assert.equal(parseLessonPlanContent(null), null);
    assert.equal(parseLessonPlanContent("matn"), null);
    assert.equal(parseLessonPlanContent({}), null);
    assert.equal(parseLessonPlanContent({ objective: "eski shakl" }), null);
  });
});

describe("totalStageMinutes", () => {
  it("bosqichlar davomiyligini qo'shadi", () => {
    const content = lessonPlanContentSchema.parse(validContent([10, 20, 10, 5]));
    assert.equal(totalStageMinutes(content), 45);
  });
});

describe("lessonPlanListQuerySchema", () => {
  it("standart limit 20", () => {
    const parsed = lessonPlanListQuerySchema.parse({});
    assert.equal(parsed.limit, 20);
    assert.equal(parsed.status, undefined);
  });

  it("holat bo'yicha filtrni qabul qiladi", () => {
    const parsed = lessonPlanListQuerySchema.parse({ status: "FAILED" });
    assert.equal(parsed.status, "FAILED");
  });

  it("noto'g'ri holatni rad etadi", () => {
    assert.equal(
      lessonPlanListQuerySchema.safeParse({ status: "BOSHQA" }).success,
      false,
    );
  });

  it("juda katta limitni rad etadi", () => {
    assert.equal(lessonPlanListQuerySchema.safeParse({ limit: 500 }).success, false);
  });
});
