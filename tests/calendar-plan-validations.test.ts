import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  calendarPlanContentSchema,
  calendarPlanContentSchemaFor,
  calendarPlanInputSchema,
  calendarPlanListQuerySchema,
  parseCalendarPlanContent,
  totalHours,
  totalRowCount,
  type CalendarWeek,
} from "../lib/validations/calendar-plan";
import { buildWeekRanges } from "../lib/calendar-plans/dates";

/**
 * Kalendar reja sxemalari va sana hisoblash sinovlari.
 */

function week(number: number, hours: number[]): CalendarWeek {
  return {
    weekNumber: number,
    dateRange: `Hafta ${number}`,
    topics: hours.map((value, index) => ({
      name: `Mavzu ${number}.${index + 1}`,
      hours: value,
    })),
  };
}

/** 9 hafta × 2 soat = 18 soat. */
function content(weeks = 9, hoursPerWeek = 2) {
  return {
    title: "Matematika — 7-sinf, 1-chorak kalendar-tematik rejasi",
    weeks: Array.from({ length: weeks }, (_, index) => week(index + 1, [hoursPerWeek])),
  };
}

describe("calendarPlanInputSchema", () => {
  it("to'g'ri ma'lumotni qabul qiladi", () => {
    const parsed = calendarPlanInputSchema.parse({
      subject: "Matematika",
      grade: "7-sinf",
      period: "1-chorak",
      startDate: "2026-09-14",
      weeks: 9,
      hoursPerWeek: 2,
      language: "UZ",
    });

    assert.equal(parsed.subject, "Matematika");
    assert.equal(parsed.weeks, 9);
    assert.ok(parsed.startDate instanceof Date);
    assert.equal(parsed.startDate.toISOString().slice(0, 10), "2026-09-14");
  });

  it("standart qiymatlar qo'llaniladi", () => {
    const parsed = calendarPlanInputSchema.parse({
      subject: "Fizika",
      grade: "8-sinf",
      period: "2-chorak",
      startDate: "2026-11-10",
    });

    assert.equal(parsed.weeks, 9);
    assert.equal(parsed.hoursPerWeek, 2);
    assert.equal(parsed.language, "UZ");
  });

  it("formadan kelgan MATN ko'rinishidagi raqamni o'giradi", () => {
    const parsed = calendarPlanInputSchema.parse({
      subject: "Fizika",
      grade: "8-sinf",
      period: "1-chorak",
      startDate: "2026-09-14",
      weeks: "12",
      hoursPerWeek: "3",
    });

    assert.equal(parsed.weeks, 12);
    assert.equal(typeof parsed.weeks, "number");
    assert.equal(parsed.hoursPerWeek, 3);
  });

  it("noto'g'ri sanani rad etadi", () => {
    for (const startDate of ["sana emas", "", "2026-13-45"]) {
      const result = calendarPlanInputSchema.safeParse({
        subject: "Matematika",
        grade: "7-sinf",
        period: "1-chorak",
        startDate,
      });
      assert.equal(result.success, false, `"${startDate}" rad etilishi kerak`);
    }
  });

  it("mantiqsiz sanani rad etadi", () => {
    const result = calendarPlanInputSchema.safeParse({
      subject: "Matematika",
      grade: "7-sinf",
      period: "1-chorak",
      startDate: "1850-09-14",
    });
    assert.equal(result.success, false);
  });

  it("mantiqsiz hafta sonini rad etadi", () => {
    // 25+ — model chegarasidan oshadi (MAX_WEEKS = 24).
    for (const weeks of [0, -5, 25, 53, 100]) {
      const result = calendarPlanInputSchema.safeParse({
        subject: "Matematika",
        grade: "7-sinf",
        period: "1-chorak",
        startDate: "2026-09-14",
        weeks,
      });
      assert.equal(result.success, false, `${weeks} hafta rad etilishi kerak`);
    }
  });

  it("mantiqsiz haftalik soatni rad etadi", () => {
    for (const hoursPerWeek of [0, -2, 25]) {
      const result = calendarPlanInputSchema.safeParse({
        subject: "Matematika",
        grade: "7-sinf",
        period: "1-chorak",
        startDate: "2026-09-14",
        hoursPerWeek,
      });
      assert.equal(result.success, false);
    }
  });

  it("bo'sh davr nomini rad etadi", () => {
    const result = calendarPlanInputSchema.safeParse({
      subject: "Matematika",
      grade: "7-sinf",
      period: " ",
      startDate: "2026-09-14",
    });
    assert.equal(result.success, false);
  });

  it("userId ni QABUL QILMAYDI", () => {
    const parsed = calendarPlanInputSchema.parse({
      subject: "Matematika",
      grade: "7-sinf",
      period: "1-chorak",
      startDate: "2026-09-14",
      userId: "begona-foydalanuvchi",
    });
    assert.equal("userId" in parsed, false);
  });
});

