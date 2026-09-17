import "server-only";
import { prisma } from "@/lib/db";
import { searchTerms } from "@/lib/curriculum/terms";
import type { QueryUnderstanding } from "./understanding";
import type { CurriculumMatch } from "@/lib/curriculum/service";
import { calculateHybridScore, type ScoreResult } from "./scoring";
import { stemUzbekWord, getApostropheVariants } from "./normalization";

/**
 * Darajalangan o'quv dasturi bo'limi natijasi va to'liq manba provenansi (Phase 12).
 */
export interface RankedCurriculumMatch extends CurriculumMatch {
  sourceId: string;
  subject: string;
  grade: string;
  score: number;
  isCrossGrade?: boolean;
  requestedGrade?: string;
  availableGrade?: string;
  scoreBreakdown: {
    exactMatch: number;
    semanticSimilarity: number;
    outcomeMatch: number;
    gradeSubjectMatch: number;
    intentMatch: number;
  };
}

/**
 * Rus va ingliz tilidagi ta'limiy tushunchalarni o'zbek DTS atamalariga o'tkazish xaritasi.
 * Cross-lingual retrieval (Phase 3 & 4) uchun xizmat qiladi.
 */
const CROSS_LINGUAL_CONCEPT_MAP: Record<string, string[]> = {
  drob: ["kasr", "oddiy kasr"],
  drobi: ["kasr", "oddiy kasr"],
  droblar: ["kasr", "oddiy kasr"],
  fractions: ["kasr", "oddiy kasr"],
  fraction: ["kasr", "oddiy kasr"],
  chisla: ["sonlar", "natural sonlar", "butun sonlar"],
  numbers: ["sonlar", "natural sonlar"],
  tselie: ["butun sonlar", "butun"],
  integers: ["butun sonlar"],
  uravneni: ["tenglama", "tenglamalar"],
  uravneniya: ["tenglama", "tenglamalar"],
  equations: ["tenglama", "tenglamalar"],
  equation: ["tenglama"],
  figuri: ["shakllar", "geometrik shakllar"],
  shapes: ["shakllar", "geometrik shakllar"],
  funktsi: ["funksiya"],
  funktsii: ["funksiya"],
  functions: ["funksiya"],
  progressi: ["progressiya", "arifmetik va geometrik"],
  progressiya: ["progressiya", "arifmetik va geometrik"],
  progressions: ["progressiya"],
  proizvodnaya: ["hosila", "hosilasi"],
  derivatives: ["hosila"],
  derivative: ["hosila"],
  integral: ["integral"],
  integrals: ["integral"],
  pervoobraznaya: ["integral", "boshlang'ich funksiya"],
  koren: ["ildiz", "kvadrat ildiz"],
  korni: ["ildiz", "kvadrat ildiz"],
  roots: ["ildiz", "kvadrat ildiz"],
  kvadratnie: ["kvadrat", "kvadratik"],
  quadratic: ["kvadrat", "kvadratik"],
  trigonometr: ["trigonometrik", "trigonometriya"],
  trigonometry: ["trigonometrik", "trigonometriya"],
  logarifm: ["logarifmik", "logarifm"],
  logarithm: ["logarifmik", "logarifm"],
  umnojeni: ["ko'paytirish", "qisqa ko'paytirish"],
  multiplication: ["ko'paytirish"],
  slozheni: ["qo'shish"],
  addition: ["qo'shish"],
  sokrashennogo: ["qisqa ko'paytirish"],
  pifagor: ["pifagor"],
  pythagorean: ["pifagor"],
};

/**
 * O'quv dasturidan gibrid qidiruv, cross-lingual moslashtirish va ko'p mezonli reyting hisoblash.
 */
