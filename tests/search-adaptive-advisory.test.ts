import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { determineAdaptiveStrategy } from "../lib/search/adaptive";
import { understandQuery } from "../lib/search/understanding";
import { getCurriculumCoverage, canProvideOfficialEvidence } from "../lib/curriculum/coverage";

/*
  V6 PHASE 5 — tavsiyaviy (advisory) maydonlar.

  `AdaptiveSearchStrategy.shouldAbstain` va `.candidateDepth` quvurda
  MAJBURIY EMAS. Ular kuzatuv uchun qoldirilgan, lekin haqiqiy xatti-harakat
  bilan jimgina ajralib ketmasligi kerak — shuning uchun moslik shu yerda
  tekshiriladi.
*/
describe("adaptiv strategiya — tavsiyaviy maydonlar", () => {
  it("shouldAbstain=true bo'lsa, qamrov qatlami ham dalil bermasligi kerak", () => {
    const u = understandQuery("7-sinf fizika Nyuton qonunlari");
    const strategy = determineAdaptiveStrategy(u);

    assert.equal(strategy.shouldAbstain, true);
    // Haqiqiy qaror shu yerda qabul qilinadi:
    const coverage = getCurriculumCoverage(u.detectedSubject, u.detectedGrade);
    assert.equal(canProvideOfficialEvidence(coverage), false);
  });

  it("qamrov qatlami shouldAbstain BILMAGAN holatni ham tutadi (sinf darajasi)", () => {
    /*
      Bu aynan `shouldAbstain` ning cheklovi: u faqat FAN darajasini
      biladi. 1-sinf matematika uchun u `false` qaytaradi, chunki
      Matematika reyestrda OFFICIAL. Sinf qamrovini esa qamrov qatlami
      hal qiladi.
    */
    const u = understandQuery("1-sinf matematika sonlarni qo'shish");
    const strategy = determineAdaptiveStrategy(u);

    assert.equal(strategy.shouldAbstain, false, "fan darajasidagi ishora bu holatni ko'rmaydi");

    const coverage = getCurriculumCoverage(u.detectedSubject, u.detectedGrade);
    assert.equal(coverage.status, "GRADE_NOT_AVAILABLE");
    assert.equal(canProvideOfficialEvidence(coverage), false, "qamrov qatlami uni tutadi");
  });

  it("qamrovli so'rovda ikkala qatlam ham dalilga ruxsat beradi", () => {
    const u = understandQuery("8-sinf matematika kvadrat tenglamalar");
    const strategy = determineAdaptiveStrategy(u);

    assert.equal(strategy.shouldAbstain, false);
    assert.equal(canProvideOfficialEvidence(getCurriculumCoverage(u.detectedSubject, u.detectedGrade)), true);
  });

  it("candidateDepth musbat va finalLimit dan katta bo'lishi kerak", () => {
    for (const q of [
      "fotosintez",
      "8-sinf matematika kvadrat tenglamalarni taqqosla va dars ishlanma tayyorla",
      "5-sinf matematika kasrlar",
    ]) {
      const strategy = determineAdaptiveStrategy(understandQuery(q));
      assert.ok(strategy.candidateDepth > 0, q);
      assert.ok(strategy.candidateDepth >= strategy.finalLimit, q);
    }
  });
});
