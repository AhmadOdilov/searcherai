/**
 * Source Provenance va Traceability xizmati (Phase 4 & 5).
 *
 * Har bir rasmiy fakt, mavzu yoki soat bo'yicha orqaga qarab
 * qaysi manba, qaysi versiya va qaysi hujjatga asoslanganini
 * 100% aniqlash imkonini beradi.
 */

export interface ProvenanceTrace {
  sourceId: string;
  sourceVersion: string;
  curriculumYear?: number;
  sourceUpdatedAt?: string;
  subject: string;
  grade: string;
  topicName: string;
  expectedHours: number | null;
  officialSourceUrl: string;
  provenanceStatement: string;
}

/**
 * Manba havolasidan o'quv dasturi versiyasi va yilini ANIQLAYDI.
 *
 * ── Nega konstanta yaramaydi ─────────────────────────────────────────────
 * V4 da har bir dalilga `DTS-UZBMB-2025-v1` / `2025` qattiq yozib
 * qo'yilgan edi. Lekin bazadagi 9-sinf matematika dasturi aslida
 * boshqa yil hujjatidan olingan:
 *
 *   .../qabul2026/dasturlar/9/matematika/9.pdf
 *
 * Ya'ni tizim 2026-yilgi hujjatni «2025-yil versiyasi» deb iqtibos
 * keltirardi. Bu §8 dagi "o'quv dasturi versiyasini O'YLAB TOPMA"
 * qoidasini buzadi.
 *
 * Aniqlab bo'lmasa, yil QAYTARILMAYDI — noto'g'ri yil ko'rsatgandan ko'ra
 * ko'rsatmagan yaxshi.
 */
export function deriveCurriculumProvenance(source: string): {
  sourceVersion: string;
  curriculumYear?: number;
} {
  const match = /qabul(\d{4})/i.exec(source ?? "");
  if (!match) {
    return { sourceVersion: "DTS-UZBMB-UNKNOWN" };
  }
  const year = Number(match[1]);
  return { sourceVersion: `DTS-UZBMB-${year}-v1`, curriculumYear: year };
}

/**
 * Bo'lim uchun rasmiy provenans ma'lumotini shakllantiradi.
 */
export function buildProvenanceTrace(input: {
  id: string;
  sourceId?: string | null;
  sourceVersion?: string | null;
  curriculumYear?: number | null;
  sourceUpdatedAt?: string | Date | null;
  subject: string;
  grade: string;
  topicName: string;
  expectedHours?: number | null;
  source: string;
}): ProvenanceTrace {
  const normSourceId = input.sourceId || `uzbmb-${input.subject.toLowerCase()}-${input.grade}-${input.id.slice(-6)}`;
  // Versiya/yil MANBADAN olinadi — konstanta yozib qo'yilmaydi.
  const derived = deriveCurriculumProvenance(input.source);
  const normVersion = input.sourceVersion || derived.sourceVersion;
  const normYear = input.curriculumYear ?? derived.curriculumYear;
  const normUpdatedAt = input.sourceUpdatedAt
    ? typeof input.sourceUpdatedAt === "string"
      ? input.sourceUpdatedAt
      : input.sourceUpdatedAt.toISOString()
    : "2025-01-15T00:00:00.000Z";

  const yearPart = normYear === undefined ? "" : `, yil: ${normYear}`;
  const provenanceStatement = `O'zbekiston Respublikasi rasmiy davlat o'quv dasturi (${input.subject}, ${input.grade}, bo'lim: «${input.topicName}», versiya: ${normVersion}${yearPart}). Manba: ${input.source}`;

  return {
    sourceId: normSourceId,
    sourceVersion: normVersion,
    curriculumYear: normYear,
    sourceUpdatedAt: normUpdatedAt,
    subject: input.subject,
    grade: input.grade,
    topicName: input.topicName,
    expectedHours: input.expectedHours ?? null,
    officialSourceUrl: input.source,
    provenanceStatement,
  };
}
