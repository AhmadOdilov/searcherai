import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  EDIT_MAX_SLIDES,
  EDIT_MIN_SLIDES,
  MAX_SLIDES,
  MIN_SLIDES,
  generatedPresentationContentSchema,
  presentationEditSchema,
  parsePresentationContent,
  presentationContentSchema,
  presentationInputSchema,
  presentationListQuerySchema,
  type Slide,
} from "../lib/validations/presentation";

/**
 * Prezentatsiya sxemalari sinovlari — baza va AI kerak emas.
 */

function slide(overrides: Partial<Slide> = {}): Slide {
  return {
    type: "content",
    heading: "Slayd sarlavhasi",
    bullets: ["Birinchi band", "Ikkinchi band"],
    ...overrides,
  };
}

function slides(count: number): Slide[] {
  return Array.from({ length: count }, (_, index) =>
    slide({ heading: `Slayd ${index + 1}` }),
  );
}

describe("presentationInputSchema — dars ishlanmasi rejimi", () => {
  it("lessonPlanId bilan o'tadi", () => {
    const parsed = presentationInputSchema.parse({
      mode: "from-lesson-plan",
      lessonPlanId: "cmtwyd68o0002152e12qeo9zk",
    });

    assert.equal(parsed.mode, "from-lesson-plan");
    assert.equal(
      parsed.mode === "from-lesson-plan" ? parsed.lessonPlanId : null,
      "cmtwyd68o0002152e12qeo9zk",
    );
  });

  it("lessonPlanId BO'SH bo'lsa rad etadi", () => {
    const result = presentationInputSchema.safeParse({
      mode: "from-lesson-plan",
      lessonPlanId: "",
    });

    assert.equal(result.success, false);
    assert.ok(result.error!.issues.some((i) => i.path.includes("lessonPlanId")));
  });

  it("lessonPlanId umuman berilmasa rad etadi", () => {
    const result = presentationInputSchema.safeParse({ mode: "from-lesson-plan" });
    assert.equal(result.success, false);
  });

  it("lessonPlanId noto'g'ri TURDA bo'lsa rad etadi", () => {
    for (const lessonPlanId of [123, null, {}, []]) {
      const result = presentationInputSchema.safeParse({
        mode: "from-lesson-plan",
        lessonPlanId,
      });
      assert.equal(
        result.success,
        false,
        `${JSON.stringify(lessonPlanId)} rad etilishi kerak`,
      );
    }
  });

  it("bu rejimda topic BERILSA ham e'tiborsiz qoladi", () => {
    // Mavzu dars ishlanmasidan olinadi — so'rovdagi qiymat nomuvofiqlikka
    // olib kelmasligi kerak.
    const parsed = presentationInputSchema.parse({
      mode: "from-lesson-plan",
      lessonPlanId: "abc123",
      topic: "Butunlay boshqa mavzu",
      language: "EN",
    });

    assert.equal("topic" in parsed, false);
    assert.equal("language" in parsed, false);
  });
});

describe("presentationInputSchema — mustaqil rejim", () => {
  it("faqat mavzu bilan o'tadi", () => {
    const parsed = presentationInputSchema.parse({
      mode: "standalone",
      topic: "Fotosintez jarayoni",
    });

    assert.equal(parsed.mode, "standalone");
    if (parsed.mode === "standalone") {
      assert.equal(parsed.topic, "Fotosintez jarayoni");
      assert.equal(parsed.language, "UZ", "til ko'rsatilmasa UZ");
      assert.equal(parsed.subject, undefined);
      assert.equal(parsed.grade, undefined);
    }
  });

  it("fan va sinf bilan ham o'tadi", () => {
    const parsed = presentationInputSchema.parse({
      mode: "standalone",
      topic: "Fotosintez",
      subject: "Biologiya",
      grade: "7-sinf",
      language: "RU",
    });

    if (parsed.mode === "standalone") {
      assert.equal(parsed.subject, "Biologiya");
      assert.equal(parsed.grade, "7-sinf");
      assert.equal(parsed.language, "RU");
    }
  });

  it("mavzu bo'lmasa rad etadi", () => {
    const result = presentationInputSchema.safeParse({ mode: "standalone" });
    assert.equal(result.success, false);
  });

  it("juda qisqa mavzuni rad etadi", () => {
    const result = presentationInputSchema.safeParse({
      mode: "standalone",
      topic: "ab",
    });
    assert.equal(result.success, false);
  });

  it("bo'shliqni kesadi", () => {
    const parsed = presentationInputSchema.parse({
      mode: "standalone",
      topic: "  Fotosintez  ",
      subject: "  Biologiya  ",
    });

    if (parsed.mode === "standalone") {
      assert.equal(parsed.topic, "Fotosintez");
      assert.equal(parsed.subject, "Biologiya");
    }
  });
});

