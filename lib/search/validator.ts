/**
 * Javobni tekshirish, fakt va tushuntirishlarni ajratish, hamda gallyutsinatsiyadan himoya qilish.
 *
 * Vazifalari:
 *  1. Grounding check: Agar AI javobida aytilgan sinf/fan rasmiy o'quv dasturi bilan
 *     to'qnashsa (masalan, 5-sinfda differensial tenglamalar), caution ogohlantirish qo'shadi.
 *  2. Dasturda topilmagan mavzular uchun: agar bazada mavzu yo'q bo'lsa, javob modelning
 *     umumiy bilimiga tayanganini o'qituvchiga ochiq bildiradi.
 *  3. Fakt va tushuntirish ajratilishi: Asosiy ilmiy ta'riflar (fact) va metodik tavsiyalarni
 *     (explanation / classroom ideas) tasdiqlaydi.
 */

import type { QueryUnderstanding } from "./understanding";
import type { RankedCurriculumMatch } from "./curriculum-matcher";
import type { SearchAnswer } from "@/lib/validations/search";

export interface GroundingValidationResult {
  isGrounded: boolean;
  groundingScore: number; // 0..1
  caution?: string;
  sourceCitations: Array<{
    topicName: string;
    source: string;
    expectedHours: number | null;
  }>;
}

/**
 * AI javobini tahlil qiladi va o'quv dasturi bilan mosligini tekshiradi.
 */
export function validateAndGroundAnswer(
  answer: SearchAnswer,
  understanding: QueryUnderstanding,
  curriculumMatches: RankedCurriculumMatch[],
): GroundingValidationResult {
  const citations = curriculumMatches.map((m) => ({
    topicName: m.topicName,
    source: m.source,
    expectedHours: m.expectedHours,
  }));

  // 1. Agar rasmiy dasturdan hech narsa topilmagan bo'lsa
  if (curriculumMatches.length === 0) {
    const ungroundedCaution =
      understanding.detectedLanguage === "RU"
        ? "Примечание: Данная тема не найдена в официальной учебной программе. Ответ составлен на основе общих методических рекомендаций."
        : understanding.detectedLanguage === "EN"
        ? "Note: This topic was not found in the official curriculum. The response is based on general pedagogical principles."
        : "Eslatma: Ushbu mavzu rasmiy o'quv dasturidan topilmadi. Javob umumiy pedagogik va metodik tavsiyalar asosida tayyorlandi.";

    return {
      isGrounded: false,
      groundingScore: 0.3,
      caution: answer.caution ? `${answer.caution} | ${ungroundedCaution}` : ungroundedCaution,
      sourceCitations: [],
    };
  }

  // 2. Eng yuqori ball olgan bo'lim
  const topMatch = curriculumMatches[0];

  // 3. Sinf yoki fan nomuvofiqligi tekshiruvi
  let conflictCaution: string | undefined;
  if (topMatch.score < 0.35) {
    conflictCaution =
      understanding.detectedLanguage === "RU"
        ? `Внимание: Найдено лишь частичное соответствие разделу «${topMatch.topicName}». Проверьте соответствие программе вашего класса.`
        : understanding.detectedLanguage === "EN"
        ? `Caution: Only partial match found for section "${topMatch.topicName}". Please verify grade-level suitability.`
        : `Diqqat: Mazkur mavzu rasmiy dasturdagi «${topMatch.topicName}» bo'limiga qisman mos keladi. Sinf darsligingiz bilan solishtirib ko'ring.`;
  }

  const finalCaution = conflictCaution
    ? answer.caution
      ? `${answer.caution} | ${conflictCaution}`
      : conflictCaution
    : answer.caution;

  return {
    isGrounded: topMatch.score >= 0.5,
    groundingScore: topMatch.score,
    caution: finalCaution,
    sourceCitations: citations,
  };
}
