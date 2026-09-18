/**
 * Semantic Vector & Embedding Abstraction (Phase 4).
 *
 * Vazifasi:
 *  1. Semantik o'xshashlikni hisoblash uchun umumiy abstraction qatlami.
 *  2. Agar tashqi embedding modeli (masalan Gemini text-embedding yoki OpenAI)
 *     mavjud bo'lmasa, deterministik mahalliy semantik TF-IDF / Subword n-gram
 *     vektor hisoblagichidan foydalanadi.
 *  3. Tashqi API'ga majburiy qaramlik (hard dependency) yaratmaydi.
 */

import { stemUzbekWord } from "./normalization";

export interface SemanticEmbeddingProvider {
  name: string;
  embedText(text: string): Promise<number[]>;
  computeSimilarity(vecA: number[], vecB: number[]): number;
}

/**
 * Kosinus o'xshashligi (Cosine Similarity).
 */
export function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}

/**
 * Deterministik Mahalliy Semantik Vektorizator (Local N-Gram Hashing Vectorizer).
 * 128 o'lchamli bo'shliqda subword va stem belgilarini joylashtiradi.
 */
export class LocalSemanticProvider implements SemanticEmbeddingProvider {
  public readonly name = "local-deterministic-ngram-128";
  private readonly dimensions = 128;

  public async embedText(text: string): Promise<number[]> {
    const vec = new Array<number>(this.dimensions).fill(0);
    if (!text || text.trim().length === 0) return vec;

    const clean = text.toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ");
    const words = clean.split(/\s+/).filter((w) => w.length >= 2);

    for (const rawWord of words) {
      const stem = stemUzbekWord(rawWord);

      // 1. So'z va o'zak heshi
      this.hashIntoVector(stem, vec, 2.0);

      // 2. 3-gramm va 4-gramm subwordlar
      if (stem.length >= 3) {
        for (let i = 0; i <= stem.length - 3; i++) {
          const tri = stem.substring(i, i + 3);
          this.hashIntoVector(tri, vec, 0.8);
        }
      }
    }

    // Normalizatsiya (L2 norm)
    let norm = 0;
    for (let i = 0; i < this.dimensions; i++) {
      norm += vec[i] * vec[i];
    }

    norm = Math.sqrt(norm);
    if (norm > 0) {
      for (let i = 0; i < this.dimensions; i++) {
        vec[i] /= norm;
      }
    }

    return vec;
  }

  public computeSimilarity(vecA: number[], vecB: number[]): number {
    return computeCosineSimilarity(vecA, vecB);
  }

  private hashIntoVector(token: string, vec: number[], weight: number) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    const idx = hash % this.dimensions;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vec[idx] += sign * weight;
  }
}

export const defaultSemanticProvider: SemanticEmbeddingProvider = new LocalSemanticProvider();
