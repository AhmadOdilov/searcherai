/**
 * Qidiruv so'rovini chuqur tahlil qilish (Query Understanding).
 *
 * Vazifalari:
 *  1. Tilni aniqlash (UZ, RU, EN).
 *  2. Fanni aniqlash (Matematika, Ona tili, Fizika, Kimyo, Biologiya, Tarix, va h.k.).
 *  3. Sinfni aniqlash (1-sinf ... 11-sinf).
 *  4. Intent (maqsad)ni aniqlash:
 *     - explain, lesson_plan, presentation, quiz_test, worksheet,
 *       curriculum, classroom_activity, definition, compare, search_topic
 *  5. Auditoriyani aniqlash (teacher yoki student).
 *  6. Asosiy ilmiy/ta'limiy mavzuni (topic/entities) ajratib olish.
 */

import type { LanguageCode } from "@/lib/validations/common";
import { normalizeQuery, type NormalizedQuery } from "./normalization";

export type SearchIntent =
  | "explain"
  | "lesson_plan"
  | "presentation"
  | "quiz_test"
  | "worksheet"
  | "curriculum"
  | "classroom_activity"
  | "definition"
  | "compare"
  | "search_topic";

export type AudienceMode = "teacher" | "student";

export interface QueryUnderstanding {
  normalized: NormalizedQuery;
  detectedLanguage: LanguageCode;
  detectedSubject?: string;
  detectedGrade?: string;
  detectedIntent: SearchIntent;
  audience: AudienceMode;
  extractedTopic: string;
  keywords: string[];
}

/** Fanlar lug'ati va ularga mos kalit so'zlar */
const SUBJECT_PATTERNS: Array<{ subject: string; patterns: RegExp[] }> = [
  {
    subject: "Matematika",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:matematik[a-z]*|algebra[a-z]*|geometri[a-z]*|arifmetik[a-z]*|hisob|сонлар|математик[а-я]*|алгебр[а-я]*|геометр[а-я]*|дроби|числа)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    subject: "Ona tili",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:ona tili|adabiyot[a-z]*|grammatik[a-z]*|imlo|lug'at|ona tilidan|она тили|адабиёт[а-я]*|русский язык|литератур[а-я]*)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    subject: "Fizika",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:fizik[a-z]*|mexanik[a-z]*|optik[a-z]*|elektr[a-z]*|termodinamik[a-z]*|dinamik[a-z]*|физик[а-я]*)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    subject: "Kimyo",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:kimyo[a-z]*|modda|reaksiya|davriy jadval|molekula|хими[а-я]*)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    subject: "Biologiya",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:biolog[a-z]*|anatomiy[a-z]*|botanik[a-z]*|zoologiy[a-z]*|hujayra|fotosintez|биолог[а-я]*)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    subject: "Tarix",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:tarix[a-z]*|jahon tarixi|o'zbekiston tarixi|sulola|jang|тарих[а-я]*|истори[а-я]*)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    subject: "Geografiya",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:geograf[a-z]*|materik|okean|iqlim|xarita|географ[а-я]*)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    subject: "Informatika",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:informatik[a-z]*|dasturlash|algoritm|kompyuter|axborot|информатик[а-я]*)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    subject: "Ingliz tili",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:ingliz tili|english|grammar|vocabulary|ingliz tilidan|английск[а-я]*)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
];

