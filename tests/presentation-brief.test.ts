import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBrief,
  parseAudienceAge,
  parseExplicitSlideCount,
} from "../lib/presentations/brief";
import { MAX_SLIDES, MIN_SLIDES } from "../lib/validations/presentation";
import type { LessonPlanContent } from "../lib/validations/lesson-plan";

/**
 * BRIF sinovlari.
 *
 * Brif — generatsiyaning eng muhim deterministik qismi: u slaydlar
 * sonini, arxetipni va auditoriyani hal qiladi. Bu yerdagi xato butun
 * prezentatsiyaning shaklini buzadi, lekin AI javobi ichida yashirinib
 * qoladi — shuning uchun alohida va batafsil tekshiriladi.
 */

function brief(topic: string, overrides: Partial<Parameters<typeof buildBrief>[0]> = {}) {
  return buildBrief({ topic, language: "UZ", ...overrides });
}

describe("parseExplicitSlideCount", () => {
  it("o'zbekcha shakllarni o'qiydi", () => {
    assert.equal(parseExplicitSlideCount("AI haqida 10 ta slayd"), 10);
    assert.equal(parseExplicitSlideCount("7 slayd tayyorla"), 7);
    assert.equal(parseExplicitSlideCount("slaydlar soni 12 bo'lsin"), 12);
  });

  it("inglizcha va ruscha shakllarni o'qiydi", () => {
    assert.equal(parseExplicitSlideCount("Create exactly 10 slides about AI"), 10);
    assert.equal(parseExplicitSlideCount("a 7-slide quarterly business report"), 7);
    assert.equal(parseExplicitSlideCount("Презентация на 8 слайдов"), 8);
  });

  it("SINF raqamini slayd soni deb OLMAYDI", () => {
    // Bu eng xavfli chalkashlik: "5-sinf" bilan "5 slayd" bir xil
    // raqamga ega, lekin butunlay boshqa narsa.
    assert.equal(parseExplicitSlideCount("5-sinf uchun fotosintez"), null);
    assert.equal(parseExplicitSlideCount("8-sinf matematika, kvadrat tenglamalar"), null);
  });

  it("yil va boshqa raqamlarni olmaydi", () => {
    assert.equal(parseExplicitSlideCount("2024 yil hisoboti"), null);
    assert.equal(parseExplicitSlideCount("Ikkinchi jahon urushi 1939-1945"), null);
  });

  it("chegaradan tashqaridagi sonni rad etadi", () => {
    assert.equal(parseExplicitSlideCount("100 ta slayd qil"), null);
    assert.equal(parseExplicitSlideCount("2 ta slayd qil"), null);
  });
});

describe("parseAudienceAge", () => {
  it("yoshni uch tilda o'qiydi", () => {
    assert.equal(parseAudienceAge("12 yoshli o'quvchilarga tushuntir"), 12);
    assert.equal(parseAudienceAge("explain to 12-year-old students"), 12);
    assert.equal(parseAudienceAge("для 12 летних школьников"), 12);
  });

  it("mantiqsiz yoshni rad etadi", () => {
    assert.equal(parseAudienceAge("80 yoshli"), null);
    assert.equal(parseAudienceAge("fotosintez"), null);
  });
});

