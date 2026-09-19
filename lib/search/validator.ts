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
import { getCurriculumCoverage } from "../curriculum/coverage";

export type ClaimStatus = "supported" | "contradicted" | "unsupported";

/**
 * Ziddiyatning SEMANTIK toifasi (V6).
 *
 * ── Nega kerak: o'lchov nuqsoni ───────────────────────────────────────────
 * V5 gacha validator ikki mutlaqo boshqa hodisani bitta `"contradicted"`
 * statusiga qo'shib yuborardi:
 *
 *   1. Javob rasmiy dalilga ZID keldi (masalan dasturda 20 soat, javobda
 *      60 soat) — bu tizim SIFATI haqidagi signal;
 *   2. So'ralgan sinf dasturdagi sinfdan farq qiladi — bu tizim O'ZI
 *      ochiq aytayotgan OGOHLANTIRISH, javobning dalilga zidligi emas.
 *
 * Oqibati o'lchovda ko'rindi: 950 so'rovli to'plamda 115 ta "contradiction"
 * ning 115 tasi ham sinf tafovuti edi, faktik ziddiyat esa 0 ta. Ya'ni
 * ko'rsatkich benchmark TARKIBIGA qarab o'zgarardi (cross-grade so'rovlari
 * qancha ko'p bo'lsa, "ziddiyat" shuncha yuqori), tizim xatti-harakatiga
 * qarab emas. Bunday metrika sifat signali bo'la olmaydi.
 *
 * `status` ATAYLAB o'zgartirilmadi — cross-grade javob hamon rasmiy
 * tasdiq (yashil belgi) olmaydi. Faqat toifa qo'shildi.
 */
export type ConflictType =
  /** Javobdagi fakt rasmiy dalilga zid (soatlar, sinf joylashuvi va h.k.). */
  | "FACTUAL_CONTRADICTION"
  /** So'ralgan sinf dasturdagi sinfdan farq qiladi — shaffoflik ogohlantirishi. */
  | "GRADE_CONFLICT"
  /** Javob dalillar orasida bo'lmagan rasmiy bo'limga havola qilmoqda. */
  | "SOURCE_CONFLICT";

export interface GroundingClaim {
  type: "topic" | "grade" | "hours" | "outcome" | "source";
  claim: string;
  evidence?: string;
  supportScore?: number;
  status: ClaimStatus;
  supported: boolean;
  unsupported: boolean;
  contradiction?: string;
  /** `status === "contradicted"` bo'lganda ziddiyatning semantik toifasi. */
  conflictType?: ConflictType;
  sourceId?: string;
}

export interface GroundingValidationResult {
  isGrounded: boolean;
  groundingScore: number; // 0..1
  isAbstained?: boolean;
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
  /** BARCHA ziddiyatlar (eski ta'rif, o'zgarmagan — solishtirish uchun saqlanadi). */
  contradictionRate: number;
  /** Javobning dalilga zidligi — tizim sifatining haqiqiy signali. */
  factualContradictionRate: number;
  /** Sinf tafovuti ogohlantirishlari — shaffoflik, sifat nuqsoni emas. */
  gradeConflictRate: number;
  /** Javob mavjud bo'lmagan rasmiy bo'limga havola qilgan holatlar. */
  sourceConflictRate: number;
  unsupportedClaimRate: number;
}

/**
 * Javob RASMIY o'quv dasturi bilan tasdiqlanganmi?
 *
 * ── Nega alohida funksiya ────────────────────────────────────────────────
 * V4 da bu qoida ikki joyda ALOHIDA yozilgan edi va ular bir-biriga mos
 * emasdi: yuqoridagi banner `isGrounded` ni tekshirardi, pastdagi
 * «Rasmiy o'quv dasturi (DTS)» kartasi esa shunchaki `matches.length > 0`
 * ni. Natijada tasdiqlanmagan javobda ham yashil belgili rasmiy manba
 * kartasi ko'rinardi — foydalanuvchi uni tasdiq deb qabul qilardi.
 *
 * Endi backend ham, UI ham AYNAN shu funksiyadan foydalanadi.
 */
