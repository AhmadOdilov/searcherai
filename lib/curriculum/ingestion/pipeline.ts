/**
 * Reusable Curriculum Data Ingestion Pipeline (Phase 3, 4, 5, 23).
 *
 * Pipeline bosqichlari:
 *  1. SOURCE: Fayl yoki xom ma'lumotlarni qabul qilish.
 *  2. PARSE: JSON yoki strukturani tahlil qilish.
 *  3. NORMALIZE: Apostroflar, harflar, sinf formati, matnlarni tozalash.
 *  4. VALIDATE: Qat'iy ma'lumotlar sifati tekshiruvi (soatlar, fan, sinf, manba, unicode).
 *  5. DEDUPLICATE: Bo'lim va mavzu takrorlarini aniqlash va ajratish.
 *  6. REVIEW: Hisobot va xatoliklar jurnali (audit issues).
 *  7. EXPORT / DATABASE: Tasdiqlangan ma'lumotlarni saqlashga tayyorlash.
 */

import { CURRICULUM_SUBJECT_REGISTRY } from "./registry";
import type {
  IngestionFileInput,
  IngestionTopicInput,
  NormalizedTopicRecord,
  ValidationResult,
  PipelineSummary,
  DataQualityIssue,
} from "./types";
import { normalizeApostrophes } from "../../search/normalization";

