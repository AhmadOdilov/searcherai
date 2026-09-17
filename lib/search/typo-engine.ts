/**
 * Typo Engine V2 — Lug'at, Levenshtein masofasi va ta'limiy kontekstga asoslangan tuzatgich (Phase 10).
 *
 * Xususiyatlari:
 *  1. Known typo: Tezkor O(1) xaritalash.
 *  2. Fuzzy candidate: Canonical curriculum vocabulary bo'yicha Levenshtein masofasi.
 *  3. Dynamic confidence:
 *     - >= 0.85: avtomatik to'g'rilash (Auto-correct).
 *     - 0.65 - 0.84: "Did you mean?" taklifi, lekin so'rovni agressiv buzmaslik.
 *     - < 0.65: asl holatida qoldirish.
 */

/** Aniq ma'lum bo'lgan xatolar jadvali (Known Typos) */
export const KNOWN_TYPO_MAP: Record<string, string> = {
  matimatika: "matematika",
  matimatikada: "matematikada",
  matimatikadan: "matematikadan",
  matimatikani: "matematikani",
  bialogiya: "biologiya",
  bialogiyada: "biologiyada",
  bialogiyadan: "biologiyadan",
  bialogiyani: "biologiyani",
  geagrafiya: "geografiya",
  geagrafiyadan: "geografiyadan",
  fizka: "fizika",
  fizkadan: "fizikadan",
  fizkani: "fizikani",
  kimiya: "kimyo",
  kimiyodan: "kimyodan",
  tarx: "tarix",
  tarxdan: "tarixdan",
  tarxni: "tarixni",
  onatili: "ona tili",
  fatasintez: "fotosintez",
  fatasintezni: "fotosintezni",
  fotosintezni: "fotosintezni",
  triganametriya: "trigonometriya",
  triganometriya: "trigonometriya",
  tanglama: "tenglama",
  tanglamalar: "tenglamalar",
  tanglamalarni: "tenglamalarni",
  kasirlar: "kasrlar",
  kasirlarni: "kasrlarni",
  kasir: "kasr",
  ushburchak: "uchburchak",
  turburchak: "to'rtburchak",
  prizintatsiya: "prezentatsiya",
  prezintatsiya: "prezentatsiya",
  prizintasiya: "prezentatsiya",
  slayd: "slayd",
  ishlanmas: "ishlanma",
  darsishlanma: "dars ishlanma",
  kalindr: "kalendar",
  kalendr: "kalendar",
  tematik: "tematik",
  algoritm: "algoritm",
  algoritim: "algoritm",
  aripmetika: "arifmetika",
  arifmitika: "arifmetika",
};

/** Kanonik ta'limiy va ilmiy atamalar lug'ati (Curriculum Vocabulary) */
export const CANONICAL_VOCABULARY: string[] = [
  "matematika",
  "algebra",
  "geometriya",
  "arifmetika",
  "trigonometriya",
  "fotosintez",
  "biologiya",
  "fizika",
  "kimyo",
  "tarix",
  "geografiya",
  "informatika",
  "adabiyot",
  "prezentatsiya",
  "ishlanma",
  "tenglama",
  "tengsizlik",
  "uchburchak",
  "to'rtburchak",
  "aylana",
  "funksiya",
  "progressiya",
  "hosila",
  "integral",
  "logarifm",
  "diskriminant",
  "pifagor",
  "vektor",
  "koordinata",
  "morfologiya",
  "sintaksis",
  "fonetika",
  "leksikologiya",
];

/**
 * Ikki so'z orasidagi Levenshtein masofasini hisoblaydi.
 */
export function calculateLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a) return b.length;
  if (!b) return a.length;

  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // o'chirish
        dp[i][j - 1] + 1, // qo'shish
        dp[i - 1][j - 1] + cost, // almashtirish
      );
    }
  }

  return dp[m][n];
}

export interface TypoCorrectionResult {
  corrected: string;
  original: string;
  confidence: number;
  method: "exact" | "known_typo" | "fuzzy_match" | "none";
  didYouMean?: string;
}

/**
 * Berilgan so'zni tekshiradi va Typo Engine V2 qoidalariga binoan tuzatadi.
 */
export function correctWord(rawWord: string): TypoCorrectionResult {
  const clean = rawWord.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");
  if (!clean || clean.length < 3) {
    return {
      corrected: rawWord,
      original: rawWord,
      confidence: 1.0,
      method: "none",
    };
  }

  // 1. Ma'lum xatolar jadvali (O(1))
  if (KNOWN_TYPO_MAP[clean]) {
    const fixed = KNOWN_TYPO_MAP[clean];
    return {
      corrected: rawWord.toLowerCase().replace(clean, fixed),
      original: rawWord,
      confidence: 0.98,
      method: "known_typo",
    };
  }

  // Prefiks bo'yicha ma'lum xatolar (masalan, fatasintezni -> fotosintezni)
  for (const [typo, fixed] of Object.entries(KNOWN_TYPO_MAP)) {
    if (clean.startsWith(typo) && typo.length >= 5) {
      const replaced = clean.replace(typo, fixed);
      return {
        corrected: rawWord.toLowerCase().replace(clean, replaced),
        original: rawWord,
        confidence: 0.95,
        method: "known_typo",
      };
    }
  }

  // 2. Kanonik lug'at bilan fuzzy qidiruv (Levenshtein)
  let bestMatch: string | null = null;
  let minDistance = Infinity;

  for (const word of CANONICAL_VOCABULARY) {
    // Uzunlik farqi juda katta bo'lsa tekshirmaymiz
    if (Math.abs(clean.length - word.length) > 2) continue;

    const dist = calculateLevenshteinDistance(clean, word);
    if (dist < minDistance) {
      minDistance = dist;
      bestMatch = word;
    }
  }

  if (bestMatch) {
    const maxLen = Math.max(clean.length, bestMatch.length);
    const similarity = 1 - minDistance / maxLen;

    // Uzun so'zlar (>= 6) uchun distance <= 2, qisqaroqlar uchun distance <= 1
    const allowedDistance = clean.length >= 6 ? 2 : 1;

    if (minDistance <= allowedDistance) {
      if (similarity >= 0.85) {
        // Yuqori ishonch — avtomatik tuzatish
        return {
          corrected: rawWord.toLowerCase().replace(clean, bestMatch),
          original: rawWord,
          confidence: Number(similarity.toFixed(2)),
          method: "fuzzy_match",
        };
      } else if (similarity >= 0.68) {
        // O'rtacha ishonch — agressiv almashtirmaymiz, Did You Mean beramiz
        return {
          corrected: rawWord,
          original: rawWord,
          confidence: Number(similarity.toFixed(2)),
          method: "none",
          didYouMean: bestMatch,
        };
      }
    }
  }

  return {
    corrected: rawWord,
    original: rawWord,
    confidence: 1.0,
    method: "none",
  };
}
