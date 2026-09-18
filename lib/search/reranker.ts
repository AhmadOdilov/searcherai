/**
 * Deterministic Local Reranker & Multi-Source Rank Fusion (Phase 5 & 6).
 *
 * Vazifasi:
 *  1. Birlamchi retrieval (Exact, Lexical, Semantic, Metadata) orqali yig'ilgan
 *     20 tagacha nomzodni qabul qilish.
 *  2. Har bir nomzod uchun ko'p mezonli reyting (Rank Fusion) hisoblash:
 *     - Exact match (0.30)
 *     - Lexical overlap (0.25)
 *     - Semantic similarity (0.25)
 *     - Grade & Subject alignment (0.10)
 *     - Learning outcomes match (0.05)
 *     - Intent alignment (0.05)
 *  3. Grade penalty (sinf farqi jazosi):
 *     - Aniq mos: 0
 *     - Qo'shni sinf (farq = 1): -0.10
 *     - Uzoq sinf (farq >= 2): -0.25
 *  4. Top 5 eng mos o'quv mavzularini qaytarish.
 */

import type { RankedCurriculumMatch } from "./curriculum-matcher";
import type { QueryUnderstanding } from "./understanding";
import { defaultSemanticProvider } from "./semantic";
import { stemUzbekWord } from "./normalization";
import { expandRetrievalTerms } from "./concept-map";

export interface RerankerCandidate {
  id: string;
  topicName: string;
  description: string;
  expectedHours: number | null;
  expectedOutcomes: string[];
  source: string;
  subject: string;
  grade: string;
}

export interface RerankingResult {
  reranked: RankedCurriculumMatch[];
}

/**
 * 20 tagacha nomzodni reytinglaydi va eng sara 5 tasini qaytaradi.
 */
