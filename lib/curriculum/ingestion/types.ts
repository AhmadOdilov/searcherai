/**
 * Curriculum Ingestion, Versioning va Source Provenance turlari (Phase 2, 3, 4, 5).
 */

export type CurriculumSourceStatus = "OFFICIAL" | "NOT_AVAILABLE" | "PENDING_REVIEW";

export interface SubjectRegistryEntry {
  subject: string;
  officialNameUz: string;
  officialNameRu: string;
  officialNameEn: string;
  status: CurriculumSourceStatus;
  officialSourceUrl?: string;
  curriculumYear?: number;
  sourceVersion?: string;
  sourceUpdatedAt?: string;
  authorizedAuthority?: string;
  gradesAvailable: string[];
}

export interface IngestionTopicInput {
  topicName: string;
  description: string;
  expectedHours: number | null;
  expectedOutcomes: string[];
}

export interface IngestionFileInput {
  subject: string;
  grade: string;
  source: string;
  sourceId?: string;
  sourceVersion?: string;
  curriculumYear?: number;
  sourceUpdatedAt?: string;
  language?: string;
  topics: IngestionTopicInput[];
}

export interface NormalizedTopicRecord {
  subject: string;
  grade: string;
  topicName: string;
  description: string;
  expectedHours: number | null;
  expectedOutcomes: string[];
  source: string;
  sourceId: string;
  sourceVersion: string;
  curriculumYear?: number;
  sourceUpdatedAt?: string;
  language: string;
}

export interface DataQualityIssue {
  severity: "ERROR" | "WARNING";
  field: string;
  message: string;
  topicName?: string;
}

export interface ValidationResult {
  isValid: boolean;
  issues: DataQualityIssue[];
  normalizedRecord?: NormalizedTopicRecord;
}

export interface PipelineSummary {
  totalInputTopics: number;
  validTopics: number;
  rejectedTopics: number;
  duplicateTopics: number;
  warningsCount: number;
  issues: DataQualityIssue[];
}

export type SourceTrustLevel =
  "official" | "verified" | "secondary" | "generated" | "unknown";

export interface CurriculumTopicRecordV3 {
  subject: string;
  grade: string;
  topicName: string;
  aliases: string[];
  description: string;
  expectedHours: number | null;
  expectedOutcomes: string[];
  source: string;
  sourceType: SourceTrustLevel;
  language: string;
  educationLevel: "primary" | "secondary" | "high";
  curriculumVersion: string;
}
