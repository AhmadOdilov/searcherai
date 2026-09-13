import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateLessonPlanDocx } from "../lib/docx/generate";
import type { LessonPlanContent } from "../lib/validations/lesson-plan";

/**
 * Word hujjati generatsiyasi sinovlari.
 *
 * ── Nima tekshiriladi ─────────────────────────────────────────────────────
 * .docx — bu ichida XML fayllar bo'lgan ZIP arxivi. To'liq tahlil qilish
 * uchun alohida kutubxona kerak bo'lardi, lekin bizga u kerak emas:
 * haqiqiy xatolar shu uch joyda chiqadi —
 *   1. hujjat umuman yasalmaydi (kutubxona xatosi),
 *   2. arxiv buzuq bo'ladi (ZIP imzosi noto'g'ri),
 *   3. matn hujjatga tushmay qoladi (masalan bo'sh massiv bilan yiqiladi).
 *
 * ZIP ichidagi XML siqilgan, shuning uchun matnni to'g'ridan-to'g'ri
 * qidirib bo'lmaydi — o'rniga hujjat hajmi mazmunga qarab o'sishini
 * tekshiramiz.
 */

function labels() {
  return {
    subject: "Fan",
    grade: "Sinf",
    duration: "Davomiylik",
    lessonType: "Dars turi",
    objective: "Dars maqsadi",
    outcomes: "Kutilayotgan natijalar",
    resources: "Kerakli resurslar",
    stages: "Dars bosqichlari",
    stageColumn: "Bosqich",
    assessment: "Baholash mezonlari",
    teacher: "O'qituvchi",
    students: "O'quvchilar",
    minutes: (value: number) => `${value} daq.`,
    totalMinutes: (value: number) => `Jami ${value} daqiqa`,
  };
}

function content(overrides: Partial<LessonPlanContent> = {}): LessonPlanContent {
  return {
    objective: "O'quvchilar kasrlarni qo'shish qoidasini o'zlashtiradi.",
    outcomes: ["Bir xil maxrajli kasrlarni qo'shadi", "Umumiy maxrajga keltiradi"],
    resources: ["Doska", "Darslik"],
    stages: [
      {
        name: "Tashkiliy qism",
        durationMinutes: 5,
        description: "Davomat va o'tgan darsni eslash.",
        teacherActivity: "Savol beradi.",
        studentActivity: "Javob beradi.",
      },
      {
        name: "Yangi mavzu",
        durationMinutes: 40,
        description: "Qoida doskada tushuntiriladi.",
        teacherActivity: "Namuna yechadi.",
        studentActivity: "Daftarga yozadi.",
      },
    ],
    ...overrides,
  } as LessonPlanContent;
}

function input(overrides: Record<string, unknown> = {}) {
  return {
    topic: "Kasrlarni qo'shish",
    subject: "Matematika",
    grade: "7-sinf",
    durationMinutes: 45,
    lessonTypeName: "Yangi mavzu",
    content: content(),
    labels: labels(),
    ...overrides,
  };
}

describe("generateLessonPlanDocx", () => {
  it("haqiqiy .docx arxivi qaytaradi", async () => {
    const buffer = await generateLessonPlanDocx(input());

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 2000, `hujjat juda kichik: ${buffer.length} bayt`);

    // ZIP fayllari "PK\x03\x04" bilan boshlanadi. Bu Word ochilishining
    // eng arzon va eng ishonchli tekshiruvi.
    assert.equal(buffer.subarray(0, 4).toString("binary"), "PK");
  });

  it("baholash mezonlari BO'LMAGANDA ham ishlaydi", async () => {
    // `assessmentCriteria` sxemada ixtiyoriy — model uni tushirib
    // qoldirishi mumkin va bu hujjatni buzmasligi kerak.
    const buffer = await generateLessonPlanDocx(
      input({ content: content({ assessmentCriteria: undefined }) }),
    );
    assert.ok(buffer.length > 2000);
  });

  it("baholash mezonlari bo'lsa hujjat KATTALASHADI", async () => {
    const without = await generateLessonPlanDocx(input());
    const withCriteria = await generateLessonPlanDocx(
      input({
        content: content({
          assessmentCriteria: [
            "Umumiy maxrajni to'g'ri topdi",
            "Hisoblashda xatoga yo'l qo'ymadi",
            "Javobni qisqartirilgan ko'rinishda yozdi",
          ],
        }),
      }),
    );
    assert.ok(
      withCriteria.length > without.length,
      "qo'shimcha mazmun hujjatga tushmagan",
    );
  });

  it("o'zbek lotin va kirill harflari bilan yiqilmaydi", async () => {
    const buffer = await generateLessonPlanDocx(
      input({
        topic: "O'simliklarning ko'payishi — фотосинтез",
        content: content({
          objective: "O'quvchilar g'o'za va bug'doyning o'sishini solishtiradi.",
        }),
      }),
    );
    assert.ok(buffer.length > 2000);
  });

  it("uzun ishlanma bilan ham ishlaydi", async () => {
    const manyStages = Array.from({ length: 12 }, (_, index) => ({
      name: `Bosqich ${index + 1}`,
      durationMinutes: 5,
      description: "Tavsif matni.",
      teacherActivity: "Tushuntiradi.",
      studentActivity: "Bajaradi.",
    }));

    const buffer = await generateLessonPlanDocx(
      input({ content: content({ stages: manyStages }) }),
    );
    assert.ok(buffer.length > 3000);
  });

  it("har xil kirish uchun har xil hujjat chiqadi", async () => {
    const first = await generateLessonPlanDocx(input({ topic: "Kasrlar" }));
    const second = await generateLessonPlanDocx(input({ topic: "Fotosintez" }));
    assert.notEqual(first.toString("base64"), second.toString("base64"));
  });
});
