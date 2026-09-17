/**
 * O'quv dasturi va qidiruv natijalari uchun ko'p mezonli reyting va matn o'xshashlik hisoblagichlari.
 * Sof funksiyalar — ma'lumotlar bazasi yoki .env talab qilmaydi.
 */

export interface ScoringInput {
  queryTopic: string;
  keywords: string[];
  detectedSubject?: string;
  detectedGrade?: string;
  detectedIntent: string;
  candidateTopicName: string;
  candidateDescription: string;
  candidateSubject: string;
  candidateGrade: string;
  candidateExpectedHours: number | null;
  candidateExpectedOutcomes: string[];
}

export interface ScoreResult {
  totalScore: number;
  exactMatch: number;
  semanticSimilarity: number;
  outcomeMatch: number;
  gradeSubjectMatch: number;
  intentMatch: number;
}

import { stemUzbekWord } from "./normalization";

export function calculateJaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokensA = Array.from(new Set(a.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((t) => t.length >= 3)));
  const tokensB = Array.from(new Set(b.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((t) => t.length >= 3)));

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // Morfologik o'zaklar bo'yicha moslashtirish (Phase 4)
  const stemsA = new Set(tokensA.map(stemUzbekWord));
  const stemsB = new Set(tokensB.map(stemUzbekWord));

  let intersection = 0;
  for (const s of stemsA) {
    if (stemsB.has(s)) intersection++;
  }

  const union = stemsA.size + stemsB.size - intersection;
  return union > 0 ? intersection / union : 0;
}

export function calculateHybridScore(input: ScoringInput): ScoreResult {
  const {
    queryTopic,
    keywords,
    detectedSubject,
    detectedGrade,
    detectedIntent,
    candidateTopicName,
    candidateDescription,
    candidateSubject,
    candidateGrade,
    candidateExpectedHours,
    candidateExpectedOutcomes,
  } = input;

  const norm = (s: string) => s.toUpperCase().replace(/['\u2018\u2019\u02BB\u02BC]/g, "'");
  const topicUpper = norm(candidateTopicName);
  const queryUpper = norm(queryTopic);
  const descLower = candidateDescription.toLowerCase().replace(/['\u2018\u2019\u02BB\u02BC]/g, "'");

  // 1. Exact Match (0..1) — Sarlavhadagi moslikka tavsifdagidan ko'ra yuqori ustunlik beriladi
  let exactMatch = 0;
  if (topicUpper === queryUpper || topicUpper.includes(queryUpper) || queryUpper.includes(topicUpper)) {
    exactMatch = 1.0;
  } else {
    const stemmedKeywords = keywords.map(stemUzbekWord);
    let titleMatches = 0;
    let descMatches = 0;

    for (const k of stemmedKeywords) {
      if (k.length < 3) continue;
      if (topicUpper.toLowerCase().includes(k)) {
        titleMatches++;
      } else if (descLower.includes(k)) {
        descMatches++;
      }
    }

    const totalK = Math.max(1, stemmedKeywords.filter((k) => k.length >= 3).length);
    // Sarlavha mosligi 80%, tavsif mosligi 20%
    exactMatch = Math.min(1.0, (titleMatches / totalK) * 0.85 + (descMatches / totalK) * 0.25);
  }

  // 2. Semantic Similarity (0..1)
  const simTopic = calculateJaccardSimilarity(candidateTopicName, queryTopic);
  const simDesc = calculateJaccardSimilarity(candidateDescription, queryTopic);
  const semanticSimilarity = Math.max(simTopic, simDesc);

  // 3. Outcome Match (0..1)
  let outcomeMatches = 0;
  for (const outcome of candidateExpectedOutcomes) {
    const outcomeClean = outcome.toLowerCase().replace(/['\u2018\u2019\u02BB\u02BC]/g, "'");
    if (keywords.some((k) => outcomeClean.includes(k.toLowerCase()) || outcomeClean.includes(stemUzbekWord(k)))) {
      outcomeMatches++;
    }
  }
  const outcomeMatch = candidateExpectedOutcomes.length > 0
    ? Math.min(1.0, outcomeMatches / Math.min(3, candidateExpectedOutcomes.length))
    : 0;

  // 4. Grade + Subject Match (0..1)
  let gradeSubjectMatch = 0;
  if (detectedSubject && candidateSubject.toLowerCase() === detectedSubject.toLowerCase()) {
    gradeSubjectMatch += 0.5;
  }
  if (detectedGrade && candidateGrade.toLowerCase() === detectedGrade.toLowerCase()) {
    gradeSubjectMatch += 0.5;
  }

  // 5. Intent Match (0..1)
  let intentMatch = 0.5;
  if (detectedIntent === "lesson_plan" || detectedIntent === "curriculum") {
    if (candidateExpectedHours && candidateExpectedHours > 0) intentMatch += 0.25;
    if (candidateExpectedOutcomes.length > 0) intentMatch += 0.25;
  } else {
    intentMatch = 0.8;
  }

  // Kalibratsiyalangan og'irliklar (Phase 8)
  let totalScore =
    0.35 * exactMatch +
    0.25 * semanticSimilarity +
    0.20 * gradeSubjectMatch +
    0.10 * outcomeMatch +
    0.10 * intentMatch;

  // Grade mismatch penalty (Phase 8 & 9):
  // Agar foydalanuvchi aniq sinf so'ragan bo'lsa va nomzod boshqa sinfdan bo'lsa, jazo bali qo'llaymiz
  if (detectedGrade && candidateGrade.toLowerCase() !== detectedGrade.toLowerCase()) {
    totalScore = Math.max(0, totalScore - 0.20);
  }

  return {
    totalScore: Number(totalScore.toFixed(4)),
    exactMatch: Number(exactMatch.toFixed(2)),
    semanticSimilarity: Number(semanticSimilarity.toFixed(2)),
    outcomeMatch: Number(outcomeMatch.toFixed(2)),
    gradeSubjectMatch: Number(gradeSubjectMatch.toFixed(2)),
    intentMatch: Number(intentMatch.toFixed(2)),
  };
}
