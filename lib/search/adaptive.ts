/**
 * Adaptive Search & Complexity Routing (Phase 20 & 21).
 *
 * Vazifasi:
 *  1. So'rovning murakkabligini (Complexity) aniqlash:
 *     - Easy: qisqa, aniq savollar -> Top 5 nomzod, tezkor hisob.
 *     - Medium: odatiy pedagogik savollar -> Top 10 nomzod.
 *     - Hard: ko'p qirrali, taqqoslash yoki dars ishlanma -> Top 20 nomzod + Reranker.
 *     - Ambiguous: ko'p ma'noli atamalar (masalan "massa", "ildiz") -> Query Clarification taklifi.
 *     - Unsupported: rasmiy dasturda yo'q mavzular -> Abstention / ehtiyotkor javob.
 *  2. Query Clarification: noaniq so'rovlarda foydalanuvchiga aniqlashtiruvchi variantlar berish.
 */

import type { QueryUnderstanding } from "./understanding";
import { getSubjectCurriculumStatus } from "../curriculum/ingestion/registry";

export type QueryComplexity = "easy" | "medium" | "hard" | "ambiguous" | "unsupported";

export interface ClarificationOption {
  label: string;
  subject: string;
}

export interface AdaptiveSearchStrategy {
  complexity: QueryComplexity;

  /**
   * TAVSIYAVIY nomzodlar chuqurligi — quvurda MAJBURIY EMAS.
   *
   * ── Nega ulanmagan (o'lchangan qaror, V6) ───────────────────────────────
   * `matchCurriculumTopics` nomzodlar sonini 50 ga qat'iy belgilaydi.
   * Bu qiymatni quvurga ulash sinab ko'rildi va 216 ta gold dalilli
   * so'rovda o'lchandi:
   *
   *   qat'iy 50     Recall@1 90.28%  Recall@5 98.61%  o'rtacha nomzod 10.33
   *   adaptiv       Recall@1 90.28%  Recall@5 98.15%  o'rtacha nomzod 10.07
   *
   * Ya'ni u Recall@5 ni pasaytiradi va deyarli hech narsa tejamaydi
   * (bazada 121 bo'lim bor, `take` amalda kamdan-kam ishlaydi).
   * Shuning uchun u ATAYLAB ulanmagan va kuzatuv/diagnostika uchun
   * qoldirilgan. Baza sezilarli kattalashsa, qaror qayta o'lchanishi kerak.
   */
  candidateDepth: number;

  finalLimit: number;
  needsClarification: boolean;
  clarification?: {
    question: string;
    options: ClarificationOption[];
  };

  /**
   * TAVSIYAVIY ehtiyotkorlik ishorasi — quvurda MAJBURIY EMAS.
   *
   * Haqiqiy ehtiyotkorlik `lib/curriculum/coverage.ts` da amalga oshiriladi:
   * `retrieveCurriculumCandidates` qamrov bo'lmaganda BO'SH ro'yxat
   * qaytaradi va validator "rasmiy dalil yo'q" holatiga o'tadi. Bu qatlam
   * fan darajasini ham, SINF darajasini ham qamraydi, bu maydon esa faqat
   * fan darajasini bilardi.
   *
   * Maydon kuzatuv uchun qoldirilgan; u bilan haqiqiy xatti-harakat
   * o'rtasidagi moslik `tests/search-adaptive-advisory.test.ts` da
   * tekshiriladi, ya'ni jimgina ajralib keta olmaydi.
   */
  shouldAbstain: boolean;
  abstainReason?: string;
}

export function determineAdaptiveStrategy(
  understanding: QueryUnderstanding,
): AdaptiveSearchStrategy {
  // 1. Polisemik va noaniq so'rovlarni tekshirish (Phase 21 Clarification)
  const isAmbiguous =
    Boolean(understanding.ambiguityFlags?.isSubjectAmbiguous) ||
    Boolean(understanding.isAmbiguous);

  if (isAmbiguous && understanding.ambiguityFlags?.candidateSubjects && understanding.ambiguityFlags.candidateSubjects.length > 1) {
    const candidates = understanding.ambiguityFlags.candidateSubjects;
    const term = understanding.ambiguityTerm ?? understanding.topic;

    const question =
      understanding.language === "RU"
        ? `В контексте какого предмета вы ищете «${term}»?`
        : understanding.language === "EN"
        ? `In the context of which subject are you searching for "${term}"?`
        : `«${term}» tushunchasini qaysi fan kontekstida qidiryapsiz?`;

    const options: ClarificationOption[] = candidates.map((subj) => ({
      label: subj,
      subject: subj,
    }));

    return {
      complexity: "ambiguous",
      candidateDepth: 10,
      finalLimit: 3,
      needsClarification: true,
      clarification: {
        question,
        options,
      },
      shouldAbstain: false,
    };
  }

  // 2. Raqamlashtirilmagan / qo'llab-quvvatlanmagan fanlarni tekshirish (Phase 20 Unsupported)
  if (understanding.subject) {
    const registryInfo = getSubjectCurriculumStatus(understanding.subject);
    if (registryInfo?.status === "NOT_AVAILABLE") {
      return {
        complexity: "unsupported",
        candidateDepth: 5,
        finalLimit: 3,
        needsClarification: false,
        shouldAbstain: true,
        abstainReason: `«${understanding.subject}» fani bo'yicha rasmiy DTS o'quv dasturi hozircha raqamlashtirilmagan.`,
      };
    }
  }

  // 3. Murakkablikni baholash (Easy, Medium, Hard)
  const wordCount = (understanding.normalizedQuery || understanding.topic).trim().split(/\s+/).length;
  const isHardIntent =
    understanding.intent === "compare" ||
    understanding.intent === "lesson_plan" ||
    understanding.intent === "curriculum" ||
    understanding.intent === "exam_prep";

  if (wordCount >= 7 || isHardIntent || understanding.ambiguityFlags?.isPolysemic) {
    return {
      complexity: "hard",
      candidateDepth: 20,
      finalLimit: 5,
      needsClarification: false,
      shouldAbstain: false,
    };
  }

  if (wordCount <= 3 && !understanding.grade) {
    return {
      complexity: "easy",
      candidateDepth: 5,
      finalLimit: 3,
      needsClarification: false,
      shouldAbstain: false,
    };
  }

  return {
    complexity: "medium",
    candidateDepth: 10,
    finalLimit: 3,
    needsClarification: false,
    shouldAbstain: false,
  };
}
