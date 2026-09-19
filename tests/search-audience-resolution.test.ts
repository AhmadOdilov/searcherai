import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  understandQuery,
  detectAudienceDetails,
  resolveEffectiveAudience,
} from "../lib/search/understanding";
import { rerankCandidates, type RerankerCandidate } from "../lib/search/reranker";

/*
  V6 PHASE 1 — auditoriya holati (AudienceResolution).

  V5 da faqat ikkilik "teacher" | "student" bor edi va "foydalanuvchi aytdi"
  bilan "biz taxmin qildik" farqlanmasdi.
*/

describe("auditoriya — ANIQ markerlar (regressiya himoyasi)", () => {
  const explicitTeacher = [
    "5-sinf matematika kasrlar o'qituvchi uchun dars ishlanma",
    "kvadrat tenglamalar bo'yicha konspekt kerak",
    "квадратные уравнения 8 класс для учителя",
    "fractions grade 5 lesson plan for teachers",
  ];

  const explicitStudent = [
    "fotosintezni bolaga tushuntir",
    "kasrlarni o'quvchiga tushuntirib ber",
    "дроби 5 класс объясни для ученика",
    "explain fractions for students grade 5",
  ];

  for (const q of explicitTeacher) {
    it(`EXPLICIT_TEACHER: ${q}`, () => {
      const u = understandQuery(q);
      assert.equal(u.audience, "teacher");
      assert.equal(u.audienceResolution, "EXPLICIT_TEACHER");
      assert.equal(u.audienceIsExplicit, true);
    });
  }

  for (const q of explicitStudent) {
    it(`EXPLICIT_STUDENT: ${q}`, () => {
      const u = understandQuery(q);
      assert.equal(u.audience, "student");
      assert.equal(u.audienceResolution, "EXPLICIT_STUDENT");
      assert.equal(u.audienceIsExplicit, true);
    });
  }
});

describe("auditoriya — XULOSA va UNKNOWN", () => {
  it("uslub so'rovi XULOSA deb belgilanadi, aniq marker deb emas", () => {
    const u = understandQuery("fotosintezni oddiy qilib tushuntir");
    assert.equal(u.audience, "student");
    assert.equal(u.audienceResolution, "INFERRED_STUDENT");
    assert.equal(u.audienceIsExplicit, false);
  });

  it("ruscha uslub so'rovi ham XULOSA beradi", () => {
    const u = understandQuery("производная функции 10 класс объяснение простыми словами");
    assert.equal(u.audience, "student");
    assert.equal(u.audienceResolution, "INFERRED_STUDENT");
  });

  it("o'qituvchi artefakti intenti XULOSA_TEACHER beradi", () => {
    const u = understandQuery("5-sinf matematika kasrlar bo'yicha prezentatsiya");
    assert.equal(u.audienceResolution, "INFERRED_TEACHER");
    assert.equal(u.audienceIsExplicit, false);
  });

  it("hech qanday dalil bo'lmasa UNKNOWN qaytadi", () => {
    const u = understandQuery("fotosintez nima");
    assert.equal(u.audienceResolution, "UNKNOWN");
    assert.equal(u.audienceIsExplicit, false);
  });

  it("UNKNOWN yashirilmaydi — u aniq holat sifatida ko'rinadi", () => {
    const detection = detectAudienceDetails("kvadrat tenglama", "explain");
    assert.equal(detection.resolution, "UNKNOWN");
    // Amaldagi rejim mahsulot standarti, aniqlangan fakt emas.
    assert.equal(detection.audience, resolveEffectiveAudience("UNKNOWN"));
    assert.ok(detection.confidence < 0.6, "UNKNOWN past ishonch bilan qaytishi kerak");
  });
});

describe("auditoriya — DALILSIZ xulosa olib tashlandi (V6)", () => {
  /*
    V5 da `intent === "homework" || intent === "solve"` -> "student" qoidasi
    bor edi. 500 so'rovli datasetda u 32 marta ishlagan va 32 martasida ham
    NOTO'G'RI bo'lgan: "mustaqil ish topshiriqlari" ni O'QITUVCHI yozadi.
  */
  it("topshiriq TAYYORLASH so'rovi o'quvchi deb belgilanmaydi", () => {
    const u = understandQuery(
      "6-sinf biologiya ildiz va barg tuzilishi mustaqil ish topshiriqlari",
    );
    assert.notEqual(u.audienceResolution, "INFERRED_STUDENT");
    assert.notEqual(u.audienceResolution, "EXPLICIT_STUDENT");
  });

  it("inglizcha homework so'rovi ham avtomatik o'quvchi emas", () => {
    const u = understandQuery("grade 8 physics electric circuit and Ohm's law homework");
    assert.equal(u.audience, "teacher");
  });

  it("lekin O'Z uy vazifasi haqidagi so'rov ANIQ o'quvchi bo'lib qoladi", () => {
    const u = understandQuery("uy vazifam bor, kvadrat tenglamani yechishga yordam ber");
    assert.equal(u.audience, "student");
    assert.equal(u.audienceResolution, "EXPLICIT_STUDENT");
  });
});

describe("auditoriya noaniqligi RANKINGGA ta'sir qilmaydi", () => {
  /*
    Talab: "Audience uncertainty search rankingni noto'g'ri yo'naltirmasin."
    Reranker auditoriyani umuman ko'rmaydi — bu testni buzmasdan o'zgartirib
    bo'lmaydi.
  */
  const candidates: RerankerCandidate[] = [
    {
      id: "a",
      topicName: "KVADRAT TENGLAMALAR",
      description: "Kvadrat tenglama ta'rifi, diskriminant.",
      expectedHours: 20,
      expectedOutcomes: ["kvadrat tenglamani yechadi"],
      source: "https://uzbmb.uz/qabul2025/x.pdf",
      subject: "Matematika",
      grade: "8-sinf",
    },
    {
      id: "b",
      topicName: "TENGSIZLIKLAR",
      description: "Tengsizliklar va ularning xossalari.",
      expectedHours: 12,
      expectedOutcomes: [],
      source: "https://uzbmb.uz/qabul2025/x.pdf",
      subject: "Matematika",
      grade: "8-sinf",
    },
  ];

  it("bir xil mavzu turli auditoriyada AYNAN bir xil reyting oladi", async () => {
    const teacherQuery = understandQuery(
      "8-sinf matematika kvadrat tenglama o'qituvchi uchun",
    );
    const studentQuery = understandQuery(
      "8-sinf matematika kvadrat tenglama bolaga tushuntir",
    );
    const unknownQuery = understandQuery("8-sinf matematika kvadrat tenglama");

    assert.equal(teacherQuery.audienceResolution, "EXPLICIT_TEACHER");
    assert.equal(studentQuery.audienceResolution, "EXPLICIT_STUDENT");
    assert.equal(unknownQuery.audienceResolution, "UNKNOWN");

    const [teacherTop] = await rerankCandidates(candidates, teacherQuery, 2);
    const [studentTop] = await rerankCandidates(candidates, studentQuery, 2);
    const [unknownTop] = await rerankCandidates(candidates, unknownQuery, 2);

    assert.equal(teacherTop.sourceId, "a");
    assert.equal(studentTop.sourceId, "a");
    assert.equal(unknownTop.sourceId, "a");
  });
});