export async function matchCurriculumTopics(
  understanding: QueryUnderstanding,
  limit: number = 3,
): Promise<RankedCurriculumMatch[]> {
  const { detectedSubject, detectedGrade, extractedTopic, keywords, detectedIntent } = understanding;

  // 1. Qidiruv so'zlarini shakllantirish va boyitish
  const baseTerms = searchTerms(extractedTopic);
  const stemmedKeywords = keywords.map(stemUzbekWord);

  const expandedTerms = new Set<string>([...baseTerms, ...stemmedKeywords, extractedTopic]);

  // Cross-lingual tushunchalar kengaytmasi
  for (const word of keywords) {
    const cleanWord = word.toLowerCase().replace(/[^a-z0-9]/gi, "");
    for (const [key, synonyms] of Object.entries(CROSS_LINGUAL_CONCEPT_MAP)) {
      if (cleanWord.includes(key) || key.includes(cleanWord)) {
        for (const syn of synonyms) {
          expandedTerms.add(syn);
          for (const t of syn.split(/\s+/)) {
            if (t.length >= 3) expandedTerms.add(t);
          }
        }
      }
    }
  }

  // Barcha apostrof variantlarini generatsiya qilish (Phase 3 & 4)
  const finalVariants = new Set<string>();
  for (const term of expandedTerms) {
    if (term.length < 3) continue;
    for (const variant of getApostropheVariants(term)) {
      finalVariants.add(variant);
    }
  }

  const searchKeywords = Array.from(finalVariants).slice(0, 16);

  const orClauses = searchKeywords.flatMap((term) => [
    { topicName: { contains: term, mode: "insensitive" as const } },
    { description: { contains: term, mode: "insensitive" as const } },
  ]);

  // 2. Birinchi bosqich — so'ralgan sinf va fandan qidirish
  const primaryWhere: Record<string, unknown> = {};
  if (detectedSubject) {
    primaryWhere.subject = { equals: detectedSubject, mode: "insensitive" };
  }
  if (detectedGrade) {
    primaryWhere.grade = { equals: detectedGrade, mode: "insensitive" };
  }
  if (orClauses.length > 0) {
    primaryWhere.OR = orClauses;
  }

  const candidates = await prisma.curriculumTopic.findMany({
    where: primaryWhere,
    take: 15,
    select: {
      id: true,
      topicName: true,
      description: true,
      expectedHours: true,
      expectedOutcomes: true,
      source: true,
      subject: true,
      grade: true,
    },
  });

  // 3. Ikkinchi bosqich — Cross-Grade qidiruv (Phase 11):
  // Agar so'ralgan sinfda topilmasa, mavzu boshqa sinflarda borligini tekshiramiz
  if (candidates.length === 0 && detectedSubject && orClauses.length > 0) {
    const crossGradeCandidates = await prisma.curriculumTopic.findMany({
      where: {
        subject: { equals: detectedSubject, mode: "insensitive" },
        OR: orClauses,
      },
      take: 10,
      select: {
        id: true,
        topicName: true,
        description: true,
        expectedHours: true,
        expectedOutcomes: true,
        source: true,
        subject: true,
        grade: true,
      },
    });

    candidates.push(...crossGradeCandidates);
  }

  // 4. Ko'p mezonli reyting hisoblash (Scoring & Provenance)
  const scored: RankedCurriculumMatch[] = candidates.map((cand) => {
    const isCrossGrade = Boolean(
      detectedGrade && cand.grade.toLowerCase() !== detectedGrade.toLowerCase(),
    );

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
      sourceId: cand.id,
      topicName: cand.topicName,
      subject: cand.subject,
      grade: cand.grade,
      description: cand.description,
      expectedHours: cand.expectedHours,
      expectedOutcomes: cand.expectedOutcomes,
      source: cand.source,
      score: scoreRes.totalScore,
      isCrossGrade,
      requestedGrade: detectedGrade,
      availableGrade: cand.grade,
      scoreBreakdown: {
        exactMatch: scoreRes.exactMatch,
        semanticSimilarity: scoreRes.semanticSimilarity,
        outcomeMatch: scoreRes.outcomeMatch,
        gradeSubjectMatch: scoreRes.gradeSubjectMatch,
        intentMatch: scoreRes.intentMatch,
      },
    };
  });

  // Duplikatlarni olib tashlash va reyting bo'yicha saralash
  const uniqueMap = new Map<string, RankedCurriculumMatch>();
  scored.sort((a, b) => b.score - a.score);

  for (const item of scored) {
    const key = `${item.topicName}|${item.grade}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  }

  return Array.from(uniqueMap.values()).slice(0, limit);
}
