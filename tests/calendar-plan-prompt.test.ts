import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSystemPrompt, buildUserPrompt } from "../lib/calendar-plans/prompt";
import type { CalendarPlanInput } from "../lib/validations/calendar-plan";

/**
 * Kalendar reja promptlari sinovlari.
 *
 * Eng muhimi: SANALAR promptga tayyor holda tushishi. AI sana
 * arifmetikasida ishonchsiz, shuning uchun ular kodda hisoblanadi va
 * promptga ko'chiriladi — bu bog'lanish uzilsa, sanalar noto'g'ri
 * chiqadi va buni faqat natijani o'qib bilish mumkin bo'lardi.
 */

function input(overrides: Partial<CalendarPlanInput> = {}): CalendarPlanInput {
  return {
    subject: "Matematika",
    grade: "7-sinf",
    period: "1-chorak",
    startDate: new Date("2026-09-14T00:00:00Z"),
    weeks: 9,
    hoursPerWeek: 2,
    language: "UZ",
    ...overrides,
  };
}

describe("buildSystemPrompt", () => {
  it("har bir til uchun mavjud va bo'sh emas", () => {
    for (const language of ["UZ", "RU", "EN"] as const) {
      assert.ok(buildSystemPrompt(language).length > 300);
    }
  });

  it("sanalarni O'ZGARTIRMASLIKNI talab qiladi", () => {
    // Bu ko'rsatma bo'lmasa AI sanalarni o'zicha qayta hisoblaydi.
    assert.match(buildSystemPrompt("UZ"), /O'ZGARTIRMANG/);
    assert.match(buildSystemPrompt("RU"), /Не изменяйте/);
    assert.match(buildSystemPrompt("EN"), /Do not change/);
  });

  it("mantiqiy ketma-ketlik talabini beradi", () => {
    assert.match(buildSystemPrompt("UZ"), /MANTIQIY KETMA-KETLIKDA/);
    assert.match(buildSystemPrompt("RU"), /ЛОГИЧЕСКОЙ ПОСЛЕДОВАТЕЛЬНОСТИ/);
    assert.match(buildSystemPrompt("EN"), /LOGICAL SEQUENCE/);
  });

  it("JSON maydon nomlari HAMMA tilda inglizcha qoladi", () => {
    for (const language of ["UZ", "RU", "EN"] as const) {
      const prompt = buildSystemPrompt(language);
      for (const key of [
        "title",
        "weeks",
        "weekNumber",
        "dateRange",
        "topics",
        "name",
        "hours",
        "note",
      ]) {
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

describe("buildUserPrompt — parametrlar", () => {
  it("barcha parametrlarni kiritadi", () => {
    const prompt = buildUserPrompt(
      input({ subject: "Fizika", grade: "8-sinf", period: "2-chorak" }),
    );

    assert.match(prompt, /Fizika/);
    assert.match(prompt, /8-sinf/);
    assert.match(prompt, /2-chorak/);
  });

  it("JAMI soatni hisoblab beradi", () => {
    // 12 hafta × 3 soat = 36
    const prompt = buildUserPrompt(input({ weeks: 12, hoursPerWeek: 3 }));
    assert.match(prompt, /Jami soat: 36/);
  });
});

describe("buildUserPrompt — SANALAR", () => {
  it("hafta sanalarini TAYYOR holda beradi", () => {
    const prompt = buildUserPrompt(input({ weeks: 3 }));

    assert.match(prompt, /1\. 14\.09\.2026 – 20\.09\.2026/);
    assert.match(prompt, /2\. 21\.09\.2026 – 27\.09\.2026/);
    assert.match(prompt, /3\. 28\.09\.2026 – 04\.10\.2026/);
  });

  it("BARCHA haftalar uchun sana beriladi", () => {
    // 24 — MAX_WEEKS, eng uzun ruxsat etilgan davr.
    const prompt = buildUserPrompt(input({ weeks: 24 }));

    // Har bir hafta raqami alohida qatorda bo'lishi kerak.
    for (const weekNumber of [1, 12, 24]) {
      assert.match(
        prompt,
        new RegExp(`^${weekNumber}\\. \\d{2}\\.\\d{2}\\.\\d{4}`, "m"),
        `${weekNumber}-hafta sanasi yo'q`,
      );
    }
  });

  it("sanalarni AYNAN ishlatish ko'rsatmasi beriladi", () => {
    const prompt = buildUserPrompt(input());
    assert.match(prompt, /AYNAN shu qiymatlarni ishlat/);
  });

  it("hafta soni o'zgarganda sanalar ham o'zgaradi", () => {
    const short = buildUserPrompt(input({ weeks: 2 }));
    const long = buildUserPrompt(input({ weeks: 10 }));

    assert.ok(!short.includes("10."), "2 haftalik rejada 10-hafta bo'lmasligi kerak");
    assert.match(long, /^10\. /m);
  });
});

describe("buildUserPrompt — tillar", () => {
  it("sarlavhalar tilga mos bo'ladi", () => {
    assert.match(buildUserPrompt(input({ language: "UZ" })), /Fan:/);
    assert.match(buildUserPrompt(input({ language: "RU" })), /Предмет:/);
    assert.match(buildUserPrompt(input({ language: "EN" })), /Subject:/);
  });

  it("eslatma ham tarjima qilinadi", () => {
    assert.match(buildUserPrompt(input({ language: "UZ" })), /MUHIM/);
    assert.match(buildUserPrompt(input({ language: "RU" })), /ВАЖНО/);
    assert.match(buildUserPrompt(input({ language: "EN" })), /IMPORTANT/);
  });

  it("sanalar formati HAR uch tilda bir xil qoladi", () => {
    // Sanalar kodda hisoblanadi — til ularga ta'sir qilmasligi kerak,
    // aks holda AI ularni ko'chirganda nomuvofiqlik chiqardi.
    for (const language of ["UZ", "RU", "EN"] as const) {
      const prompt = buildUserPrompt(input({ language, weeks: 1 }));
      assert.match(prompt, /1\. 14\.09\.2026 – 20\.09\.2026/);
    }
  });
});
