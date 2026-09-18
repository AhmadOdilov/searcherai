import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCurriculumCoverage, canProvideOfficialEvidence } from "../lib/curriculum/coverage";
import { CURRICULUM_SUBJECT_REGISTRY } from "../lib/curriculum/ingestion/registry";

/*
  V6 PHASE 3 — sinf darajasidagi qamrov tekshiruvi.

  V5 da qamrov faqat FAN darajasida tekshirilardi. Oqibati:
    «1-sinf matematika ... sonlarni qo'shish» -> 5-sinf bo'limi, ball 0.6602
    «4-sinf matematika oddiy kasrlar»         -> 5-sinf bo'limi, ball 0.8227
  Ya'ni raqamlashtirilmagan sinf uchun eng yaqin sinf dalili "sinf tafovuti"
  ogohlantirishi bilan qonuniylashtirilardi.
*/
describe("o'quv dasturi qamrovi", () => {
  it("raqamlashtirilgan sinf COVERED", () => {
    const c = getCurriculumCoverage("Matematika", "8-sinf");
    assert.equal(c.status, "COVERED");
    assert.equal(canProvideOfficialEvidence(c), true);
  });

  for (const grade of ["1-sinf", "2-sinf", "3-sinf", "4-sinf"]) {
    it(`boshlang'ich ${grade} GRADE_NOT_AVAILABLE`, () => {
      const c = getCurriculumCoverage("Matematika", grade);
      assert.equal(c.status, "GRADE_NOT_AVAILABLE");
      assert.equal(canProvideOfficialEvidence(c), false);
      assert.ok(c.availableGrades.length > 0, "mavjud sinflar ro'yxati berilishi kerak");
    });
  }

  it("rasmiy dasturi yo'q fan SUBJECT_NOT_AVAILABLE", () => {
    const c = getCurriculumCoverage("Fizika", "7-sinf");
    assert.equal(c.status, "SUBJECT_NOT_AVAILABLE");
    assert.equal(canProvideOfficialEvidence(c), false);
  });

  it("sinf berilmasa qamrov FAN darajasida baholanadi", () => {
    assert.equal(getCurriculumCoverage("Matematika", undefined).status, "COVERED");
    assert.equal(getCurriculumCoverage("Fizika", undefined).status, "SUBJECT_NOT_AVAILABLE");
  });

  it("fan aniqlanmagan bo'lsa qidiruv bloklanmaydi", () => {
    const c = getCurriculumCoverage(undefined, "8-sinf");
    assert.equal(c.status, "UNKNOWN_SUBJECT");
    assert.equal(canProvideOfficialEvidence(c), true);
  });

  it("reyestrdagi har bir OFFICIAL sinf COVERED bo'lishi shart", () => {
    for (const entry of Object.values(CURRICULUM_SUBJECT_REGISTRY)) {
      if (entry.status !== "OFFICIAL") continue;
      for (const grade of entry.gradesAvailable) {
        assert.equal(
          getCurriculumCoverage(entry.subject, grade).status,
          "COVERED",
          `${entry.subject} ${grade}`,
        );
      }
    }
  });

  it("registr sinf ro'yxati bo'sh bo'lgan fan hech qachon dalil bermaydi", () => {
    for (const entry of Object.values(CURRICULUM_SUBJECT_REGISTRY)) {
      if (entry.status === "OFFICIAL") continue;
      const c = getCurriculumCoverage(entry.subject, "7-sinf");
      assert.equal(canProvideOfficialEvidence(c), false, entry.subject);
    }
  });
});