/** Intent markerlari */
const INTENT_PATTERNS: Array<{ intent: SearchIntent; patterns: RegExp[] }> = [
  {
    intent: "lesson_plan",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:dars ishlanma|dars ishlanmasi|dars reja|konspekt|45 daqiqa|45 minut|texnologik xarita|поурочный план|план урока|конспект урока|plan uroka|pourochn|konspekt uroka|lesson plan)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "presentation",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:prezentatsiya|taqdimot|slayd|slaydlar|powerpoint|pptx|презентация|слайды|prezentatsi|presentation|slides)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "quiz_test",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:test|testlar|viktorina|savol-javob|nazorat ishi|savollar tuz|тест|тесты|вопросы к уроку|voprosy k uroku|quiz|test questions)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "worksheet",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:mashq|mashqlar|topshiriq|topshiriqlar|tarqatma|amaliy ish|uyga vazifa|упражнения|задания|раздатка|uprajneni|zadaniya|razdatka|worksheet|exercises)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "curriculum",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:o'quv dasturi|davlat dasturi|soat|ajratilgan soat|dts|standart|mavzular ketma-ketligi|учебная программа|стандарт|uchebnaya programma|curriculum|syllabus)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "classroom_activity",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:metod|interaktiv|metodika|o'yin|faoliyat|guruhda ishlash|sinfda qo'llash|interaktiv usul|методика|игры на уроке|metodika|igry na uroke|classroom activity|teaching method)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "definition",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:ta'rifi|ta'rif|qoidasi|nima degani|определение|что такое|opredeleni|chto takoe|definition of|meaning of)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "compare",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:taqqosla|farqi|o'xshashligi|solishtir|farqlari|сравни|разница между|sravni|raznitsa|compare|difference)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
  {
    intent: "explain",
    patterns: [
      /(?:^|[^\p{L}\p{N}])(?:tushuntir|qanday tushuntir|tushuntirib ber|mohiyati|tushuntirish|объясни|как объяснить|obyasni|kak obyasnit|explain|how to explain)(?=$|[^\p{L}\p{N}])/giu,
    ],
  },
];

/**
 * Matn tilini aniqlaydi.
 */
export function detectLanguage(text: string, fallback: LanguageCode = "UZ"): LanguageCode {
  // 1. Ruscha so'zlar / kirillcha
  const russianPattern = /(?:^|[^\p{L}\p{N}])(?:как|что|это|урок|план|для|класса|объяснить|вопрос|почему|зачем|поурочный|поурочные|дроби|задачи|упражнения)(?=$|[^\p{L}\p{N}])/giu;
  if (russianPattern.test(text)) return "RU";

  // 2. Inglizcha so'zlar
  const englishPattern = /\b(?:how|what|why|lesson|plan|grade|class|teach|explain|student|teacher)\b/i;
  if (englishPattern.test(text)) return "EN";

  // 3. Agar kirill bo'lib ruscha belgilar ko'p bo'lsa
  if (/[ыэъ]/i.test(text) && !/[ўқғҳ]/i.test(text)) {
    return "RU";
  }

  // 4. O'zbekcha belgilar yoki so'zlar
  const uzbekPattern = /(?:^|[^\p{L}\p{N}])(?:dars|sinf|uchun|qanday|nima|ishlanma|reja|haqida|mavzu)(?=$|[^\p{L}\p{N}])/giu;
  if (uzbekPattern.test(text) || /[ўқғҳo'g']/i.test(text)) {
    return "UZ";
  }

  return fallback;
}

/**
 * So'rovdan fan nomini aniqlaydi.
 */
export function detectSubject(text: string): string | undefined {
  for (const item of SUBJECT_PATTERNS) {
    for (const pattern of item.patterns) {
      if (pattern.test(text)) {
        return item.subject;
      }
    }
  }
  return undefined;
}

/**
 * So'rovdan sinf darajasini aniqlaydi ("5-sinf" ... "11-sinf").
 */
export function detectGrade(text: string): string | undefined {
  const match = text.match(/(?:^|[^\p{L}\p{N}])([1-9]|1[0-1])-sinf(?=$|[^\p{L}\p{N}])/iu);
  if (match) {
    return `${match[1]}-sinf`;
  }
  return undefined;
}

/**
 * So'rov intentini aniqlaydi.
 */
export function detectIntent(text: string): SearchIntent {
  for (const item of INTENT_PATTERNS) {
    for (const pattern of item.patterns) {
      if (pattern.test(text)) {
        return item.intent;
      }
    }
  }
  return "explain"; // Birlamchi standart — tushuntirish
}