describe("buildBrief — arxetip", () => {
  it("investor signali investor arxetipini beradi", () => {
    const result = brief("O'zbekistondagi AI startaplar, investorlar uchun");
    assert.equal(result.archetype, "investor");
    assert.equal(result.archetypeLocked, true);
    assert.equal(result.audience, "investors");
    assert.equal(result.purpose, "persuade");
  });

  it("hisobot signali report arxetipini beradi", () => {
    const result = brief("Chorak biznes hisoboti");
    assert.equal(result.archetype, "report");
    assert.equal(result.purpose, "report");
  });

  it("ta'lim signali educational arxetipini beradi", () => {
    const result = brief("Fotosintezni o'quvchilarga tushuntirish");
    assert.equal(result.archetype, "educational");
    assert.equal(result.audience, "students");
  });

  it("biznes signali business arxetipini beradi", () => {
    const result = brief("Yangi biznes strategiya taklifi");
    assert.equal(result.archetype, "business");
  });

  it("signal yo'q bo'lsa ta'limiyga tushadi, lekin QULFLANMAYDI", () => {
    // Searcher AI o'qituvchilar mahsuloti — standart taxmin ta'limiy.
    // Lekin signal bo'lmagani uchun AI uni almashtira oladi.
    const result = brief("Sun'iy intellekt");
    assert.equal(result.archetype, "educational");
    assert.equal(result.archetypeLocked, false);
  });

  it("dars ishlanmasi HAR DOIM ta'limiy va qulflangan", () => {
    const lessonPlan: LessonPlanContent = {
      objective: "Maqsad",
      outcomes: ["Natija"],
      resources: ["Doska"],
      stages: [
        {
          name: "Kirish",
          durationMinutes: 5,
          description: "Tavsif",
          teacherActivity: "A",
          studentActivity: "B",
        },
      ],
      assessmentCriteria: ["Mezon"],
    };

    // Mavzuda investor signali bo'lsa ham dars ustun turadi.
    const result = brief("Startap investitsiyalari", { lessonPlan });
    assert.equal(result.archetype, "educational");
    assert.equal(result.archetypeLocked, true);
  });
});

describe("buildBrief — slaydlar soni", () => {
  it("aniq aytilgan son AYNAN bajariladi", () => {
    const result = brief("Create exactly 10 slides about AI startups for investors");
    assert.equal(result.slideCount.value, 10);
    assert.equal(result.slideCount.source, "explicit");
  });

  it("aytilmagan bo'lsa mavzu kengligidan hisoblanadi", () => {
    const result = brief("Sun'iy intellekt");
    assert.equal(result.slideCount.source, "scope");
    assert.ok(
      result.slideCount.value >= MIN_SLIDES && result.slideCount.value <= MAX_SLIDES,
      `son chegaradan chiqdi: ${result.slideCount.value}`,
    );
  });

  it("keng mavzu KO'PROQ slayd oladi", () => {
    const narrow = brief("Fotosintez");
    const wide = brief(
      "Sun'iy intellekt: tarixi, turlari, qo'llanish sohalari, xavflari va kelajagi",
    );
    assert.ok(
      wide.slideCount.value > narrow.slideCount.value,
      `keng mavzu ko'proq slayd olishi kerak: ${wide.slideCount.value} vs ${narrow.slideCount.value}`,
    );
  });

  it('"qisqacha" so\'rovi KAMROQ slayd oladi', () => {
    const normal = brief("Fotosintez jarayoni");
    const short = brief("Fotosintez jarayoni haqida qisqacha");
    assert.ok(
      short.slideCount.value <= normal.slideCount.value,
      "qisqacha so'rov ko'proq slayd olmasligi kerak",
    );
  });

  it("dars ishlanmasida son BOSQICHLARDAN keladi", () => {
    const lessonPlan: LessonPlanContent = {
      objective: "Maqsad",
      outcomes: ["Natija"],
      resources: ["Doska"],
      stages: Array.from({ length: 5 }, (_, index) => ({
        name: `Bosqich ${index + 1}`,
        durationMinutes: 9,
        description: "Tavsif",
        teacherActivity: "A",
        studentActivity: "B",
      })),
      assessmentCriteria: ["Mezon"],
    };

    const result = brief("Fotosintez", { lessonPlan });
    // 5 bosqich + muqova + xulosa
    assert.equal(result.slideCount.value, 7);
    assert.equal(result.slideCount.source, "structure");
  });
});

describe("buildBrief — auditoriya yoshi", () => {
  it("matndagi yoshni oladi", () => {
    const result = brief("Fotosintezni 12 yoshli o'quvchilarga tushuntir");
    assert.equal(result.audienceAge, 12);
  });

  it("yosh aytilmasa SINFdan taxmin qiladi", () => {
    const result = brief("Kvadrat tenglamalar", { grade: "8-sinf" });
    assert.equal(result.audienceAge, 14);
  });

  it("ikkalasi ham yo'q bo'lsa null", () => {
    assert.equal(brief("Sun'iy intellekt").audienceAge, null);
  });
});
