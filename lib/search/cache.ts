/**
 * Qidiruv so'rovlari uchun deterministik, xavfsiz va xotirada ishlaydigan LRU kesh (Cache V3 — Phase 15).
 *
 * Xususiyatlari:
 *  - Kalit tarkibi: normalizedQuery | language | subject | grade | intent | audience | curriculumVersion.
 *  - Xavfsizlik: Foydalanuvchining shaxsiy identifikatori, profili yoki maxfiy ma'lumotlari kesh kalitiga mutlaqo kirmaydi (cross-user leak proof).
 *  - Invalidation: Curriculum yangilanishida `curriculumVersion` o'zgarishi barcha eski kesh yozuvlarini zudlik bilan yaroqsiz qiladi yoki tozalaydi.
 *  - Multi-instance behavior: Har bir konteyner/instansiya mustaqil tezkor xotira keshiga ega (~0.001ms).
 *    Gorizontal masshtabda podlar o'rtasida muammo tug'dirmaydi, chunki kesh sof deterministik funksional natijalarga asoslanadi. Redis hozirgi bosqichda kiritilmadi.
 */

import { createHash } from "node:crypto";
import type { SearchResult } from "./service";
import type { QueryUnderstanding } from "./understanding";

interface CacheEntry {
  result: SearchResult;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 soat
const MAX_CACHE_SIZE = 500;
export const DEFAULT_CURRICULUM_VERSION = "DTS-UZBMB-2025-v1";

export class SearchLruCache {
  private cache = new Map<string, CacheEntry>();
  private readonly ttlMs: number;
  private readonly maxSize: number;
  private curriculumVersion: string;

  constructor(
    ttlMs: number = DEFAULT_TTL_MS,
    maxSize: number = MAX_CACHE_SIZE,
    curriculumVersion: string = DEFAULT_CURRICULUM_VERSION,
  ) {
    this.ttlMs = ttlMs;
    this.maxSize = maxSize;
    this.curriculumVersion = curriculumVersion;
  }

  /**
   * O'quv dasturi yangilanganda kesh versiyasini o'zgartirish va eski ma'lumotlarni tozalash.
   */
  public setCurriculumVersion(version: string): void {
    if (this.curriculumVersion !== version) {
      this.curriculumVersion = version;
      this.clear();
    }
  }

  public getCurriculumVersion(): string {
    return this.curriculumVersion;
  }

  /**
   * So'rov parametrlari asosida deterministik kesh kaliti yaratadi.
   */
  public generateKey(understanding: QueryUnderstanding, customCurriculumVersion?: string): string {
    const version = customCurriculumVersion ?? this.curriculumVersion;
    // Hech qanday user-specific yoki private ma'lumot qo'shilmaydi
    const rawKey = [
      understanding.normalized.normalized,
      understanding.detectedLanguage,
      understanding.detectedSubject ?? "",
      understanding.detectedGrade ?? "",
      understanding.detectedIntent,
      understanding.audience,
      version,
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

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

/** Global yagona kesh instansiyasi */
export const searchCache = new SearchLruCache();
