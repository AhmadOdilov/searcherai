/**
 * Query Rewrite Engine (Phase 3).
 *
 * Vazifalari:
 *  1. Foydalanuvchining asl so'roviga teginmaslik (user query remains intact).
 *  2. Ichki retrieval (qidiruv) uchun bir nechta boyitilgan invariant ko'rinishlar yaratish:
 *     - Kanonik o'zbekcha ko'rinish (masalan: "fotosintez 7 sinf biologiya")
 *     - Inglizcha ekvivalent (masalan: "photosynthesis grade 7 biology")
 *     - Ruscha ekvivalent (masalan: "фотосинтез 7 класс биология")
 *     - Konseptual tavsif (masalan: "fotosintez o'simliklarda oziqa hosil bo'lishi")
 *  3. Token va xarajat chegaralarini boshqarish (maksimal 4 ta invariant, 16 ta atama).
 */

import type { QueryUnderstanding } from "./understanding";
import { CANONICAL_CONCEPTS } from "./concept-map";

export interface QueryRewriteResult {
  originalQuery: string;
  canonicalRepresentation: string;
  crossLingualRepresentations: string[];
  conceptExpansions: string[];
  retrievalRepresentations: string[];
}

/**
 * Qidiruv so'rovini retrieval qatlami uchun bir necha invariantlarga qayta yozadi.
 */
export function rewriteQueryForRetrieval(
  understanding: QueryUnderstanding,
  maxRepresentations: number = 4,
): QueryRewriteResult {
  const rawTopic = understanding.topic || understanding.extractedTopic;
  const topic = typeof rawTopic === "string" ? rawTopic : "";
  const rawGrade = understanding.grade || understanding.detectedGrade;
  const grade = typeof rawGrade === "string" ? rawGrade : "";
  const rawSubject = understanding.subject || understanding.detectedSubject;
  const subject = typeof rawSubject === "string" ? rawSubject : "";

  const originalQuery =
    (typeof understanding.normalizedQuery === "string" &&
      understanding.normalizedQuery) ||
    topic ||
    "";

  // 1. Kanonik o'zbekcha ko'rinish
  const canonicalParts: string[] = [];
  if (topic) canonicalParts.push(topic);
  if (grade) canonicalParts.push(grade);
  if (subject) canonicalParts.push(subject);
  const canonicalRepresentation = canonicalParts.join(" ").trim() || originalQuery;

  // 2. Cross-lingual va konseptual invariantlar
  const crossLingual: string[] = [];
  const conceptExpansions: string[] = [];

  const lowerTopic = topic.toLowerCase();
  const lowerQuery = originalQuery.toLowerCase();

  for (const concept of CANONICAL_CONCEPTS) {
    if (
      subject &&
      typeof concept.subject === "string" &&
      concept.subject.toLowerCase() !== subject.toLowerCase()
    ) {
      continue;
    }

    const allAliases = [
      ...concept.aliasesUz,
      ...concept.aliasesRu,
      ...concept.aliasesEn,
      concept.canonicalUz,
      concept.conceptKey,
    ];

    const isMatch = allAliases.some(
      (alias) =>
        lowerTopic.includes(alias.toLowerCase()) ||
        lowerQuery.includes(alias.toLowerCase()) ||
        alias.toLowerCase().includes(lowerTopic),
    );

    if (isMatch) {
      // Ruscha invariant
      const gradeRu = grade ? `${grade.replace("-sinf", "")} класс` : "";
      const ruRep = `${concept.canonicalRu} ${gradeRu} ${concept.subject}`.trim();
      if (!crossLingual.includes(ruRep)) crossLingual.push(ruRep);

      // Inglizcha invariant
      const gradeEn = grade ? `grade ${grade.replace("-sinf", "")}` : "";
      const enRep = `${concept.canonicalEn} ${gradeEn} ${concept.subject}`.trim();
      if (!crossLingual.includes(enRep)) crossLingual.push(enRep);

      // Konseptual kengaytma
      const uzConceptRep =
        `${concept.canonicalUz} ${grade ?? ""} ${concept.relatedConcepts.slice(0, 2).join(" ")}`.trim();
      if (!conceptExpansions.includes(uzConceptRep)) conceptExpansions.push(uzConceptRep);
    }
  }

  // Ro'yxatni birlashtirish va cheklash (maksimal `maxRepresentations` ta invariant)
  const retrievalRepresentations: string[] = [canonicalRepresentation];

  for (const rep of [...crossLingual, ...conceptExpansions]) {
    if (retrievalRepresentations.length >= maxRepresentations) break;
    if (!retrievalRepresentations.includes(rep)) {
      retrievalRepresentations.push(rep);
    }
  }

  return {
    originalQuery,
    canonicalRepresentation,
    crossLingualRepresentations: crossLingual,
    conceptExpansions,
    retrievalRepresentations,
  };
}