export function isOfficiallyVerified(
  grounding: Pick<GroundingValidationResult, "isGrounded" | "isAbstained"> | undefined,
  curriculumMatchCount: number,
): boolean {
  if (!grounding) return false;
  return (
    grounding.isGrounded === true &&
    grounding.isAbstained !== true &&
    curriculumMatchCount > 0
  );
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
    // Noma'lum bo'lsa uydirilmaydi — `undefined` qoladi.
    sourceVersion: m.sourceVersion,
    curriculumYear: m.curriculumYear,
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
    const registryInfo = understanding.detectedSubject
      ? getSubjectCurriculumStatus(understanding.detectedSubject)
      : null;
    const isUnseededSubject = registryInfo?.status === "NOT_AVAILABLE";

    /*
      Sabab ANIQ aytiladi (V6).

      «Fan bo'yicha dastur yo'q» bilan «fan bor, lekin bu SINF
      raqamlashtirilmagan» — bular foydalanuvchi uchun boshqa-boshqa
      ma'no. Ikkinchi holatda qaysi sinflar mavjudligini aytish
      foydalanuvchiga to'g'ridan-to'g'ri yordam beradi.
    */
    const coverage = getCurriculumCoverage(
      understanding.detectedSubject,
      understanding.detectedGrade,
    );

    let ungroundedCaution = "";

    if (coverage.status === "GRADE_NOT_AVAILABLE") {
      const grades = coverage.availableGrades.join(", ");
      ungroundedCaution =
        understanding.detectedLanguage === "RU"
          ? `Примечание: официальная учебная программа по предмету «${coverage.subject}» оцифрована только для классов ${grades}. Для ${coverage.requestedGrade} официальных данных нет, поэтому ответ основан на общих методических рекомендациях.`
          : understanding.detectedLanguage === "EN"
            ? `Note: the official curriculum for ${coverage.subject} is digitised only for grades ${grades}. No official data exists for ${coverage.requestedGrade}, so this answer is based on general pedagogical guidance.`
            : `Eslatma: «${coverage.subject}» fani bo'yicha rasmiy o'quv dasturi faqat ${grades} uchun bazaga kiritilgan. ${coverage.requestedGrade} bo'yicha rasmiy ma'lumot yo'q, shuning uchun javob umumiy metodik tavsiyalar asosida tayyorlandi.`;
    } else if (isUnseededSubject) {
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
      unsupported: true,
      supportScore: 0.0,
    });

    return {
      isGrounded: false,
      groundingScore: 0.0,
      isAbstained: true,
      caution: answer.caution
        ? `${answer.caution} | ${ungroundedCaution}`
        : ungroundedCaution,
      sourceCitations: [],
      claims,
      contradictions: [],
      supportedClaimRate: 0.0,
      contradictionRate: 0.0,
      factualContradictionRate: 0.0,
      gradeConflictRate: 0.0,
      sourceConflictRate: 0.0,
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
    evidence: topMatch.description,
    supportScore: topMatch.score,
    status: isTopicSupported ? "supported" : "unsupported",
    supported: isTopicSupported,
    unsupported: !isTopicSupported,
    sourceId: topMatch.sourceId,
  });

  // b) Grade claim va Cross-grade tekshiruvi (Phase 8)
  let crossGradeCaution: string | undefined;
  if (topMatch.isCrossGrade && topMatch.requestedGrade && topMatch.availableGrade) {
    const isMismatch =
      topMatch.requestedGrade.toLowerCase() !== topMatch.availableGrade.toLowerCase();
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
        evidence: `DTS bo'yicha ${topMatch.availableGrade} ga tegishli`,
        supportScore: 0.0,
        status: "contradicted",
        conflictType: "GRADE_CONFLICT",
        supported: false,
        unsupported: true,
        contradiction: crossGradeCaution,
        sourceId: topMatch.sourceId,
      });
      contradictions.push(crossGradeCaution);
    }
  } else {
    claims.push({
      type: "grade",
      claim: `Sinf darajasi rasmiy dasturga mos: ${topMatch.grade}`,
      evidence: topMatch.grade,
      supportScore: 1.0,
      status: "supported",
      supported: true,
      unsupported: false,
      sourceId: topMatch.sourceId,
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
          evidence: `Rasmiy bazada: ${topMatch.expectedHours} soat`,
          supportScore: 0.0,
          status: "contradicted",
          conflictType: "FACTUAL_CONTRADICTION",
          supported: false,
          unsupported: true,
          contradiction: contra,
          sourceId: topMatch.sourceId,
        });
      } else {
        claims.push({
          type: "hours",
          claim: `Dars soatlari rasmiy dasturga mos (${topMatch.expectedHours} soat)`,
          evidence: `${topMatch.expectedHours} soat`,
          supportScore: 1.0,
          status: "supported",
          supported: true,
          unsupported: false,
          sourceId: topMatch.sourceId,
        });
      }
    } else {
      claims.push({
        type: "hours",
        claim: `Rasmiy dasturda ajratilgan soat: ${topMatch.expectedHours}`,
        evidence: `${topMatch.expectedHours} soat`,
        supportScore: 1.0,
        status: "supported",
        supported: true,
        unsupported: false,
        sourceId: topMatch.sourceId,
      });
    }
  } else {
    // DBda soat noma'lum bo'lsa
    if (hoursMatch) {
      claims.push({
        type: "hours",
        claim: `Javobda ${hoursMatch[1]} soat ko'rsatilgan, ammo rasmiy bazada bu bo'lim uchun soat belgilanmagan`,
        supportScore: 0.0,
        status: "unsupported",
        supported: false,
        unsupported: true,
        sourceId: topMatch.sourceId,
      });
    } else {
      claims.push({
        type: "hours",
        claim: "Bo'lim bo'yicha ajratilgan soat rasmiy manbada ko'rsatilmagan",
        supportScore: 0.0,
        status: "unsupported",
        supported: false,
        unsupported: true,
        sourceId: topMatch.sourceId,
      });
    }
  }

  // d) Expected Outcomes claim tekshiruvi
  if (topMatch.expectedOutcomes && topMatch.expectedOutcomes.length > 0) {
    const outcomeClean = topMatch.expectedOutcomes.join(" ").toLowerCase();
    const isOutcomeMentioned = understanding.keywords.some((k) =>
      outcomeClean.includes(k.toLowerCase()),
    );
    claims.push({
      type: "outcome",
      claim: `Kutilayotgan ta'limiy natijalar: ${topMatch.expectedOutcomes.length} ta kompetensiya mavjud`,
      evidence: topMatch.expectedOutcomes.slice(0, 2).join("; "),
      supportScore: isOutcomeMentioned ? 0.9 : 0.4,
      status: isOutcomeMentioned ? "supported" : "unsupported",
      supported: isOutcomeMentioned,
      unsupported: !isOutcomeMentioned,
      sourceId: topMatch.sourceId,
    });
  }

  // e) Source provenance claim
  if (topMatch.source) {
    claims.push({
      type: "source",
      claim: `Rasmiy manba mavjud: ${topMatch.source}`,
      evidence: topMatch.source,
      supportScore: 1.0,
      status: "supported",
      supported: true,
      unsupported: false,
      sourceId: topMatch.sourceId,
    });
  } else {
    claims.push({
      type: "source",
      claim: "Rasmiy manba havolasi ko'rsatilmagan",
      supportScore: 0.0,
      status: "unsupported",
      supported: false,
      unsupported: true,
      sourceId: topMatch.sourceId,
    });
  }

  /*
    f) SOURCE_CONFLICT — javob TO'QIB CHIQARILGAN rasmiy bo'limga havola qilmoqda.

    ── Nima uchun bu yangi tekshiruv ───────────────────────────────────────
    Mavjud "soxta DTS iqtiboslari" o'lchovi FAQAT iqtibos OBYEKTLARINI
    (sourceCitations) tekshirardi — ular esa retrieval natijasidan tuziladi,
    ya'ni ular ta'rifan haqiqiy. Model javob MATNIDA «...» ichida mavjud
    bo'lmagan bo'lim nomini keltirsa, hech narsa uni tutmasdi.

    Bu §8 dagi "rasmiy bo'lim nomini O'YLAB TOPMA" qoidasining bevosita
    tekshiruvi. U faqat ziddiyat QO'SHISHI mumkin, kamaytirishi emas.
  */
  const QUOTED_SECTION = /[«"]([^«»"]{6,120})[»"]/gu;
  const evidenceTitles = curriculumMatches.map((m) =>
    m.topicName.toUpperCase().replace(/['\u2018\u2019\u02BB\u02BC]/g, "'"),
  );
  const answerText = [answer.answer, ...answer.keyPoints, ...answer.classroomIdeas].join(
    " ",
  );

  for (const match of answerText.matchAll(QUOTED_SECTION)) {
    const quoted = match[1]
      .trim()
      .toUpperCase()
      .replace(/['\u2018\u2019\u02BB\u02BC]/g, "'");

    // Faqat rasmiy bo'lim sifatida taqdim etilgan iqtiboslar tekshiriladi.
    const start = Math.max(0, match.index - 60);
    const context = answerText.slice(start, match.index).toLowerCase();
    const claimsOfficial =
      /(dts|rasmiy|o'quv dastur|дтс|официальн|учебной программ|curriculum|official)/.test(
        context.replace(/['\u2018\u2019\u02BB\u02BC]/g, "'"),
      );
    if (!claimsOfficial) continue;

    const isKnown = evidenceTitles.some(
      (title) => title.includes(quoted) || quoted.includes(title),
    );
    if (isKnown) continue;

    const contra = `Javobda rasmiy dastur bo'limi sifatida «${match[1].trim()}» keltirilgan, ammo dalillar orasida bunday bo'lim yo'q.`;
    contradictions.push(contra);
    claims.push({
      type: "source",
      claim: `Tasdiqlanmagan rasmiy bo'lim havolasi: «${match[1].trim()}»`,
      evidence: evidenceTitles.slice(0, 3).join("; "),
      supportScore: 0.0,
      status: "contradicted",
      conflictType: "SOURCE_CONFLICT",
      supported: false,
      unsupported: true,
      contradiction: contra,
      sourceId: topMatch.sourceId,
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

  /*
    Ziddiyatlar TOIFA bo'yicha ham hisoblanadi.

    `contradictionRate` eski ta'rifda qoladi (barcha ziddiyatlar) — u
    o'chirilmaydi, chunki eski hisobotlar bilan solishtirish uchun kerak.
    Yonida esa semantik jihatdan to'g'ri ajratilgan uchta ko'rsatkich turadi.
  */
  const byConflict = (type: ConflictType) =>
    claims.filter((c) => c.status === "contradicted" && c.conflictType === type).length;

  const supportedClaimRate = Number((supportedCount / totalClaims).toFixed(2));
  const contradictionRate = Number((contradictedCount / totalClaims).toFixed(2));
  const factualContradictionRate = Number(
    (byConflict("FACTUAL_CONTRADICTION") / totalClaims).toFixed(2),
  );
  const gradeConflictRate = Number(
    (byConflict("GRADE_CONFLICT") / totalClaims).toFixed(2),
  );
  const sourceConflictRate = Number(
    (byConflict("SOURCE_CONFLICT") / totalClaims).toFixed(2),
  );
  const unsupportedClaimRate = Number((unsupportedCount / totalClaims).toFixed(2));

  const isGrounded =
    curriculumMatches.length > 0 && topMatch.score >= 0.45 && contradictedCount === 0;

  return {
    isGrounded,
    isAbstained: topMatch.score < 0.35,
    groundingScore:
      contradictions.length > 0 ? Math.max(0.2, topMatch.score - 0.25) : topMatch.score,
    caution: allCautions.length > 0 ? allCautions : undefined,
    sourceCitations: citations,
    claims,
    contradictions,
    supportedClaimRate,
    contradictionRate,
    factualContradictionRate,
    gradeConflictRate,
    sourceConflictRate,
    unsupportedClaimRate,
  };
}