export class CurriculumIngestionPipeline {
  /**
   * Yagona mavzu qatorini normalizatsiya va validatsiya qiladi.
   */
  public static validateTopic(
    topic: IngestionTopicInput,
    subject: string,
    grade: string,
    source: string,
    meta?: {
      sourceId?: string;
      sourceVersion?: string;
      curriculumYear?: number;
      sourceUpdatedAt?: string;
      language?: string;
    },
  ): ValidationResult {
    const issues: DataQualityIssue[] = [];

    // 1. Fan tekshiruvi
    const trimmedSubject = subject?.trim() ?? "";
    if (!trimmedSubject || trimmedSubject.length < 2) {
      issues.push({
        severity: "ERROR",
        field: "subject",
        message: "Fan nomi ko'rsatilmagan yoki juda qisqa",
      });
    }

    const registryEntry = CURRICULUM_SUBJECT_REGISTRY[trimmedSubject];
    if (registryEntry && registryEntry.status === "NOT_AVAILABLE") {
      issues.push({
        severity: "ERROR",
        field: "subject",
        message: `«${trimmedSubject}» fani uchun rasmiy o'quv dasturi hali e'lon qilinmagan (status: NOT_AVAILABLE)`,
      });
    }

    // 2. Sinf tekshiruvi
    const trimmedGrade = grade?.trim() ?? "";
    if (!/^\d{1,2}-sinf$/.test(trimmedGrade)) {
      issues.push({
        severity: "ERROR",
        field: "grade",
        message: `Sinf formati noto'g'ri: "${trimmedGrade}". Kutilgan: "5-sinf" ... "11-sinf"`,
      });
    }

    // 3. Manba tekshiruvi
    const trimmedSource = source?.trim() ?? "";
    if (!trimmedSource || trimmedSource.length < 5) {
      issues.push({
        severity: "ERROR",
        field: "source",
        message: "Rasmiy manba ko'rsatilmagan (missing source)",
      });
    } else if (!/^https?:\/\//i.test(trimmedSource)) {
      issues.push({
        severity: "WARNING",
        field: "source",
        message: `Manba URL shaklida emas: "${trimmedSource}"`,
      });
    }

    // 4. Mavzu nomi tekshiruvi
    let normTopicName = normalizeApostrophes(topic?.topicName ?? "").trim();
    if (!normTopicName || normTopicName.length < 3) {
      issues.push({
        severity: "ERROR",
        field: "topicName",
        message: "Mavzu nomi bo'sh yoki juda qisqa (empty topic)",
      });
    } else if (/^\d+$/.test(normTopicName)) {
      issues.push({
        severity: "ERROR",
        field: "topicName",
        message: `Mavzu nomi faqat raqamlardan iborat bo'la olmaydi: "${normTopicName}"`,
      });
    }

    // 5. Unicode / Kirill-Lotin aralashuvi tekshiruvi
    const hasCyrillic = /[\u0400-\u04FF]/.test(normTopicName);
    const hasLatin = /[a-zA-Z]/.test(normTopicName);
    if (hasCyrillic && hasLatin) {
      issues.push({
        severity: "ERROR",
        field: "topicName",
        message: `Mavzu nomida kirill va lotin harflari noo'rin aralashgan: "${normTopicName}"`,
        topicName: normTopicName,
      });
    }

    // Oxiridagi nuqtalarni tozalash
    normTopicName = normTopicName.replace(/\.+$/, "").trim();

    // 6. Tavsif tekshiruvi
    const normDescription = normalizeApostrophes(topic?.description ?? "").trim();
    if (!normDescription) {
      issues.push({
        severity: "WARNING",
        field: "description",
        message: `Mavzu tavsifi bo'sh: "${normTopicName}"`,
        topicName: normTopicName,
      });
    }

    // 7. Soatlar tekshiruvi (Hours Quality)
    const hours = topic?.expectedHours;
    if (hours !== null && hours !== undefined) {
      if (typeof hours !== "number" || !Number.isInteger(hours)) {
        issues.push({
          severity: "ERROR",
          field: "expectedHours",
          message: `Soat butun son bo'lishi shart: ${hours}`,
          topicName: normTopicName,
        });
      } else if (hours < 0) {
        issues.push({
          severity: "ERROR",
          field: "expectedHours",
          message: `Manfiy dars soati mumkin emas: ${hours}`,
          topicName: normTopicName,
        });
      } else if (hours === 0) {
        issues.push({
          severity: "WARNING",
          field: "expectedHours",
          message: `0 soat ko'rsatilgan: "${normTopicName}"`,
          topicName: normTopicName,
        });
      } else if (hours > 120) {
        issues.push({
          severity: "ERROR",
          field: "expectedHours",
          message: `Imkonsiz darajada katta dars soati (>120): ${hours}`,
          topicName: normTopicName,
        });
      }
    }

    // 8. Kutilayotgan natijalar tekshiruvi (Outcomes Quality)
    const outcomes = Array.isArray(topic?.expectedOutcomes) ? topic.expectedOutcomes : [];
    const cleanOutcomes: string[] = [];
    for (const outcome of outcomes) {
      if (typeof outcome !== "string" || !outcome.trim()) {
        issues.push({
          severity: "WARNING",
          field: "expectedOutcomes",
          message: "Bo'sh yoki noto'g'ri shakldagi kutilayotgan natija olib tashlandi",
          topicName: normTopicName,
        });
        continue;
      }
      const normOutcome = normalizeApostrophes(outcome).trim();
      if (normOutcome.length >= 5) {
        cleanOutcomes.push(normOutcome);
      } else {
        issues.push({
          severity: "WARNING",
          field: "expectedOutcomes",
          message: `Kutilayotgan natija juda qisqa: "${normOutcome}"`,
          topicName: normTopicName,
        });
      }
    }

    const hasErrors = issues.some((i) => i.severity === "ERROR");

    // Deterministic sourceId va sourceVersion yaratish
    const autoSourceId =
      meta?.sourceId ??
      `${trimmedSubject.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${trimmedGrade}-${normTopicName.slice(0, 20).toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
    const autoSourceVersion = meta?.sourceVersion ?? registryEntry?.sourceVersion ?? "DTS-2025-v1";
    const autoYear = meta?.curriculumYear ?? registryEntry?.curriculumYear;

    const normalizedRecord: NormalizedTopicRecord = {
      subject: trimmedSubject,
      grade: trimmedGrade,
      topicName: normTopicName,
      description: normDescription,
      expectedHours: hours ?? null,
      expectedOutcomes: cleanOutcomes,
      source: trimmedSource,
      sourceId: autoSourceId,
      sourceVersion: autoSourceVersion,
      curriculumYear: autoYear,
      sourceUpdatedAt: meta?.sourceUpdatedAt ?? registryEntry?.sourceUpdatedAt,
      language: meta?.language ?? "uz",
    };

    return {
      isValid: !hasErrors,
      issues,
      normalizedRecord: hasErrors ? undefined : normalizedRecord,
    };
  }

  /**
   * Butun faylni yoki dastur to'plamini ingestion qiladi.
   */
  public static ingestCurriculumFile(fileInput: IngestionFileInput): {
    summary: PipelineSummary;
    records: NormalizedTopicRecord[];
  } {
    const issues: DataQualityIssue[] = [];
    const validRecords: NormalizedTopicRecord[] = [];
    const seenTopicKeys = new Set<string>();
    let duplicateCount = 0;

    const { subject, grade, source, sourceId, sourceVersion, curriculumYear, sourceUpdatedAt, language, topics } =
      fileInput;

    if (!Array.isArray(topics) || topics.length === 0) {
      issues.push({
        severity: "ERROR",
        field: "topics",
        message: "Faylda birorta ham mavzu yo'q",
      });
      return {
        summary: {
          totalInputTopics: 0,
          validTopics: 0,
          rejectedTopics: 0,
          duplicateTopics: 0,
          warningsCount: issues.filter((i) => i.severity === "WARNING").length,
          issues,
        },
        records: [],
      };
    }

    for (let i = 0; i < topics.length; i++) {
      const topic = topics[i];
      const res = this.validateTopic(topic, subject, grade, source, {
        sourceId: sourceId ? `${sourceId}-${i + 1}` : undefined,
        sourceVersion,
        curriculumYear,
        sourceUpdatedAt,
        language,
      });

      issues.push(...res.issues);

      if (res.isValid && res.normalizedRecord) {
        // Takrorlanish tekshiruvi (nom va tavsif bir xilligi)
        const dedupKey = `${res.normalizedRecord.topicName.toUpperCase()}|${res.normalizedRecord.description.slice(0, 100).toUpperCase()}`;
        if (seenTopicKeys.has(dedupKey)) {
          duplicateCount++;
          issues.push({
            severity: "WARNING",
            field: "topicName",
            message: `Bir xil bo'lim bir necha marta qaytarilgan: "${res.normalizedRecord.topicName}"`,
            topicName: res.normalizedRecord.topicName,
          });
        } else {
          seenTopicKeys.add(dedupKey);
          validRecords.push(res.normalizedRecord);
        }
      }
    }

    const summary: PipelineSummary = {
      totalInputTopics: topics.length,
      validTopics: validRecords.length,
      rejectedTopics: topics.length - validRecords.length,
      duplicateTopics: duplicateCount,
      warningsCount: issues.filter((i) => i.severity === "WARNING").length,
      issues,
    };

    return {
      summary,
      records: validRecords,
    };
  }
}
