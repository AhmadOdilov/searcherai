import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateAndGroundAnswer } from "../lib/search/validator";
import { understandQuery } from "../lib/search/understanding";
import type { RankedCurriculumMatch } from "../lib/search/curriculum-matcher";
import type { SearchAnswer } from "../lib/validations/search";

/*
  V6 PHASE 2 — ziddiyatlarning semantik toifasi.

  V5 da validator ikki mutlaqo boshqa hodisani bitta "contradicted"
  statusiga qo'shardi: javobning dalilga zidligi va sinf tafovuti
  ogohlantirishi. Endi ular `conflictType` bilan ajratiladi.
*/

function match(partial: Partial<RankedCurriculumMatch> = {}): RankedCurriculumMatch {
  return {
    sourceId: "dts_test0000000000000001",
    sourceVersion: "DTS-UZBMB-2025-v1",
    curriculumYear: 2025,
    topicName: "KVADRAT TENGLAMALAR",
    subject: "Matematika",
    grade: "8-sinf",
    description: "Kvadrat tenglama ta'rifi, diskriminant, Viet teoremasi.",
    expectedHours: 20,
    expectedOutcomes: ["kvadrat tenglamani yecha oladi"],
    source: "https://uzbmb.uz/upload/file/pdf/qabul2025/x.pdf",
    score: 0.9,
    exactMatch: true,
    crossGradeMatch: false,
    isCrossGrade: false,
    scoreBreakdown: {
      exactMatch: 1,
      semanticSimilarity: 0.8,
      outcomeMatch: 1,
      gradeSubjectMatch: 1,
      intentMatch: 0.8,
    },
    ...partial,
  };
}

const baseAnswer: SearchAnswer = {
  answer:
    "Kvadrat tenglama ax kvadrat + bx + c = 0 ko'rinishidagi tenglamadir va diskriminant orqali yechiladi.",
  keyPoints: ["Ta'rif", "Diskriminant", "Viet teoremasi"],
  classroomIdeas: ["Doskada birgalikda yechish", "Juftlikda mashq bajarish"],
};

describe("ziddiyat toifalari (V6)", () => {
  const u = understandQuery("8-sinf matematika kvadrat tenglamalar");

  it("soatlar tafovuti FACTUAL_CONTRADICTION deb belgilanadi", () => {
    const answer: SearchAnswer = {
      ...baseAnswer,
      answer:
        "Rasmiy o'quv dasturida ushbu bo'lim uchun 60 soat ajratilgan va u chuqur o'rganiladi.",
    };
    const result = validateAndGroundAnswer(answer, u, [match()]);
    const conflict = result.claims.find((c) => c.status === "contradicted");

    assert.ok(conflict, "ziddiyat topilishi kerak");
    assert.equal(conflict.conflictType, "FACTUAL_CONTRADICTION");
    assert.ok(result.factualContradictionRate > 0);
    assert.equal(result.gradeConflictRate, 0);
  });

  it("sinf tafovuti GRADE_CONFLICT deb belgilanadi, FACTUAL emas", () => {
    const crossGrade = understandQuery("5-sinf matematika kvadrat tenglamalar");
    const result = validateAndGroundAnswer(baseAnswer, crossGrade, [
      match({ isCrossGrade: true, requestedGrade: "5-sinf", availableGrade: "8-sinf" }),
    ]);
    const conflict = result.claims.find((c) => c.status === "contradicted");

    assert.ok(conflict);
    assert.equal(conflict.conflictType, "GRADE_CONFLICT");
    assert.equal(
      result.factualContradictionRate,
      0,
      "sinf tafovuti FAKTIK ziddiyat emas",
    );
    assert.ok(result.gradeConflictRate > 0);
  });

  it("cross-grade javob HAMON rasmiy tasdiq olmaydi (xatti-harakat o'zgarmadi)", () => {
    const crossGrade = understandQuery("5-sinf matematika kvadrat tenglamalar");
    const result = validateAndGroundAnswer(baseAnswer, crossGrade, [
      match({ isCrossGrade: true, requestedGrade: "5-sinf", availableGrade: "8-sinf" }),
    ]);
    assert.equal(result.isGrounded, false);
  });

  it("to'g'ri soat ko'rsatilganda ziddiyat YO'Q", () => {
    const answer: SearchAnswer = {
      ...baseAnswer,
      answer:
        "Rasmiy o'quv dasturida ushbu bo'lim uchun 20 soat ajratilgan va u bosqichma-bosqich o'rganiladi.",
    };
    const result = validateAndGroundAnswer(answer, u, [match()]);
    assert.equal(result.factualContradictionRate, 0);
    assert.equal(result.contradictionRate, 0);
  });
});

describe("SOURCE_CONFLICT — to'qib chiqarilgan bo'lim nomi (yangi himoya)", () => {
  const u = understandQuery("8-sinf matematika kvadrat tenglamalar");

  it("javob dalillar orasida yo'q rasmiy bo'limga havola qilsa tutiladi", () => {
    const answer: SearchAnswer = {
      ...baseAnswer,
      answer:
        "Rasmiy o'quv dasturidagi «KOMPLEKS SONLAR VA ULARNING TATBIQLARI» bo'limiga ko'ra bu mavzu chuqur o'rganiladi.",
    };
    const result = validateAndGroundAnswer(answer, u, [match()]);
    const conflict = result.claims.find((c) => c.conflictType === "SOURCE_CONFLICT");

    assert.ok(conflict, "to'qib chiqarilgan bo'lim nomi tutilishi kerak");
    assert.ok(result.sourceConflictRate > 0);
    assert.ok(result.contradictions.some((c) => c.includes("KOMPLEKS SONLAR")));
  });

  it("dalildagi HAQIQIY bo'lim nomi ziddiyat deb belgilanmaydi", () => {
    const answer: SearchAnswer = {
      ...baseAnswer,
      answer:
        "Rasmiy o'quv dasturidagi «KVADRAT TENGLAMALAR» bo'limi ushbu mavzuni to'liq qamrab oladi va amaliy mashqlar beradi.",
    };
    const result = validateAndGroundAnswer(answer, u, [match()]);
    assert.equal(result.sourceConflictRate, 0);
  });

  it("rasmiy dastur deb da'vo qilinmagan oddiy iqtibos tegilmaydi", () => {
    const answer: SearchAnswer = {
      ...baseAnswer,
      answer:
        "O'quvchilarga «diskriminant nima?» degan savolni berib, mavzuni muhokamadan boshlash samarali bo'ladi.",
    };
    const result = validateAndGroundAnswer(answer, u, [match()]);
    assert.equal(result.sourceConflictRate, 0);
  });
});