describe("calendarPlanContentSchema", () => {
  it("to'g'ri kontentni qabul qiladi", () => {
    assert.equal(calendarPlanContentSchema.safeParse(content()).success, true);
  });

  it("mavzusiz haftani rad etadi", () => {
    const bad = content();
    bad.weeks[0].topics = [];

    const result = calendarPlanContentSchema.safeParse(bad);
    assert.equal(result.success, false);
    assert.ok(result.error!.issues.some((i) => i.path.includes("topics")));
  });

  it("bo'sh haftalar massivini rad etadi", () => {
    const result = calendarPlanContentSchema.safeParse({
      title: "Sarlavha",
      weeks: [],
    });
    assert.equal(result.success, false);
  });

  it("juda qisqa mavzu nomini rad etadi", () => {
    const bad = content();
    bad.weeks[0].topics[0].name = "ab";

    assert.equal(calendarPlanContentSchema.safeParse(bad).success, false);
  });

  it("soat butun son bo'lmasa rad etadi", () => {
    const bad = content();
    bad.weeks[0].topics[0].hours = 1.5;

    assert.equal(calendarPlanContentSchema.safeParse(bad).success, false);
  });

  it("izoh ixtiyoriy", () => {
    const withNote = content();
    withNote.weeks[0].topics[0] = {
      name: "Nazorat ishi",
      hours: 2,
      note: "Yozma nazorat",
    };

    assert.equal(calendarPlanContentSchema.safeParse(withNote).success, true);
  });

  it("hafta raqami chegaradan oshsa rad etadi", () => {
    const bad = content(1);
    bad.weeks[0].weekNumber = 60;

    assert.equal(calendarPlanContentSchema.safeParse(bad).success, false);
  });
});

describe("calendarPlanContentSchemaFor — hafta va soat tekshiruvi", () => {
  const params = { weeks: 9, hoursPerWeek: 2 };

  it("aniq mos kelsa o'tadi", () => {
    const result = calendarPlanContentSchemaFor(params).safeParse(content(9, 2));
    assert.equal(result.success, true);
  });

  it("kichik farqni KECHIRADI", () => {
    // 8 hafta ≈ 9 — amalda yaroqli natija, generatsiyani yiqitmasligi kerak.
    const result = calendarPlanContentSchemaFor(params).safeParse(content(8, 2));
    assert.equal(result.success, true);
  });

  it("mantiqsiz kam haftani rad etadi", () => {
    const result = calendarPlanContentSchemaFor(params).safeParse(content(2, 2));

    assert.equal(result.success, false);
    const issue = result.error!.issues.find((i) => i.path[0] === "weeks");
    assert.ok(issue);
    // Xabar modelga qayta so'rovda ketadi — aniq son bo'lsin.
    assert.match(issue.message, /9/);
  });

  it("mantiqsiz ko'p haftani rad etadi", () => {
    assert.equal(
      calendarPlanContentSchemaFor(params).safeParse(content(20, 2)).success,
      false,
    );
  });

  it("soat yig'indisi mantiqsiz bo'lsa rad etadi", () => {
    // 9 hafta, lekin har haftada 10 soat = 90 (kutilgani 18).
    const result = calendarPlanContentSchemaFor(params).safeParse(content(9, 10));

    assert.equal(result.success, false);
    const issue = result.error!.issues.find((i) => i.message.includes("Umumiy soat"));
    assert.ok(issue, "soat xatosi bo'lishi kerak");
    assert.match(issue.message, /18/);
  });

  it("boshqa parametrlar uchun chegara boshqacha", () => {
    // 24 hafta × 3 soat uchun 24 haftalik reja o'tadi...
    assert.equal(
      calendarPlanContentSchemaFor({ weeks: 24, hoursPerWeek: 3 }).safeParse(
        content(24, 3),
      ).success,
      true,
    );
    // ...lekin 9 hafta uchun o'tmaydi.
    assert.equal(
      calendarPlanContentSchemaFor(params).safeParse(content(24, 3)).success,
      false,
    );
  });
});

