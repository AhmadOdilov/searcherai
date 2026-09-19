/**
 * Maktab fanlari davlat o'quv dasturi manbalar reyestri (Phase 2).
 *
 * Qat'iy qoida:
 *  - Rasmiy manba mavjud bo'lmasa, MA'LUMOT UYDIRILMAYDI.
 *  - Fake topic, fake hours, fake outcomes kiritilmaydi.
 *  - Manba yo'q fanlar statusi: NOT_AVAILABLE.
 */

import type { SubjectRegistryEntry } from "./types";

export const CURRICULUM_SUBJECT_REGISTRY: Record<string, SubjectRegistryEntry> = {
  Matematika: {
    subject: "Matematika",
    officialNameUz: "Matematika (Algebra va Geometriya)",
    officialNameRu: "Математика (Алгебра и Геометрия)",
    officialNameEn: "Mathematics (Algebra and Geometry)",
    status: "OFFICIAL",
    officialSourceUrl:
      "https://uzbmb.uz/upload/file/pdf/qabul2025/dasturlar/2.Matematika/",
    curriculumYear: 2025,
    sourceVersion: "DTS-UZBMB-2025-v1",
    sourceUpdatedAt: "2025-01-15T00:00:00.000Z",
    authorizedAuthority:
      "O'zbekiston Respublikasi Maktabgacha va maktab ta'limi vazirligi / Bilimni baholash agentligi",
    gradesAvailable: [
      "5-sinf",
      "6-sinf",
      "7-sinf",
      "8-sinf",
      "9-sinf",
      "10-sinf",
      "11-sinf",
    ],
  },
  "Ona tili": {
    subject: "Ona tili",
    officialNameUz: "Ona tili",
    officialNameRu: "Родной язык",
    officialNameEn: "Mother Tongue (Uzbek)",
    status: "OFFICIAL",
    officialSourceUrl:
      "https://uzbmb.uz/upload/file/pdf/qabul2025/dasturlar/1.Ona%20tili%20va%20adabiyot/",
    curriculumYear: 2025,
    sourceVersion: "DTS-UZBMB-2025-v1",
    sourceUpdatedAt: "2025-01-15T00:00:00.000Z",
    authorizedAuthority:
      "O'zbekiston Respublikasi Maktabgacha va maktab ta'limi vazirligi / Bilimni baholash agentligi",
    gradesAvailable: [
      "5-sinf",
      "6-sinf",
      "7-sinf",
      "8-sinf",
      "9-sinf",
      "10-sinf",
      "11-sinf",
    ],
  },
  Fizika: {
    subject: "Fizika",
    officialNameUz: "Fizika",
    officialNameRu: "Физика",
    officialNameEn: "Physics",
    status: "NOT_AVAILABLE",
    gradesAvailable: [],
  },
  Kimyo: {
    subject: "Kimyo",
    officialNameUz: "Kimyo",
    officialNameRu: "Химия",
    officialNameEn: "Chemistry",
    status: "NOT_AVAILABLE",
    gradesAvailable: [],
  },
  Biologiya: {
    subject: "Biologiya",
    officialNameUz: "Biologiya",
    officialNameRu: "Биология",
    officialNameEn: "Biology",
    status: "NOT_AVAILABLE",
    gradesAvailable: [],
  },
  Tarix: {
    subject: "Tarix",
    officialNameUz: "Tarix (O'zbekiston tarixi, Jahon tarixi)",
    officialNameRu: "История",
    officialNameEn: "History",
    status: "NOT_AVAILABLE",
    gradesAvailable: [],
  },
  Geografiya: {
    subject: "Geografiya",
    officialNameUz: "Geografiya",
    officialNameRu: "География",
    officialNameEn: "Geography",
    status: "NOT_AVAILABLE",
    gradesAvailable: [],
  },
  Informatika: {
    subject: "Informatika",
    officialNameUz: "Informatika va axborot texnologiyalari",
    officialNameRu: "Информатика",
    officialNameEn: "Informatics and IT",
    status: "NOT_AVAILABLE",
    gradesAvailable: [],
  },
  "Ingliz tili": {
    subject: "Ingliz tili",
    officialNameUz: "Ingliz tili (Chet tili)",
    officialNameRu: "Английский язык",
    officialNameEn: "English Language",
    status: "NOT_AVAILABLE",
    gradesAvailable: [],
  },
  Adabiyot: {
    subject: "Adabiyot",
    officialNameUz: "Adabiyot",
    officialNameRu: "Литература",
    officialNameEn: "Literature",
    status: "NOT_AVAILABLE",
    gradesAvailable: [],
  },
};

/**
 * Fanning rasmiy o'quv dasturi holatini tekshiradi.
 */
export function getSubjectCurriculumStatus(
  subjectName: string,
): SubjectRegistryEntry | null {
  const norm = subjectName.trim();
  for (const [key, entry] of Object.entries(CURRICULUM_SUBJECT_REGISTRY)) {
    if (key.toLowerCase() === norm.toLowerCase()) {
      return entry;
    }
  }
  return null;
}