describe("presentationInputSchema — shablon", () => {
  it("shablon berilmasa STANDART shablon qo'yiladi", () => {
    // Eski mijoz (yoki sinov) shablonsiz so'rov yuborishi mumkin —
    // forma yiqilmasligi kerak.
    const parsed = presentationInputSchema.parse({
      mode: "standalone",
      topic: "Fotosintez jarayoni",
    });

    assert.equal(parsed.template, "klassik");
  });

  it("tanlangan shablon saqlanadi", () => {
    for (const template of ["klassik", "zamonaviy", "rangli"]) {
      const parsed = presentationInputSchema.parse({
        mode: "standalone",
        topic: "Fotosintez jarayoni",
        template,
      });
      assert.equal(parsed.template, template);
    }
  });

  it("dars ishlanmasi rejimida ham shablon tanlanadi", () => {
    const parsed = presentationInputSchema.parse({
      mode: "from-lesson-plan",
      lessonPlanId: "cmtwyd68o0002152e12qeo9zk",
      template: "zamonaviy",
    });

    assert.equal(parsed.template, "zamonaviy");
  });

  it("NOTANISH shablon nomi butun so'rovni yiqitmaydi", () => {
    /*
      Shablon — dizayn tanlovi, ma'lumot emas. Notanish nom kelganda
      (eski sahifa, qo'lda yuborilgan so'rov) formani rad etish o'rniga
      standart shablonga tushamiz: natijaning MAZMUNI baribir bir xil.
    */
    const parsed = presentationInputSchema.parse({
      mode: "standalone",
      topic: "Fotosintez jarayoni",
      template: "yo-q-shablon",
    });

    assert.equal(parsed.template, "klassik");
  });
});

describe("presentationInputSchema — rejim tanlanmagan holatlar", () => {
  it("mode yo'q bo'lsa rad etadi", () => {
    const result = presentationInputSchema.safeParse({ topic: "Fotosintez" });
    assert.equal(result.success, false);
  });

  it("noma'lum mode ni rad etadi", () => {
    const result = presentationInputSchema.safeParse({
      mode: "boshqa-rejim",
      topic: "Fotosintez",
    });
    assert.equal(result.success, false);
  });

  it("userId ni QABUL QILMAYDI", () => {
    const parsed = presentationInputSchema.parse({
      mode: "standalone",
      topic: "Fotosintez",
      userId: "begona-foydalanuvchi",
    });
    assert.equal("userId" in parsed, false);
  });
});

describe("presentationContentSchema", () => {
  it("to'g'ri slaydlarni qabul qiladi", () => {
    const result = presentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: slides(MIN_SLIDES),
    });
    assert.equal(result.success, true);
  });

  /*
    ── Slaydlar soni chegarasi bu yerdan KO'CHIRILDI ───────────────────────
    `presentationContentSchema` endi SAQLANGAN shaklni tasvirlaydi va
    o'qituvchining tahriri ham shundan o'tadi. Unga 6-10 chegarasini
    qo'ysak, o'qituvchi 4 slaydli qisqa mavzu yoki 14 slaydli ochiq dars
    tayyorlay olmasdi.

    AI javobiga qo'yiladigan qat'iy chegara `generatedPresentationContentSchema`
    ga o'tdi va quyida AYNAN shu sxemada tekshiriladi — ya'ni qamrov
    kamaymadi, ikkiga bo'lindi.
  */

  it("tahrirda BITTA slayd ham qabul qilinadi", () => {
    const result = presentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: slides(EDIT_MIN_SLIDES),
    });
    assert.equal(result.success, true, "o'qituvchi qisqa prezentatsiya yasay olmadi");
  });

  it("tahrirda MIN_SLIDES dan kam ham qabul qilinadi", () => {
    const result = presentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: slides(MIN_SLIDES - 2),
    });
    assert.equal(result.success, true);
  });

  it("BO'SH slaydlar massivini rad etadi", () => {
    // Slaydsiz prezentatsiya — yaroqsiz .pptx.
    const result = presentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: [],
    });
    assert.equal(result.success, false);
  });

  it(`tahrirda ham ${EDIT_MAX_SLIDES} tadan ko'p slaydni rad etadi`, () => {
    // Texnik himoya: juda katta JSON fayl yasashni sekinlashtiradi.
    const result = presentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: slides(EDIT_MAX_SLIDES + 1),
    });
    assert.equal(result.success, false);
  });

  it("sarlavha slaydida BO'SH bandlar massiviga ruxsat beradi", () => {
    const withEmptyBullets = slides(MIN_SLIDES);
    withEmptyBullets[0] = { type: "title", heading: "Sarlavha", bullets: [] };

    const result = presentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: withEmptyBullets,
    });
    assert.equal(result.success, true);
  });

  it("noma'lum slayd turini rad etadi", () => {
    const bad = slides(MIN_SLIDES);
    // @ts-expect-error — ataylab noto'g'ri tur
    bad[1].type = "video";

    const result = presentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: bad,
    });
    assert.equal(result.success, false);
  });

  it("JUDA UZUN bandni rad etadi (slaydga sig'maydi)", () => {
    const bad = slides(MIN_SLIDES);
    bad[1].bullets = ["x".repeat(300)];

    const result = presentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: bad,
    });

    assert.equal(result.success, false);
    const issue = result.error!.issues.find((i) => i.path.includes("bullets"));
    assert.ok(issue);
    // Xato xabari modelga qayta so'rovda yuboriladi — tushunarli bo'lsin.
    assert.match(issue.message, /sig'maydi/);
  });

  it("bitta slaydda 8 dan ko'p bandni rad etadi", () => {
    const bad = slides(MIN_SLIDES);
    bad[1].bullets = Array.from({ length: 9 }, (_, i) => `Band ${i + 1}`);

    const result = presentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: bad,
    });
    assert.equal(result.success, false);
  });

  it("so'zlovchi izohi ixtiyoriy", () => {
    const withNotes = slides(MIN_SLIDES);
    withNotes[1].speakerNotes = "Bu yerda doskada misol yozing.";

    const result = presentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: withNotes,
    });
    assert.equal(result.success, true);
  });

  it("sarlavhasiz rad etadi", () => {
    const result = presentationContentSchema.safeParse({
      slides: slides(MIN_SLIDES),
    });
    assert.equal(result.success, false);
  });
});

