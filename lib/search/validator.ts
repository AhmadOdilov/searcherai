/**
 * Javobni tekshirish, fakt va tushuntirishlarni ajratish, hamda gallyutsinatsiyadan himoya qilish (Phase 10 & 13).
 *
 * Vazifalari:
 *  1. Grounding check: AI javobining rasmiy DTS o'quv dasturi bilan mosligini tekshirish.
 *  2. Claim validation: Soatlar (hours claim), sinf darajasi (grade claim), mavzu (topic claim)
 *     va kutilayotgan natijalar (outcome claim) bo'yicha ziddiyatlarni (contradictions) aniqlash.
 *  3. No result quality (Phase 10): "Fan bazada yo'q" (subject_unseeded) bilan "Mavzu topilmadi"
 *     (genuinely_absent) farqini foydalanuvchiga aniq tushuntirish.
 *  4. Cross-grade transparentlik (Phase 11): Agar mavzu boshqa sinf dasturida bo'lsa, ogohlantirish.
 */

import type { QueryUnderstanding } from "./understanding";
import type { RankedCurriculumMatch } from "./curriculum-matcher";
import type { SearchAnswer } from "@/lib/validations/search";

export interface GroundingClaim {
  type: "topic" | "grade" | "hours" | "outcome" | "source";
  claim: string;
  supported: boolean;
  contradiction?: string;
}

export interface GroundingValidationResult {
  isGrounded: boolean;
  groundingScore: number; // 0..1
  caution?: string;
  sourceCitations: Array<{
    sourceId: string;
    topicName: string;
    subject: string;
    grade: string;
    source: string;
    expectedHours: number | null;
  }>;
  claims: GroundingClaim[];
  contradictions: string[];
}

/**
 * AI javobini tahlil qiladi va strukturaviy da'volarni (claims) o'quv dasturi bilan tekshiradi.
 */
