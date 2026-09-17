import "server-only";
import { prisma } from "@/lib/db";
import { searchTerms } from "@/lib/curriculum/terms";
import type { QueryUnderstanding } from "./understanding";
import type { CurriculumMatch } from "@/lib/curriculum/service";
import { calculateHybridScore, type ScoreResult } from "./scoring";

/**
 * Darajalangan o'quv dasturi bo'limi natijasi.
 */
export interface RankedCurriculumMatch extends CurriculumMatch {
  score: number;
  scoreBreakdown: {
    exactMatch: number;
    semanticSimilarity: number;
    outcomeMatch: number;
    gradeSubjectMatch: number;
    intentMatch: number;
  };
}

/**
 * O'quv dasturidan gibrid qidiruv va ko'p mezonli reyting hisoblash.
 */
export async function matchCurriculumTopics(
  understanding: QueryUnderstanding,
  limit: number = 3,
): Promise<RankedCurriculumMatch[]> {
  const { detectedSubject, detectedGrade, extractedTopic, keywords, detectedIntent } = understanding;

  const whereClause: Record<string, unknown> = {};
  if (detectedSubject) {
    whereClause.subject = { equals: detectedSubject, mode: "insensitive" };
  }
  if (detectedGrade) {
    whereClause.grade = { equals: detectedGrade, mode: "insensitive" };
  }

  const terms = searchTerms(extractedTopic);
  const searchKeywords = Array.from(new Set([...terms, ...keywords.map((k) => k.toLowerCase().slice(0, 6))]))
    .filter((k) => k.length >= 3)
    .slice(0, 8);

  if (searchKeywords.length > 0) {
    whereClause.OR = searchKeywords.flatMap((term) => [
      { topicName: { contains: term, mode: "insensitive" as const } },
      { description: { contains: term, mode: "insensitive" as const } },
    ]);
  }

  const candidates = await prisma.curriculumTopic.findMany({
    where: whereClause,
    take: 15,
    select: {
      topicName: true,
      description: true,
      expectedHours: true,
      expectedOutcomes: true,
      source: true,
      subject: true,
      grade: true,
    },
  });

  if (candidates.length === 0 && (detectedSubject || detectedGrade)) {
    const fallbackCandidates = await prisma.curriculumTopic.findMany({
      where: detectedSubject ? { subject: { equals: detectedSubject, mode: "insensitive" } } : {},
      take: 10,
      select: {
        topicName: true,
        description: true,
        expectedHours: true,
        expectedOutcomes: true,
        source: true,
        subject: true,
        grade: true,
      },
    });
    candidates.push(...fallbackCandidates);
  }

  const scored: RankedCurriculumMatch[] = candidates.map((cand) => {
    const scoreRes: ScoreResult = calculateHybridScore({
      queryTopic: extractedTopic,
      keywords,
      detectedSubject,
      detectedGrade,
      detectedIntent,
      candidateTopicName: cand.topicName,
      candidateDescription: cand.description,
      candidateSubject: cand.subject,
      candidateGrade: cand.grade,
      candidateExpectedHours: cand.expectedHours,
      candidateExpectedOutcomes: cand.expectedOutcomes,
    });

    return {
      topicName: cand.topicName,
      description: cand.description,
      expectedHours: cand.expectedHours,
      expectedOutcomes: cand.expectedOutcomes,
      source: cand.source,
      score: scoreRes.totalScore,
      scoreBreakdown: {
        exactMatch: scoreRes.exactMatch,
        semanticSimilarity: scoreRes.semanticSimilarity,
        outcomeMatch: scoreRes.outcomeMatch,
        gradeSubjectMatch: scoreRes.gradeSubjectMatch,
        intentMatch: scoreRes.intentMatch,
      },
    };
  });

  const uniqueMap = new Map<string, RankedCurriculumMatch>();
  scored.sort((a, b) => b.score - a.score);

  for (const item of scored) {
    const key = `${item.topicName}|${item.expectedHours}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  }

  return Array.from(uniqueMap.values()).slice(0, limit);
}