export async function rerankCandidates(
  candidates: RerankerCandidate[],
  understanding: QueryUnderstanding,
  limit: number = 5,
): Promise<RankedCurriculumMatch[]> {
  if (candidates.length === 0) return [];

  const { topic, subject, grade, intent, keywords } = understanding;
  const queryTopic = topic || understanding.extractedTopic;
  const detectedSubject = subject || understanding.detectedSubject;
  const detectedGrade = grade || understanding.detectedGrade;
  const detectedIntent = intent || understanding.detectedIntent;

  // Semantik qidiruv uchun so'rov vektorini hisoblaymiz
  const queryVec = await defaultSemanticProvider.embedText(`${queryTopic} ${detectedSubject ?? ""}`);

  /*
    CROSS-LINGUAL KANONIK ATAMALAR.

    Retrieval bosqichi ruscha/inglizcha so'rovni o'zbekcha DTS atamalariga
    kengaytiradi va to'g'ri bo'limni TOPADI. Ammo V4 reranker'i baholashda
    faqat transliteratsiya qilingan asl tokenlarni ko'rardi
    («kvadratnie uravneniya» vs «KVADRAT TENGLAMALAR») va past ball berardi —
    topilgan rasmiy dalil abstention chegarasidan pastda qolardi.

    Shuning uchun reranker ham aynan o'sha kengaytmani oladi.
  */
  const { expandedTerms } = expandRetrievalTerms(queryTopic, keywords, detectedSubject, detectedGrade);
  const canonicalPhrases = expandedTerms
    .map((t) => t.toUpperCase().replace(/['\u2018\u2019\u02BB\u02BC]/g, "'"))
    .filter((t) => t.length >= 5);
  const canonicalTokens = Array.from(
    new Set(
      expandedTerms
        .flatMap((t) => t.toLowerCase().split(/\s+/))
        .filter((t) => t.length >= 3)
        .map(stemUzbekWord),
    ),
  );

  const scored: RankedCurriculumMatch[] = [];

  for (const cand of candidates) {
    const isCrossGrade = Boolean(
      detectedGrade && cand.grade.toLowerCase() !== detectedGrade.toLowerCase(),
    );

    // 1. Exact & Subphrase Match (0..1)
    const norm = (s: string) => s.toUpperCase().replace(/['\u2018\u2019\u02BB\u02BC]/g, "'");
    const candTitle = norm(cand.topicName);
    const qTitle = norm(queryTopic);

    let exactScore = 0;
    if (candTitle === qTitle) {
      exactScore = 1.0;
    } else if (candTitle.includes(qTitle) || qTitle.includes(candTitle)) {
      exactScore = 0.90;
    } else {
      /*
        Subphrase check — IKKI YO'NALISHLI.

        a) Nomzod sarlavhasining bo'lagi so'rovda uchraydi:
           "MUSBAT VA MANFIY SONLAR. BUTUN SONLAR" -> "butun sonlar".
        b) So'rovning bo'lagi nomzod sarlavhasida uchraydi:
           "kvadrat tenglama" -> "KVADRAT TENGLAMALAR VA TENGSIZLIKLAR".

        DIQQAT: (b) shartini `candTitle.includes(p)` ko'rinishida yozish MUMKIN EMAS,
        chunki u yerda `p` ning o'zi candTitle'dan kesib olingan bo'lsa, shart
        HAR DOIM rost bo'ladi va butunlay aloqasiz har qanday mavzu 0.85 ball oladi.
        Aynan shu tautologiya V4'da barcha nomzodlarga exactScore=0.85 bergan.
      */
      const splitPhrases = (value: string) =>
        value
          .split(/[.,:;\-\/]/)
          .map((p) => p.trim())
          .filter((p) => p.length >= 4);

      const candSubphrases = splitPhrases(candTitle);
      const querySubphrases = splitPhrases(qTitle);

      const subphraseHit =
        candSubphrases.some((p) => qTitle.includes(p)) ||
        querySubphrases.some((p) => p.length >= 6 && candTitle.includes(p));

      // Cross-lingual: o'zbekcha kanonik ibora nomzod sarlavhasida uchradimi?
      const canonicalHit = canonicalPhrases.some((p) => candTitle.includes(p));

      if (subphraseHit || canonicalHit) {
        exactScore = subphraseHit ? 0.85 : 0.80;
      } else {
        const qTokens = keywords.map(stemUzbekWord);
        let matchCount = 0;
        for (const t of qTokens) {
          if (t.length >= 3 && candTitle.toLowerCase().includes(t)) {
            matchCount++;
          }
        }
        exactScore = qTokens.length > 0 ? Math.min(0.75, matchCount / qTokens.length) : 0;
      }
    }

    // 2. Lexical Overlap (0..1)
    const candDesc = cand.description.toLowerCase();
    const stemmedKeywords = keywords.map(stemUzbekWord);
    const topicTokens = queryTopic
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length >= 3)
      .map(stemUzbekWord);
    const allQueryTokens = Array.from(new Set([...stemmedKeywords, ...topicTokens]));

    let descMatches = 0;
    for (const kw of allQueryTokens) {
      if (kw.length >= 3 && (candDesc.includes(kw) || candTitle.toLowerCase().includes(kw))) {
        descMatches++;
      }
    }
    const rawLexicalScore = allQueryTokens.length > 0
      ? Math.min(1.0, descMatches / Math.max(1, allQueryTokens.length))
      : 0;

    // Kanonik (o'zbekchalashtirilgan) tokenlar bo'yicha muqobil leksik o'lchov.
    let canonicalMatches = 0;
    for (const token of canonicalTokens) {
      if (candDesc.includes(token) || candTitle.toLowerCase().includes(token)) {
        canonicalMatches++;
      }
    }
    const canonicalLexical = canonicalTokens.length > 0
      ? Math.min(1.0, canonicalMatches / canonicalTokens.length)
      : 0;

    const lexicalScore = Math.max(rawLexicalScore, canonicalLexical);

    // 3. Semantic Similarity (0..1)
    const candVec = await defaultSemanticProvider.embedText(`${cand.topicName} ${cand.description}`);
    const semanticScore = Math.max(0, defaultSemanticProvider.computeSimilarity(queryVec, candVec));

    // 4. Grade & Subject Match (0..1)
    let gradeSubjectScore = 0;
    if (detectedSubject && cand.subject.toLowerCase() === detectedSubject.toLowerCase()) {
      gradeSubjectScore += 0.5;
    }
    if (detectedGrade && cand.grade.toLowerCase() === detectedGrade.toLowerCase()) {
      gradeSubjectScore += 0.5;
    }

    // 5. Outcome Match (0..1)
    let outcomeMatches = 0;
    for (const out of cand.expectedOutcomes) {
      const outLower = out.toLowerCase();
      if (keywords.some((k) => k.length >= 3 && outLower.includes(k.toLowerCase()))) {
        outcomeMatches++;
      }
    }
    const outcomeScore = cand.expectedOutcomes.length > 0
      ? Math.min(1.0, outcomeMatches / Math.min(3, cand.expectedOutcomes.length))
      : 0;

    // 6. Intent Match (0..1)
    let intentScore = 0.6;
    if (detectedIntent === "lesson_plan" || detectedIntent === "curriculum") {
      if (cand.expectedHours && cand.expectedHours > 0) intentScore += 0.2;
      if (cand.expectedOutcomes.length > 0) intentScore += 0.2;
    } else {
      intentScore = 0.8;
    }

    // Rank Fusion Formulalari (Phase 5)
    let hybridScore =
      0.30 * exactScore +
      0.25 * lexicalScore +
      0.25 * semanticScore +
      0.10 * gradeSubjectScore +
      0.05 * outcomeScore +
      0.05 * intentScore;

    // Generic Title Penalty (Takrorlash / Kirish should not shadow specific topics)
    const lowerQ = queryTopic.toLowerCase();
    if (candTitle.includes("TAKRORLASH") && !lowerQ.includes("takrorlash")) {
      hybridScore = Math.max(0, hybridScore - 0.08);
    }
    if (candTitle.includes("KIRISH") && !lowerQ.includes("kirish")) {
      hybridScore = Math.max(0, hybridScore - 0.05);
    }

    // Specificity Bonus: If candidate title contains distinctive query tokens
    const qDistinctTokens = allQueryTokens.filter(
      (t) => t.length >= 4 && !["dars", "sinf", "reja", "mavzu", "haqida", "bilan"].includes(t),
    );
    for (const dt of qDistinctTokens) {
      if (candTitle.toLowerCase().includes(dt)) {
        hybridScore += 0.04;
      }
    }

    // Grade Distance Penalty (Phase 7 Cross-Grade Intelligence)
    if (detectedGrade && isCrossGrade) {
      const numReq = parseInt(detectedGrade, 10);
      const numCand = parseInt(cand.grade, 10);
      if (!isNaN(numReq) && !isNaN(numCand)) {
        const diff = Math.abs(numReq - numCand);
        if (diff === 1) {
          hybridScore = Math.max(0, hybridScore - 0.10);
        } else {
          hybridScore = Math.max(0, hybridScore - 0.25);
        }
      } else {
        hybridScore = Math.max(0, hybridScore - 0.20);
      }
    }

    scored.push({
      sourceId: cand.id,
      sourceVersion: "DTS-UZBMB-2025-v1",
      curriculumYear: 2025,
      topicName: cand.topicName,
      subject: cand.subject,
      grade: cand.grade,
      description: cand.description,
      expectedHours: cand.expectedHours,
      expectedOutcomes: cand.expectedOutcomes,
      source: cand.source,
      score: Number(hybridScore.toFixed(4)),
      exactMatch: !isCrossGrade,
      crossGradeMatch: isCrossGrade,
      isCrossGrade,
      requestedGrade: detectedGrade,
      availableGrade: cand.grade,
      scoreBreakdown: {
        exactMatch: Number(exactScore.toFixed(2)),
        semanticSimilarity: Number(semanticScore.toFixed(2)),
        outcomeMatch: Number(outcomeScore.toFixed(2)),
        gradeSubjectMatch: Number(gradeSubjectScore.toFixed(2)),
        intentMatch: Number(intentScore.toFixed(2)),
      },
    });
  }

  // Saralash: eng yuqori reytingli mavzular avval
  scored.sort((a, b) => b.score - a.score);

  // Duplikatlarni olib tashlash
  const uniqueMap = new Map<string, RankedCurriculumMatch>();
  for (const item of scored) {
    const key = `${item.topicName}|${item.grade}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  }

  return Array.from(uniqueMap.values()).slice(0, limit);
}
