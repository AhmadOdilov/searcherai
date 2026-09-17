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

export function calculateJaccardSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  const tokensA = Array.from(new Set(a.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((t) => t.length >= 3)));
  const tokensB = Array.from(new Set(b.toLowerCase().split(/[^\p{L}\p{N}']+/u).filter((t) => t.length >= 3)));

  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  // Stems (o'zaklar) bo'yicha moslashtirish
  const stem = (w: string) => (w.length > 5 ? w.slice(0, 5) : w);
  const stemsA = new Set(tokensA.map(stem));
  const stemsB = new Set(tokensB.map(stem));

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

  const topicUpper = candidateTopicName.toUpperCase();
  const queryUpper = queryTopic.toUpperCase();
  const descLower = candidateDescription.toLowerCase();

  // 1. Exact Match (0..1)
  let exactMatch = 0;
  if (topicUpper.includes(queryUpper) || queryUpper.includes(topicUpper)) {
    exactMatch = 1.0;
  } else {
    const matched = keywords.filter((k) => descLower.includes(k.toLowerCase()) || topicUpper.includes(k.toUpperCase()));
    exactMatch = keywords.length > 0 ? Math.min(1.0, matched.length / keywords.length) : 0;
  }

  // 2. Semantic Similarity (0..1)
  const simTopic = calculateJaccardSimilarity(candidateTopicName, queryTopic);
  const simDesc = calculateJaccardSimilarity(candidateDescription, queryTopic);
  const semanticSimilarity = Math.max(simTopic, simDesc);

  // 3. Outcome Match (0..1)
  let outcomeMatches = 0;
  for (const outcome of candidateExpectedOutcomes) {
    if (keywords.some((k) => outcome.toLowerCase().includes(k.toLowerCase()))) {
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

  const totalScore =
    0.30 * semanticSimilarity +
    0.25 * exactMatch +
    0.20 * outcomeMatch +
    0.15 * gradeSubjectMatch +
    0.10 * intentMatch;

  return {
    totalScore: Number(totalScore.toFixed(4)),
    exactMatch: Number(exactMatch.toFixed(2)),
    semanticSimilarity: Number(semanticSimilarity.toFixed(2)),
    outcomeMatch: Number(outcomeMatch.toFixed(2)),
    gradeSubjectMatch: Number(gradeSubjectMatch.toFixed(2)),
    intentMatch: Number(intentMatch.toFixed(2)),
  };
}