export function validateAndGroundAnswer(
  answer: SearchAnswer,
  understanding: QueryUnderstanding,
  curriculumMatches: RankedCurriculumMatch[],
): GroundingValidationResult {
  const citations = curriculumMatches.map((m) => ({
    sourceId: m.sourceId,
    topicName: m.topicName,
    subject: m.subject,
    grade: m.grade,
    source: m.source,
    expectedHours: m.expectedHours,
  }));

  const claims: GroundingClaim[] = [];
  const contradictions: string[] = [];

  // 1. Agar rasmiy dasturdan hech narsa topilmagan bo'lsa (Phase 10 No-result quality)
  if (curriculumMatches.length === 0) {
    const isUnseededSubject =
      understanding.detectedSubject &&
      ["Fizika", "Kimyo", "Biologiya", "Tarix", "Geografiya", "Informatika", "Ingliz tili"].includes(
        understanding.detectedSubject,
      );

    let ungroundedCaution = "";

    if (isUnseededSubject) {
      ungroundedCaution =
        understanding.detectedLanguage === "RU"
          ? `Примечание: Точное соответствие в официальной учебной программе не найдено (база по предмету «${understanding.detectedSubject}» пока не загружена). Ответ составлен на основе общих методических стандартов.`
          : understanding.detectedLanguage === "EN"
          ? `Note: No exact match found in official curriculum (curriculum for ${understanding.detectedSubject} is not yet seeded). Response is based on general pedagogical guidelines.`
          : `Eslatma: Ushbu mavzu rasmiy o'quv dasturidan topilmadi («${understanding.detectedSubject}» fani bo'yicha rasmiy DTS dasturi hozircha bazaga kiritilmagan). Javob umumiy pedagogik va metodik tavsiyalar asosida tayyorlandi.`;
    } else {
      ungroundedCaution =
        understanding.detectedLanguage === "RU"
          ? "Примечание: Точное соответствие в официальной учебной программе не найдено. Ответ составлен на основе общих методических рекомендаций."
          : understanding.detectedLanguage === "EN"
          ? "Note: No exact match found in official curriculum. The response is based on general pedagogical principles."
          : "Eslatma: Ushbu mavzu rasmiy o'quv dasturidan topilmadi. Javob umumiy pedagogik va metodik tavsiyalar asosida tayyorlandi.";
    }

    return {
      isGrounded: false,
      groundingScore: 0.3,
      caution: answer.caution ? `${answer.caution} | ${ungroundedCaution}` : ungroundedCaution,
      sourceCitations: [],
      claims: [
        {
          type: "source",
          claim: "Rasmiy o'quv dasturi bazasidan mavzu topilmadi",
          supported: false,
        },
      ],
      contradictions: [],
    };
  }

  // 2. Eng yuqori ball olgan bo'lim
  const topMatch = curriculumMatches[0];

  // 3. Structured Claim Validation (Phase 13)

  // a) Topic claim
  claims.push({
    type: "topic",
    claim: `Mavzu rasmiy dasturdagi «${topMatch.topicName}» bo'limi bilan mos`,
    supported: topMatch.score >= 0.4,
  });

  // b) Grade claim va Cross-grade tekshiruvi (Phase 11)
  let crossGradeCaution: string | undefined;
  if (topMatch.isCrossGrade && topMatch.requestedGrade && topMatch.availableGrade) {
    const isMismatch = topMatch.requestedGrade !== topMatch.availableGrade;
    if (isMismatch) {
      crossGradeCaution =
        understanding.detectedLanguage === "RU"
          ? `Внимание: Данная тема в официальной программе соотнесена с ${topMatch.availableGrade} (запрошен ${topMatch.requestedGrade}).`
          : understanding.detectedLanguage === "EN"
          ? `Notice: This topic is linked to ${topMatch.availableGrade} in the curriculum (requested ${topMatch.requestedGrade}).`
          : `Diqqat: Ushbu mavzu rasmiy o'quv dasturida ${topMatch.availableGrade} bilan bog'langan (so'rovda ${topMatch.requestedGrade} kiritilgan).`;

      claims.push({
        type: "grade",
        claim: `Sinf nomuvofiqligi: so'ralgan ${topMatch.requestedGrade}, dasturdagi ${topMatch.availableGrade}`,
        supported: false,
        contradiction: crossGradeCaution,
      });
      contradictions.push(crossGradeCaution);
    }
  } else {
    claims.push({
      type: "grade",
      claim: `Sinf darajasi: ${topMatch.grade}`,
      supported: true,
    });
  }

  // c) Hours claim tekshiruvi (Phase 13 Contradiction Check)
  if (topMatch.expectedHours !== null && topMatch.expectedHours > 0) {
    const hoursRegex = /(\d+)\s*(?:soat|soatlik|chasa|chasov|chasa|hours?)\b/iu;
    const hoursMatch = answer.answer.match(hoursRegex);

    if (hoursMatch) {
      const claimedHours = parseInt(hoursMatch[1], 10);
      const diff = Math.abs(claimedHours - topMatch.expectedHours);

      if (diff > 2) {
        const contra = `Soatlar tafovuti: javobda ${claimedHours} soat ko'rsatilgan, rasmiy o'quv dasturida esa ${topMatch.expectedHours} soat belgilangan.`;
        contradictions.push(contra);
        claims.push({
          type: "hours",
          claim: `Dars soatlari: ${claimedHours} soat`,
          supported: false,
          contradiction: contra,
        });
      } else {
        claims.push({
          type: "hours",
          claim: `Dars soatlari rasmiy dasturga mos (${topMatch.expectedHours} soat)`,
          supported: true,
        });
      }
    } else {
      claims.push({
        type: "hours",
        claim: `Rasmiy dasturda ajratilgan soat: ${topMatch.expectedHours}`,
        supported: true,
      });
    }
  }

  // d) Source claim
  if (topMatch.source) {
    claims.push({
      type: "source",
      claim: `Manba: ${topMatch.source}`,
      supported: true,
    });
  }

  // 4. Qisman moslik ogohlantirishi
  let conflictCaution: string | undefined;
  if (topMatch.score < 0.35) {
    conflictCaution =
      understanding.detectedLanguage === "RU"
        ? `Внимание: Найдено лишь частичное соответствие разделу «${topMatch.topicName}». Проверьте соответствие программе вашего класса.`
        : understanding.detectedLanguage === "EN"
        ? `Caution: Only partial match found for section "${topMatch.topicName}". Please verify grade-level suitability.`
        : `Diqqat: Mazkur mavzu rasmiy dasturdagi «${topMatch.topicName}» bo'limiga qisman mos keladi. Sinf darsligingiz bilan solishtirib ko'ring.`;
  }

  // Ogohlantirishlarni birlashtirish
  const allCautions = [answer.caution, conflictCaution, crossGradeCaution]
    .filter(Boolean)
    .join(" | ");

  const isGrounded = topMatch.score >= 0.5 && contradictions.length === 0;

  return {
    isGrounded,
    groundingScore: contradictions.length > 0 ? Math.max(0.2, topMatch.score - 0.25) : topMatch.score,
    caution: allCautions.length > 0 ? allCautions : undefined,
    sourceCitations: citations,
    claims,
    contradictions,
  };
}
