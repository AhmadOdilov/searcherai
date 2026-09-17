/**
 * Javobni tekshirish, fakt va tushuntirishlarni ajratish, hamda gallyutsinatsiyadan himoya qilish (Grounding V2 & Claim-Level Validation — Phase 16 & 17).
 *
 * Vazifalari:
 *  1. Grounding check: AI javobining rasmiy DTS o'quv dasturi bilan mosligini tekshirish.
 *  2. Claim validation: Har bir curriculum fact uchun aniq support status:
 *     - "supported": Rasmiy bazadagi ma'lumot bilan tasdiqlangan.
 *     - "contradicted": Rasmiy baza ma'lumotiga zid (masalan, dasturda 8 soat, AI 12 soat degan).
 *     - "unsupported": Rasmiy bazada bu fakt mavjud emas yoki tasdiqlanmagan.
 *  3. Cross-grade transparentlik (Phase 8): So'ralgan va topilgan sinf farqini aniq ko'rsatish.
 *  4. No result quality (Phase 10): "Fan bazada yo'q" (status: NOT_AVAILABLE) bilan "Mavzu topilmadi" farqi.
 */

import type { QueryUnderstanding } from "./understanding";
import type { RankedCurriculumMatch } from "./curriculum-matcher";
import type { SearchAnswer } from "@/lib/validations/search";
import { getSubjectCurriculumStatus } from "../curriculum/ingestion/registry";

export type ClaimStatus = "supported" | "contradicted" | "unsupported";

export interface GroundingClaim {
  type: "topic" | "grade" | "hours" | "outcome" | "source";
  claim: string;
  status: ClaimStatus;
  supported: boolean;
  contradiction?: string;
}

export interface GroundingValidationResult {
  isGrounded: boolean;
  groundingScore: number; // 0..1
  caution?: string;
  sourceCitations: Array<{
    sourceId: string;
    sourceVersion?: string;
    curriculumYear?: number;
    topicName: string;
    subject: string;
    grade: string;
    source: string;
    expectedHours: number | null;
  }>;
  claims: GroundingClaim[];
  contradictions: string[];
  supportedClaimRate: number;
  contradictionRate: number;
  unsupportedClaimRate: number;
}

/**
 * AI javobini tahlil qiladi va fakt darajasidagi da'volarni (claims) o'quv dasturi bilan tekshiradi.
 */
