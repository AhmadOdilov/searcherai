/**
 * Qidiruv so'rovlari uchun deterministik, xavfsiz va xotirada ishlaydigan LRU kesh (Cache V3 — Phase 17).
 *
 * Xususiyatlari:
 *  - Composite Cache Key:
 *    normalizedQuery | language | subject | grade | intent | audience | curriculumVersion | retrievalVersion | promptVersion
 *  - Xavfsizlik: Foydalanuvchining shaxsiy identifikatori, profili yoki maxfiy ma'lumotlari kesh kalitiga mutlaqo kirmaydi (cross-user leak proof).
 *  - Invalidation: Ranking, prompt yoki DTS o'quv dasturi versiyasi o'zgarganda eski kesh yaroqsiz qilinadi va tozalanadi.
 */

import { createHash } from "node:crypto";
import type { SearchResult } from "./service";
import type { QueryUnderstanding } from "./understanding";

interface CacheEntry {
  result: SearchResult;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 soat
const MAX_CACHE_SIZE = 1000;
export const DEFAULT_CURRICULUM_VERSION = "DTS-UZBMB-2025-v1";
export const DEFAULT_RETRIEVAL_VERSION = "retrieval-v3.0.0";
export const DEFAULT_PROMPT_VERSION = "prompt-v3.0.0";

export class SearchLruCache {
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private curriculumVersion: string;
  private retrievalVersion: string;
  private promptVersion: string;

  constructor(
    ttlMs: number = DEFAULT_TTL_MS,
    maxSize: number = MAX_CACHE_SIZE,
    curriculumVersion: string = DEFAULT_CURRICULUM_VERSION,
    retrievalVersion: string = DEFAULT_RETRIEVAL_VERSION,
    promptVersion: string = DEFAULT_PROMPT_VERSION,
  ) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    this.curriculumVersion = curriculumVersion;
    this.retrievalVersion = retrievalVersion;
    this.promptVersion = promptVersion;
  }

  /**
   * Versiyalar o'zgarganda (curriculum, retrieval yoki prompt) keshni avtomatik tozalash.
   */
  public setVersions(versions: {
    curriculumVersion?: string;
    retrievalVersion?: string;
    promptVersion?: string;
  }): void {
    let changed = false;
    if (versions.curriculumVersion && versions.curriculumVersion !== this.curriculumVersion) {
      this.curriculumVersion = versions.curriculumVersion;
      changed = true;
    }
    if (versions.retrievalVersion && versions.retrievalVersion !== this.retrievalVersion) {
      this.retrievalVersion = versions.retrievalVersion;
      changed = true;
    }
    if (versions.promptVersion && versions.promptVersion !== this.promptVersion) {
      this.promptVersion = versions.promptVersion;
      changed = true;
    }
    if (changed) {
      this.clear();
    }
  }

  public setCurriculumVersion(version: string): void {
    this.setVersions({ curriculumVersion: version });
  }

  public getCurriculumVersion(): string {
    return this.curriculumVersion;
  }

  public getRetrievalVersion(): string {
    return this.retrievalVersion;
  }

  public getPromptVersion(): string {
    return this.promptVersion;
  }

  /**
   * So'rov parametrlari asosida 9 ta mezonli deterministik kesh kaliti yaratadi (Phase 17).
   */
  public generateKey(understanding: QueryUnderstanding, customCurriculumVersion?: string): string {
    const cVersion = customCurriculumVersion ?? this.curriculumVersion;

    const rawKey = [
      understanding.normalizedQuery || understanding.normalized.normalized,
      understanding.language || understanding.detectedLanguage,
      understanding.subject || understanding.detectedSubject || "",
      understanding.grade || understanding.detectedGrade || "",
      understanding.intent || understanding.detectedIntent,
      understanding.audience,
      cVersion,
      this.retrievalVersion,
      this.promptVersion,
    ].join("|");

    return createHash("sha256").update(rawKey).digest("hex");
  }

  public get(key: string): SearchResult | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // LRU yangilash: o'qilgan elementni oxiriga o'tkazish
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.result;
  }

  public set(key: string, result: SearchResult): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Eng eski (boshidagi) kalitni olib tashlaymiz
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      result,
      expiresAt: Date.now() + this.ttlMs,
    });
  }

  /**
   * Fan bo'yicha kesh yozuvlarini bekor qilish (Invalidation Strategy)
   */
  public invalidateBySubject(subject: string): number {
    let deletedCount = 0;
    const norm = subject.toLowerCase();

    for (const [key, entry] of this.cache.entries()) {
      const entrySubject = entry.result.understanding?.detectedSubject?.toLowerCase();
      if (entrySubject === norm) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

/** Global yagona kesh instansiyasi */
export const searchCache = new SearchLruCache();
