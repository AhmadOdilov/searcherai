import "server-only";
import { prisma } from "@/lib/db";
import { searchTerms } from "@/lib/curriculum/terms";
import type { QueryUnderstanding } from "./understanding";
import type { CurriculumMatch } from "@/lib/curriculum/service";
import { stemUzbekWord, getApostropheVariants } from "./normalization";
import { expandQueryConcepts } from "./concept-map";
import { rewriteQueryForRetrieval } from "./rewrite";
import { rerankCandidates, type RerankerCandidate } from "./reranker";

/**
 * Darajalangan o'quv dasturi bo'limi natijasi va to'liq manba provenansi (Phase 12).
 */
export interface RankedCurriculumMatch extends CurriculumMatch {
  sourceId: string;
  sourceVersion?: string;
  curriculumYear?: number;
  subject: string;
  grade: string;
  score: number;
  exactMatch: boolean;
  crossGradeMatch: boolean;
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
 * O'quv dasturi bazasidan birlamchi nomzodlarni qidirib topish (Retrieval Candidate Generation bosqichi).
 */
export async function retrieveCurriculumCandidates(
  understanding: QueryUnderstanding,
  maxCandidates: number = 50,
): Promise<RerankerCandidate[]> {
  const { detectedSubject, detectedGrade, extractedTopic, keywords } = understanding;

  // 1. Qidiruv so'zlarini shakllantirish va Query Rewrite
  const rewrites = rewriteQueryForRetrieval(understanding);
  const baseTerms = searchTerms(extractedTopic);
  const stemmedKeywords = keywords.map(stemUzbekWord);

  const expandedTerms = new Set<string>([
    ...baseTerms,
    ...stemmedKeywords,
    extractedTopic,
    ...rewrites.retrievalRepresentations.flatMap((r) => r.split(/\s+/)).filter((w) => w.length >= 3),
  ]);

  // Cross-lingual tushunchalar kengaytmasi
  const conceptExpansion = expandQueryConcepts(extractedTopic, detectedSubject, detectedGrade);
  for (const term of conceptExpansion.expandedTerms) {
    expandedTerms.add(term);
    for (const t of term.split(/\s+/)) {
      if (t.length >= 3) expandedTerms.add(t);
    }
  }

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

  const STOP_CLAUSE_TERMS = new Set([
    "sinf", "класс", "grade", "class",
    "matematika", "ona tili", "adabiyot", "fizika", "kimyo", "biologiya",
    "tarix", "geografiya", "informatika", "ingliz tili", "english", "math", "physics", "chemistry",
    "dars", "reja", "mavzu", "haqida", "uchun", "asosiy", "umumiy"
  ]);

  const isStopTerm = (term: string) => {
    const clean = term.toLowerCase().replace(/['\u2018\u2019\u02BB\u02BC]/g, "'");
    if (STOP_CLAUSE_TERMS.has(clean)) return true;
    if (/^\d+-?(?:sinf|klass|grade)?$/i.test(clean)) return true;
    return false;
  };

  // Asosiy qidiruv so'zlari (so'rovdan to'g'ridan-to'g'ri olingan atamalar)
  const primaryVariants = new Set<string>();
  const rawPrimary = [...baseTerms, ...stemmedKeywords, extractedTopic];
  for (const term of rawPrimary) {
    if (term.length < 3 || isStopTerm(term)) continue;
    for (const variant of getApostropheVariants(term)) {
      if (!isStopTerm(variant)) {
        primaryVariants.add(variant);
      }
    }
  }

  // Barcha kengaytirilgan apostrof variantlarini generatsiya qilish
  const finalVariants = new Set<string>(primaryVariants);
  for (const term of expandedTerms) {
    if (term.length < 3 || isStopTerm(term)) continue;
    for (const variant of getApostropheVariants(term)) {
      if (!isStopTerm(variant)) {
        finalVariants.add(variant);
      }
    }
  }

  const primaryKeywords = Array.from(primaryVariants).slice(0, 10);
  const searchKeywords = Array.from(finalVariants).slice(0, 16);

  const primaryClauses = primaryKeywords.flatMap((term) => [
    { topicName: { contains: term, mode: "insensitive" as const } },
    { description: { contains: term, mode: "insensitive" as const } },
  ]);

  const orClauses = searchKeywords.flatMap((term) => [
    { topicName: { contains: term, mode: "insensitive" as const } },
    { description: { contains: term, mode: "insensitive" as const } },
  ]);

  // 2. Birinchi bosqich — so'ralgan sinf va fandan qidirish
  let candidates: RerankerCandidate[] = [];

  if (detectedSubject && detectedGrade) {
    // 2.1 Avval so'ralgan sinfda birlamchi mavzu atamalariga (primaryClauses) mos keluvchi mavzularni qidiramiz
    const firstClauses = primaryClauses.length > 0 ? primaryClauses : orClauses;
    if (firstClauses.length > 0) {
      candidates = await prisma.curriculumTopic.findMany({
        where: {
          subject: { equals: detectedSubject, mode: "insensitive" },
          grade: { equals: detectedGrade, mode: "insensitive" },
          OR: firstClauses,
        },
        take: maxCandidates,
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
    }

    // 2.2 Agar so'ralgan sinfda mavzu topilmasa, lekin boshqa sinflarda birlamchi mavzu bo'lsa (Cross-Grade Retrieval)
    if (candidates.length === 0 && firstClauses.length > 0) {
      const crossGradeCandidates = await prisma.curriculumTopic.findMany({
        where: {
          subject: { equals: detectedSubject, mode: "insensitive" },
          OR: firstClauses,
        },
        take: Math.min(maxCandidates, 20),
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

      if (crossGradeCandidates.length > 0) {
        candidates = crossGradeCandidates;
      }
    }

    // 2.3 Agar umumiy so'rov bo'lsa (kalit so'zlar bo'yicha cheklov yo'q), shu sinf/fanning barcha mavzulari olinadi
    if (candidates.length === 0) {
      candidates = await prisma.curriculumTopic.findMany({
        where: {
          subject: { equals: detectedSubject, mode: "insensitive" },
          grade: { equals: detectedGrade, mode: "insensitive" },
        },
        take: maxCandidates,
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
    }
  }

  // Agar aniq fan/sinf bo'yicha topilmasa yoki fan/sinf noaniq bo'lsa:
  if (candidates.length === 0) {
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

    candidates = await prisma.curriculumTopic.findMany({
      where: primaryWhere,
      take: maxCandidates,
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
  }

  // 3. Obvious wrong grade filter: faqat cross-grade holati bo'lmasa filtrlaymiz
  let effectiveCandidates = candidates;
  if (detectedGrade) {
    const exactGradeCandidates = candidates.filter(
      (c) => c.grade.toLowerCase() === detectedGrade.toLowerCase(),
    );
    if (exactGradeCandidates.length > 0) {
      effectiveCandidates = exactGradeCandidates;
    }
  }

  return effectiveCandidates;
}

/**
 * O'quv dasturidan gibrid qidiruv, cross-lingual moslashtirish va ko'p mezonli reyting hisoblash.
 */
export async function matchCurriculumTopics(
  understanding: QueryUnderstanding,
  limit: number = 3,
): Promise<RankedCurriculumMatch[]> {
  const candidates = await retrieveCurriculumCandidates(understanding, 50);
  return rerankCandidates(candidates, understanding, limit);
}
