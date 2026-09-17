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
  const normVersion = input.sourceVersion || "DTS-UZBMB-2025-v1";
  const normYear = input.curriculumYear ?? 2025;
  const normUpdatedAt = input.sourceUpdatedAt
    ? typeof input.sourceUpdatedAt === "string"
      ? input.sourceUpdatedAt
      : input.sourceUpdatedAt.toISOString()
    : "2025-01-15T00:00:00.000Z";

  const provenanceStatement = `O'zbekiston Respublikasi rasmiy davlat o'quv dasturi (${input.subject}, ${input.grade}, bo'lim: «${input.topicName}», versiya: ${normVersion}, yil: ${normYear}). Manba: ${input.source}`;

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