describe("generatedPresentationContentSchema — AI javobi", () => {
  /*
    Bu sxema faqat AI chaqiruvida ishlatiladi. Uning vazifasi —
    modelni 6-10 slayd yozishga majburlash: xato xabari modelga qayta
    so'rov bilan yuboriladi.
  */

  it("to'g'ri slaydlar sonini qabul qiladi", () => {
    const result = generatedPresentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: slides(MIN_SLIDES),
    });
    assert.equal(result.success, true);
  });

  it(`${MIN_SLIDES} dan kam slaydni rad etadi`, () => {
    const result = generatedPresentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: slides(MIN_SLIDES - 1),
    });

    assert.equal(result.success, false);
    assert.ok(result.error!.issues.some((i) => i.path[0] === "slides"));
  });

  it(`${MAX_SLIDES} dan ko'p slaydni rad etadi`, () => {
    const result = generatedPresentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: slides(MAX_SLIDES + 1),
    });
    assert.equal(result.success, false);
  });

  it("xato xabari modelga NIMA qilish kerakligini aytadi", () => {
    const result = generatedPresentationContentSchema.safeParse({
      title: "Fotosintez",
      slides: slides(MIN_SLIDES - 1),
    });

    const issue = result.error!.issues.find((i) => i.path[0] === "slides");
    assert.ok(issue);
    assert.match(issue.message, new RegExp(String(MIN_SLIDES)));
    assert.match(issue.message, new RegExp(String(MAX_SLIDES)));
  });
});

describe("presentationEditSchema — tahrir so'rovi", () => {
  const valid = { title: "Fotosintez", slides: slides(3) };

  it("to'g'ri tanani qabul qiladi", () => {
    const result = presentationEditSchema.safeParse({ content: valid });
    assert.equal(result.success, true);
  });

  it("NOTANISH maydonni rad etadi", () => {
    /*
      Zod odatda notanish maydonni jim tashlab yuboradi. Tahrirda bu
      xavfli: klient `conten` deb xato yozsa, so'rov muvaffaqiyatli
      qaytardi va hech narsa o'zgarmasdi.
    */
    const result = presentationEditSchema.safeParse({
      content: valid,
      status: "READY",
    });
    assert.equal(result.success, false, "notanish maydon o'tkazib yuborildi");
  });

  it("`content` siz rad etadi", () => {
    assert.equal(presentationEditSchema.safeParse({}).success, false);
  });

  it("buzuq slaydni rad etadi", () => {
    const result = presentationEditSchema.safeParse({
      content: { title: "Fotosintez", slides: [{ type: "video", heading: "x" }] },
    });
    assert.equal(result.success, false);
  });

  it("JUDA UZUN bandni rad etadi", () => {
    const bad = slides(2);
    bad[0].bullets = ["x".repeat(300)];

    const result = presentationEditSchema.safeParse({
      content: { title: "Fotosintez", slides: bad },
    });
    assert.equal(result.success, false);
  });
});

describe("parsePresentationContent — bazadan o'qish", () => {
  it("to'g'ri kontentni qaytaradi", () => {
    const parsed = parsePresentationContent({
      title: "Fotosintez",
      slides: slides(MIN_SLIDES),
    });

    assert.ok(parsed);
    assert.equal(parsed.slides.length, MIN_SLIDES);
  });

  it("noto'g'ri shaklda null qaytaradi, xato TASHLAMAYDI", () => {
    assert.equal(parsePresentationContent(null), null);
    assert.equal(parsePresentationContent("matn"), null);
    assert.equal(parsePresentationContent({}), null);
    assert.equal(parsePresentationContent({ title: "eski shakl" }), null);
  });
});

describe("presentationListQuerySchema", () => {
  it("standart limit 20", () => {
    assert.equal(presentationListQuerySchema.parse({}).limit, 20);
  });

  it("holat filtrini qabul qiladi", () => {
    assert.equal(presentationListQuerySchema.parse({ status: "READY" }).status, "READY");
  });

  it("noto'g'ri holatni rad etadi", () => {
    assert.equal(
      presentationListQuerySchema.safeParse({ status: "BOSHQA" }).success,
      false,
    );
  });
});
