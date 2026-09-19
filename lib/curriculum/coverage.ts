import { getSubjectCurriculumStatus } from "./ingestion/registry";

/**
 * O'quv dasturi QAMROVI — fan VA sinf darajasida (V6).
 *
 * ── Nega bu alohida qatlam kerak bo'ldi ───────────────────────────────────
 * V5 gacha qamrov faqat FAN darajasida tekshirilardi: reyestrda fan
 * `NOT_AVAILABLE` bo'lsa, tizim ehtiyot rejimiga o'tardi. Sinf darajasida
 * esa hech qanday tekshiruv yo'q edi.
 *
 * Oqibati (real reproduksiya, `matchCurriculumTopics`):
 *
 *   «1-sinf matematika 10 ichida sonlarni qo'shish va ayirish»
 *     -> 5-sinf «NATURAL SONLARNI QO'SHISH VA AYIRISH», ball 0.6602
 *   «4-sinf matematika oddiy kasrlar»
 *     -> 5-sinf «ODDIY KASRLAR», ball 0.8227
 *
 * Bazada boshlang'ich sinf (1-4) dasturi UMUMAN yo'q. Ya'ni tizim
 * mavjud bo'lmagan sinf uchun eng yaqin sinfning bo'limini topib,
 * uni "sinf tafovuti" ogohlantirishi bilan taqdim etardi — bu esa
 * noto'g'ri dalilni qonuniylashtirish.
 *
 * MUHIM FARQ:
 *   · 5-11 sinflar orasidagi cross-grade HAQIQIY hodisa: ikkala sinf
 *     ham dasturda bor, mavzu shunchaki boshqa sinfda o'qitiladi.
 *     Bu xatti-harakat SAQLANADI.
 *   · 1-4 sinf esa umuman raqamlashtirilmagan. Bu yerda to'g'ri javob —
 *     "rasmiy dastur mavjud emas", taxminiy eng yaqin sinf emas.
 */

export type CoverageStatus =
  /** Fan ham, sinf ham rasmiy dasturda bor. */
  | "COVERED"
  /** Fan bor, lekin so'ralgan sinf raqamlashtirilmagan. */
  | "GRADE_NOT_AVAILABLE"
  /** Fan bo'yicha rasmiy dastur umuman yo'q. */
  | "SUBJECT_NOT_AVAILABLE"
  /** Fan aniqlanmagan — qamrov haqida hukm chiqarib bo'lmaydi. */
  | "UNKNOWN_SUBJECT";

export interface CurriculumCoverage {
  status: CoverageStatus;
  subject?: string;
  requestedGrade?: string;
  /** Ushbu fan bo'yicha rasmiy dasturi mavjud sinflar. */
  availableGrades: string[];
}

function normalizeGrade(grade: string): string {
  return grade.trim().toLowerCase();
}

/**
 * So'ralgan fan va sinf rasmiy dasturda qamralganmi?
 *
 * Sinf berilmagan bo'lsa qamrov FAN darajasida baholanadi — foydalanuvchi
 * sinfni aytmagan bo'lsa, unga sinf qamrovi haqida hukm chiqarish noto'g'ri.
 */
export function getCurriculumCoverage(
  subject: string | undefined,
  grade: string | undefined,
): CurriculumCoverage {
  if (!subject) {
    return { status: "UNKNOWN_SUBJECT", requestedGrade: grade, availableGrades: [] };
  }

  const entry = getSubjectCurriculumStatus(subject);
  if (!entry) {
    return {
      status: "UNKNOWN_SUBJECT",
      subject,
      requestedGrade: grade,
      availableGrades: [],
    };
  }

  if (entry.status !== "OFFICIAL") {
    return {
      status: "SUBJECT_NOT_AVAILABLE",
      subject: entry.subject,
      requestedGrade: grade,
      availableGrades: [],
    };
  }

  if (!grade) {
    return {
      status: "COVERED",
      subject: entry.subject,
      availableGrades: entry.gradesAvailable,
    };
  }

  const covered = entry.gradesAvailable.some(
    (g) => normalizeGrade(g) === normalizeGrade(grade),
  );

  return {
    status: covered ? "COVERED" : "GRADE_NOT_AVAILABLE",
    subject: entry.subject,
    requestedGrade: grade,
    availableGrades: entry.gradesAvailable,
  };
}

/**
 * So'ralgan sinf uchun rasmiy dalil qaytarish MUMKINMI?
 *
 * `false` bo'lsa, qidiruv boshqa sinfdagi bo'limni ham taklif qilmasligi
 * kerak: so'ralgan sinf dasturi mavjud emas, ya'ni "bu mavzu boshqa
 * sinfda" degan xulosa chiqarish uchun asos yo'q.
 */
export function canProvideOfficialEvidence(coverage: CurriculumCoverage): boolean {
  return coverage.status === "COVERED" || coverage.status === "UNKNOWN_SUBJECT";
}