export function validateAndGroundAnswer(
  answer: SearchAnswer,
  understanding: QueryUnderstanding,
  curriculumMatches: RankedCurriculumMatch[],
): GroundingValidationResult {
  const citations = curriculumMatches.map((m) => ({
    sourceId: m.sourceId,
    sourceVersion: m.sourceVersion ?? "DTS-UZBMB-2025-v1",
    curriculumYear: m.curriculumYear ?? 2025,
    topicName: m.topicName,
    subject: m.subject,
    grade: m.grade,
    source: m.source,
    expectedHours: m.expectedHours,
  }));

  const claims: GroundingClaim[] = [];
  const contradictions: string[] = [];

  // 1. Agar rasmiy dasturdan hech narsa topilmagan bo'lsa
  if (curriculumMatches.length === 0) {
    const registryInfo = understanding.detectedSubject ? getSubjectCurriculumStatus(understanding.detectedSubject) : null;
    const isUnseededSubject = registryInfo?.status === "NOT_AVAILABLE";

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

    claims.push({
      type: "source",
      claim: "Rasmiy o'quv dasturi bazasidan mavzu topilmadi",
      status: "unsupported",
      supported: false,
    });

    return {
      isGrounded: false,
      groundingScore: 0.3,
      caution: answer.caution ? `${answer.caution} | ${ungroundedCaution}` : ungroundedCaution,
      sourceCitations: [],
      claims,
      contradictions: [],
      supportedClaimRate: 0.0,
      contradictionRate: 0.0,
      unsupportedClaimRate: 1.0,
    };
  }

  // 2. Eng yuqori ball olgan bo'lim
  const topMatch = curriculumMatches[0];

  // 3. Claim-Level Validation (Phase 16 & 17)

  // a) Topic claim
  const isTopicSupported = topMatch.score >= 0.45;
  claims.push({
    type: "topic",
    claim: `Mavzu rasmiy dasturdagi «${topMatch.topicName}» bo'limi bilan mos`,
    status: isTopicSupported ? "supported" : "unsupported",
    supported: isTopicSupported,
  });

  // b) Grade claim va Cross-grade tekshiruvi (Phase 8)
  let crossGradeCaution: string | undefined;
  if (topMatch.isCrossGrade && topMatch.requestedGrade && topMatch.availableGrade) {
    const isMismatch = topMatch.requestedGrade.toLowerCase() !== topMatch.availableGrade.toLowerCase();
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
        status: "contradicted",
        supported: false,
        contradiction: crossGradeCaution,
      });
      contradictions.push(crossGradeCaution);
    }
  } else {
    claims.push({
      type: "grade",
      claim: `Sinf darajasi rasmiy dasturga mos: ${topMatch.grade}`,
      status: "supported",
      supported: true,
    });
  }

  // c) Hours claim tekshiruvi (Phase 16 Fact Verification)
  const hoursRegex = /(\d+)\s*(?:soat|soatlik|chasa|chasov|hours?)\b/iu;
  const hoursMatch = answer.answer.match(hoursRegex);

  if (topMatch.expectedHours !== null && topMatch.expectedHours > 0) {
    if (hoursMatch) {
      const claimedHours = parseInt(hoursMatch[1], 10);
      const diff = Math.abs(claimedHours - topMatch.expectedHours);

      if (diff > 2) {
        const contra = `Soatlar tafovuti: javobda ${claimedHours} soat ko'rsatilgan, rasmiy o'quv dasturida esa ${topMatch.expectedHours} soat belgilangan.`;
        contradictions.push(contra);
        claims.push({
          type: "hours",
          claim: `Dars soatlari: ${claimedHours} soat`,
          status: "contradicted",
          supported: false,
          contradiction: contra,
        });
      } else {
        claims.push({
          type: "hours",
          claim: `Dars soatlari rasmiy dasturga mos (${topMatch.expectedHours} soat)`,
          status: "supported",
          supported: true,
        });
      }
    } else {
      claims.push({
        type: "hours",
        claim: `Rasmiy dasturda ajratilgan soat: ${topMatch.expectedHours}`,
        status: "supported",
        supported: true,
      });
    }
  } else {
    // DBda soat noma'lum bo'lsa
    if (hoursMatch) {
      claims.push({
        type: "hours",
        claim: `Javobda ${hoursMatch[1]} soat ko'rsatilgan, ammo rasmiy bazada bu bo'lim uchun soat belgilanmagan`,
        status: "unsupported",
        supported: false,
      });
    } else {
      claims.push({
        type: "hours",
        claim: "Bo'lim bo'yicha ajratilgan soat rasmiy manbada ko'rsatilmagan",
        status: "unsupported",
        supported: false,
      });
    }
  }

  // d) Expected Outcomes claim tekshiruvi
  if (topMatch.expectedOutcomes && topMatch.expectedOutcomes.length > 0) {
    const outcomeClean = topMatch.expectedOutcomes.join(" ").toLowerCase();
    const isOutcomeMentioned = understanding.keywords.some((k) => outcomeClean.includes(k.toLowerCase()));
    claims.push({
      type: "outcome",
      claim: `Kutilayotgan ta'limiy natijalar: ${topMatch.expectedOutcomes.length} ta kompetensiya mavjud`,
      status: isOutcomeMentioned ? "supported" : "unsupported",
      supported: isOutcomeMentioned,
    });
  }

  // e) Source provenance claim
  if (topMatch.source) {
    claims.push({
      type: "source",
      claim: `Rasmiy manba mavjud: ${topMatch.source}`,
      status: "supported",
      supported: true,
    });
  } else {
    claims.push({
      type: "source",
      claim: "Rasmiy manba havolasi ko'rsatilmagan",
      status: "unsupported",
      supported: false,
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

  // Support rates hisoblash
  const totalClaims = Math.max(1, claims.length);
  const supportedCount = claims.filter((c) => c.status === "supported").length;
  const contradictedCount = claims.filter((c) => c.status === "contradicted").length;
  const unsupportedCount = claims.filter((c) => c.status === "unsupported").length;

  const supportedClaimRate = Number((supportedCount / totalClaims).toFixed(2));
  const contradictionRate = Number((contradictedCount / totalClaims).toFixed(2));
  const unsupportedClaimRate = Number((unsupportedCount / totalClaims).toFixed(2));

  const isGrounded =
    curriculumMatches.length > 0 &&
    topMatch.score >= 0.45 &&
    contradictedCount === 0;

  return {
    isGrounded,
    groundingScore:
      contradictions.length > 0
        ? Math.max(0.2, topMatch.score - 0.25)
        : topMatch.score,
    caution: allCautions.length > 0 ? allCautions : undefined,
    sourceCitations: citations,
    claims,
    contradictions,
    supportedClaimRate,
    contradictionRate,
    unsupportedClaimRate,
  };
}