describe("totalRowCount va totalHours", () => {
  it("qatorlar va soatlarni to'g'ri sanaydi", () => {
    const parsed = calendarPlanContentSchema.parse({
      title: "Sarlavha matni",
      weeks: [week(1, [1, 1]), week(2, [2]), week(3, [1, 1, 1])],
    });

    assert.equal(totalRowCount(parsed), 6);
    assert.equal(totalHours(parsed), 7);
  });
});

describe("parseCalendarPlanContent", () => {
  it("to'g'ri kontentni qaytaradi", () => {
    const parsed = parseCalendarPlanContent(content());
    assert.ok(parsed);
    assert.equal(parsed.weeks.length, 9);
  });

  it("noto'g'ri shaklda null qaytaradi, xato TASHLAMAYDI", () => {
    assert.equal(parseCalendarPlanContent(null), null);
    assert.equal(parseCalendarPlanContent("matn"), null);
    assert.equal(parseCalendarPlanContent({}), null);
    assert.equal(parseCalendarPlanContent({ title: "eski shakl" }), null);
  });
});

describe("buildWeekRanges — sana hisoblash", () => {
  it("to'g'ri sonda hafta qaytaradi", () => {
    const ranges = buildWeekRanges(new Date("2026-09-14T00:00:00Z"), 9);
    assert.equal(ranges.length, 9);
    assert.equal(ranges[0].weekNumber, 1);
    assert.equal(ranges[8].weekNumber, 9);
  });

  it("har bir hafta 7 kun", () => {
    const ranges = buildWeekRanges(new Date("2026-09-14T00:00:00Z"), 3);

    assert.equal(ranges[0].label, "14.09.2026 – 20.09.2026");
    assert.equal(ranges[1].label, "21.09.2026 – 27.09.2026");
    assert.equal(ranges[2].label, "28.09.2026 – 04.10.2026");
  });

  it("OY chegarasidan to'g'ri o'tadi", () => {
    // 30 kunli sentabrdan oktabrga.
    const ranges = buildWeekRanges(new Date("2026-09-28T00:00:00Z"), 2);
    assert.equal(ranges[0].label, "28.09.2026 – 04.10.2026");
    assert.equal(ranges[1].label, "05.10.2026 – 11.10.2026");
  });

  it("YIL chegarasidan to'g'ri o'tadi", () => {
    const ranges = buildWeekRanges(new Date("2026-12-28T00:00:00Z"), 2);
    assert.equal(ranges[0].label, "28.12.2026 – 03.01.2027");
    assert.equal(ranges[1].label, "04.01.2027 – 10.01.2027");
  });

  it("KABISA yilida fevraldan to'g'ri o'tadi", () => {
    // 2028 — kabisa yili, fevral 29 kun.
    const ranges = buildWeekRanges(new Date("2028-02-26T00:00:00Z"), 2);
    assert.equal(ranges[0].label, "26.02.2028 – 03.03.2028");
    assert.equal(ranges[1].label, "04.03.2028 – 10.03.2028");
  });

  it("kabisa BO'LMAGAN yilda fevraldan to'g'ri o'tadi", () => {
    // 2027 — oddiy yil, fevral 28 kun.
    const ranges = buildWeekRanges(new Date("2027-02-26T00:00:00Z"), 1);
    assert.equal(ranges[0].label, "26.02.2027 – 04.03.2027");
  });

  it("eng uzun ruxsat etilgan davr (24 hafta) uchun to'g'ri ishlaydi", () => {
    const ranges = buildWeekRanges(new Date("2026-09-01T00:00:00Z"), 24);

    assert.equal(ranges.length, 24);
    // 24-hafta 23×7 = 161 kun keyin boshlanadi.
    assert.equal(ranges[23].label, "09.02.2027 – 15.02.2027");
  });
});

describe("calendarPlanListQuerySchema", () => {
  it("standart limit 20", () => {
    assert.equal(calendarPlanListQuerySchema.parse({}).limit, 20);
  });

  it("holat filtrini qabul qiladi", () => {
    assert.equal(
      calendarPlanListQuerySchema.parse({ status: "FAILED" }).status,
      "FAILED",
    );
  });
});