/**
 * Auditoriyani aniqlaydi (o'qituvchi yoki o'quvchi).
 */
export function detectAudience(text: string, intent: SearchIntent): AudienceMode {
  if (
    intent === "lesson_plan" ||
    intent === "presentation" ||
    intent === "curriculum" ||
    intent === "classroom_activity" ||
    /(?:^|[^\p{L}\p{N}])(?:o'qituvchi|sinfda|darsga|o'quvchilarga|baholash|konspekt|metodist|учителю|на уроке)(?=$|[^\p{L}\p{N}])/giu.test(text)
  ) {
    return "teacher";
  }

  if (
    /(?:^|[^\p{L}\p{N}])(?:menga tushunarsiz|tushunmadim|o'quvchiman|masalani yech|uy vazifam|maktabdaman|я ученик)(?=$|[^\p{L}\p{N}])/giu.test(text)
  ) {
    return "student";
  }

  return "teacher"; // Qidiruv platformamiz o'qituvchilarga yo'naltirilgan
}

/**
 * So'rovdan asosiy mavzu / ob'ektni (topic) ajratadi.
 */
export function extractTopic(
  text: string,
  subject?: string,
  grade?: string,
): { topic: string; keywords: string[] } {
  let cleaned = text;

  // 1. Sinfni olib tashlash
  if (grade) {
    cleaned = cleaned.replace(new RegExp(`\\b${grade}\\b`, "gi"), "");
  }
  cleaned = cleaned.replace(/\b([1-9]|1[0-1])-sinf\b/gi, "");

  // 2. Fan nomlarini olib tashlash
  if (subject) {
    cleaned = cleaned.replace(new RegExp(`\\b${subject}\\b`, "gi"), "");
  }
  for (const item of SUBJECT_PATTERNS) {
    for (const pattern of item.patterns) {
      cleaned = cleaned.replace(pattern, "");
    }
  }

  // 3. Umumiy savol va intent so'zlarini tozalash
  cleaned = cleaned.replace(
    /(?:^|[^\p{L}\p{N}])(?:uchun|haqida|nima|qanday|tushuntir|tushuntirish|tushuntirib ber|ber|kerak|qilish|tuz|dars|ishlanma|reja|slayd|prezentatsiya|test|savol|metod|mavzusi|mavzusini|mavzuda|qoidasi|ta'rifi|для|как|план|урока|поурочный)(?=$|[^\p{L}\p{N}])/giu,
    "",
  );

  // Tinish belgilaridan tozalash
  cleaned = cleaned.replace(/[?!.,;:"'()\[\]{}—–-]/g, " ").trim();
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 3);

  const topic = words.join(" ").trim();
  return {
    topic: topic.length > 0 ? topic : text.trim(),
    keywords: words,
  };
}

/**
 * Foydalanuvchi so'rovini to'liq tahlil qilib, strukturaviy tushunish obyektini qaytaradi.
 */
export function understandQuery(
  rawQuery: string,
  manualSubject?: string,
  manualGrade?: string,
  manualLanguage?: LanguageCode,
): QueryUnderstanding {
  const normalized = normalizeQuery(rawQuery);

  const detectedLanguage = manualLanguage ?? detectLanguage(rawQuery);
  const detectedSubject = manualSubject ?? detectSubject(normalized.normalized);
  const detectedGrade = manualGrade ?? detectGrade(normalized.normalized);
  const detectedIntent = detectIntent(normalized.normalized);
  const audience = detectAudience(normalized.normalized, detectedIntent);

  const { topic: extractedTopic, keywords } = extractTopic(
    normalized.normalized,
    detectedSubject,
    detectedGrade,
  );

  return {
    normalized,
    detectedLanguage,
    detectedSubject,
    detectedGrade,
    detectedIntent,
    audience,
    extractedTopic,
    keywords,
  };
}
