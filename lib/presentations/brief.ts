import type { LanguageCode } from "@/lib/validations/common";
import type { LessonPlanContent } from "@/lib/validations/lesson-plan";
import {
  naturalSlideCount,
  type StorylineArchetype,
} from "@/lib/presentations/storyline";
import { MAX_SLIDES, MIN_SLIDES } from "@/lib/validations/presentation";

/**
 * BRIF — foydalanuvchi so'rovini generatsiya qaroriga aylantiradi.
 *
 * ── Nega bu bosqich AI'ga berilmaydi ──────────────────────────────────────
 * "Aynan 10 ta slayd" degan talab AI'ga aytilganda u taxminan 70% holatda
 * bajariladi — qolganida 9 yoki 11 ta slayd keladi. Bu foydalanuvchi
 * uchun aniq nuqson, lekin modelni "yana urinib ko'r" deb qaytarish
 * ham qimmat, ham kafolatsiz.
 *
 * Shuning uchun SON, ARXETIP va AUDITORIYA bu yerda — oddiy va
 * o'qiladigan qoidalar bilan — aniqlanadi. AI keyin faqat MATN yozadi.
 * Natija: bir xil so'rov har doim bir xil skeletni beradi va uni
 * test bilan qulflash mumkin.
 *
 * ── Nega faqat matn tahlili ───────────────────────────────────────────────
 * Formada alohida "slaydlar soni" yoki "auditoriya" maydoni yo'q va uni
 * qo'shish interfeysni og'irlashtiradi. Foydalanuvchi bu narsalarni
 * mavzu matnining o'ziga yozadi ("investorlar uchun 10 ta slayd") —
 * shuning uchun matndan o'qiymiz.
 */

export type PresentationAudience =
  "students" | "teachers" | "investors" | "executives" | "general";

export type PresentationPurpose = "teach" | "persuade" | "inform" | "report";

export interface SlideCountDecision {
  value: number;
  /**
   * `explicit`  — foydalanuvchi sonni AYNAN aytdi, u buziladigan emas.
   * `structure` — dars ishlanmasi bosqichlaridan kelib chiqdi.
   * `scope`     — mavzu kengligiga qarab tanlandi.
   */
  source: "explicit" | "structure" | "scope";
}

export interface PresentationBrief {
  topic: string;
  subject: string | null;
  grade: string | null;
  language: LanguageCode;
  audience: PresentationAudience;
  purpose: PresentationPurpose;
  archetype: StorylineArchetype;
  /**
   * Arxetip ANIQ signal bilan tanlandimi.
   *
   * Tanlangan bo'lsa AI uni o'zgartira olmaydi: "investorlar uchun"
   * degan so'rovga ta'limiy struktura berish — so'rovni bajarmaslik.
   */
  archetypeLocked: boolean;
  slideCount: SlideCountDecision;
  /** "12 yoshli o'quvchilar uchun" → 12. Matn murakkabligini belgilaydi. */
  audienceAge: number | null;
  fromLessonPlan: boolean;
}

export interface BriefInput {
  topic: string;
  subject?: string | null;
  grade?: string | null;
  language: LanguageCode;
  lessonPlan?: LessonPlanContent;
}

/*
  ── Nima uchun uchala tilda kalit so'zlar ─────────────────────────────────
  Interfeys tili o'zbekcha bo'lsa ham, o'qituvchilar mavzuni ruscha yoki
  inglizcha yozishlari odatiy hol. Signalni faqat bitta tilda qidirsak,
  "for investors" deb yozgan foydalanuvchi ta'limiy struktura olardi.
*/

const INVESTOR_SIGNALS = [
  "investor",
  "investitsiya",
  "инвестор",
  "инвестици",
  "startap",
  "startup",
  "стартап",
  "venchur",
  "venture",
  "pitch",
  "pitch deck",
  "питч",
  "seed round",
  "fundraising",
];

const REPORT_SIGNALS = [
  "hisobot",
  "отчет",
  "отчёт",
  "report",
  "chorak",
  "kvartal",
  "квартал",
  "quarterly",
  "yillik natija",
  "annual",
  "итоги",
  "kpi",
  "metrika",
  "метрик",
];

const BUSINESS_SIGNALS = [
  "biznes",
  "бизнес",
  "business",
  "strategiya",
  "стратеги",
  "strategy",
  "rahbariyat",
  "руководств",
  "management",
  "taklif",
  "предложени",
  "proposal",
  "loyiha taklifi",
  "roadmap",
];

const EDUCATION_SIGNALS = [
  "dars",
  "o'quvchi",
  "oquvchi",
  "sinf",
  "maktab",
  "урок",
  "ученик",
  "класс",
  "школ",
  "lesson",
  "student",
  "pupil",
  "grade",
  "school",
  "tushuntir",
  "объясн",
  "explain",
  "teach",
  "o'rgat",
];

const TEACHER_SIGNALS = [
  "o'qituvchi",
  "oqituvchi",
  "ustoz",
  "pedagog",
  "учител",
  "преподавател",
  "teacher",
  "educator",
];

const EXECUTIVE_SIGNALS = [
  "rahbar",
  "direktor",
  "руководител",
  "директор",
  "executive",
  "board",
  "kengash",
  "stakeholder",
];

/** Matnni qidirish uchun normallashtiradi — apostrof variantlari birlashtiriladi. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’ʻʼ`´]/g, "'")
    .replace(/\s+/g, " ");
}

function hasAny(haystack: string, needles: string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

/*
  ── Slaydlar sonini o'qish ────────────────────────────────────────────────

  Raqam SLAYD so'zining yonida turishi SHART. Bu tasodifiy mosliklarni
  kesadi: "5-sinf uchun fotosintez" dagi 5 — sinf, slayd emas; "2024 yil
  hisoboti" dagi 2024 ham son, lekin slayd soni emas.

  Ikkala tartib ham qo'llab-quvvatlanadi, chunki tillar har xil yozadi:
    · "10 ta slayd", "10 slides", "10 слайдов"  → son OLDIN
    · "slayd soni: 10", "slides: 10"            → son KEYIN
*/
const SLIDE_WORD = "(?:slayd(?:lar)?|slide[sz]?|сла[йй]д(?:ов|а|ы)?)";
/*
  Ajratgich `[\s-]*` — chiziqcha ham hisoblanadi. Inglizcha "7-slide
  report" shakli aynan shunday yoziladi va faqat bo'sh joyni kutgan
  qoida uni o'tkazib yuborardi.
*/
const COUNT_BEFORE = new RegExp(
  `(\\d{1,2})[\\s-]*(?:ta[\\s-]*|тa[\\s-]*)?${SLIDE_WORD}`,
  "i",
);
const COUNT_AFTER = new RegExp(
  `${SLIDE_WORD}\\s*(?:soni|count|число|:|-)?\\s*(\\d{1,2})`,
  "i",
);

/**
 * Mavzu matnidan slaydlar sonini o'qiydi. Topilmasa `null`.
 *
 * Chegaradan chiqqan son (0, 1, 40) `null` qaytaradi — bu odatda boshqa
 * narsaning raqami. Chegara ichidagi son esa AYNAN bajariladi.
 */
export function parseExplicitSlideCount(text: string): number | null {
  const normalized = normalize(text);

  for (const pattern of [COUNT_BEFORE, COUNT_AFTER]) {
    const match = normalized.match(pattern);
    if (!match) continue;
    const value = Number.parseInt(match[1], 10);
    if (Number.isNaN(value)) continue;
    if (value < MIN_SLIDES || value > MAX_SLIDES) continue;
    return value;
  }

  return null;
}

/** "12 yoshli", "for 12-year-olds", "12-летних" → 12. */
export function parseAudienceAge(text: string): number | null {
  const normalized = normalize(text);
  // Chiziqcha ham ajratgich: "12-year-old", "12-yoshli".
  const match = normalized.match(
    /(\d{1,2})[\s-]*(?:yosh|yoshli|yoshdagi|year[-\s]?old|years old|лет|летн)/,
  );
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return value >= 4 && value <= 25 ? value : null;
}

/**
 * Sinf raqamidan taxminiy yosh.
 *
 * O'zbekistonda 1-sinfga 7 yoshda boriladi, shuning uchun yosh ≈ sinf + 6.
 * Bu aniq raqam emas va shart ham emas — u faqat matn murakkabligini
 * sozlash uchun ishlatiladi.
 */
function ageFromGrade(grade: string | null): number | null {
  if (!grade) return null;
  const match = grade.match(/(\d{1,2})/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  if (value < 1 || value > 11) return null;
  return value + 6;
}

/** Auditoriyani aniqlaydi. */
function detectAudience(text: string, fromLessonPlan: boolean): PresentationAudience {
  if (hasAny(text, INVESTOR_SIGNALS)) return "investors";
  if (hasAny(text, EXECUTIVE_SIGNALS)) return "executives";
  if (hasAny(text, TEACHER_SIGNALS)) return "teachers";
  if (fromLessonPlan || hasAny(text, EDUCATION_SIGNALS)) return "students";
  return "general";
}

/**
 * Arxetipni aniqlaydi.
 *
 * ── Tartib MUHIM ──────────────────────────────────────────────────────────
 * Eng SPETSIFIK signal eng oldin. "Investorlar uchun startap biznesi
 * haqida" — bu ham investor, ham biznes signalini beradi, lekin
 * foydalanuvchi aytayotgan narsa investor deck.
 *
 * ── Nega dars ishlanmasi har doim ta'limiy ────────────────────────────────
 * Dars ishlanmasidan tuzilgan prezentatsiya — darsning o'zi. Unga
 * investor strukturasini berish mantiqsiz, shuning uchun bu holat
 * boshqa signallardan ustun turadi.
 */
function detectArchetype(
  text: string,
  fromLessonPlan: boolean,
): { archetype: StorylineArchetype; locked: boolean } {
  if (fromLessonPlan) return { archetype: "educational", locked: true };
  if (hasAny(text, INVESTOR_SIGNALS)) return { archetype: "investor", locked: true };
  if (hasAny(text, REPORT_SIGNALS)) return { archetype: "report", locked: true };
  if (hasAny(text, EDUCATION_SIGNALS)) return { archetype: "educational", locked: true };
  if (hasAny(text, BUSINESS_SIGNALS)) return { archetype: "business", locked: true };

  /*
    Signal yo'q. Searcher AI — o'qituvchilar mahsuloti, shuning uchun
    standart taxmin ta'limiy. `locked: false` — AI outline bosqichida
    boshqa arxetip mosroq deb hisoblasa, uni almashtira oladi.
  */
  return { archetype: "educational", locked: false };
}

function purposeFor(archetype: StorylineArchetype): PresentationPurpose {
  switch (archetype) {
    case "educational":
      return "teach";
    case "investor":
      return "persuade";
    case "business":
      return "persuade";
    case "report":
      return "report";
  }
}

/*
  ── Mavzu kengligi ────────────────────────────────────────────────────────

  Foydalanuvchi sonni aytmasa, uni MAVZU o'zi aytishi kerak. "Fotosintez"
  bitta tushuncha — 6-7 slayd yetarli. "Sun'iy intellekt: tarixi,
  turlari, qo'llanishi va kelajagi" — to'rtta yo'nalish, ularni
  6 slaydga siqish mazmunni yo'qotadi.

  O'lchov oddiy: nechta mustaqil yo'nalish sanalgan.
*/
const BREADTH_SEPARATORS = /[,;:]|\bva\b|\bhamda\b|\bи\b|\band\b/gi;

const NARROW_SIGNALS = [
  "qisqacha",
  "qisqa",
  "кратко",
  "краткая",
  "brief",
  "short",
  "intro",
  "kirish",
  "введение",
  "bitta",
  "one",
];

/** Ruxsat etilgan slaydlar soni "zinapoyasi". */
const COUNT_LADDER = [5, 7, 8, 10, 12, 15] as const;

function nearestLadder(value: number): number {
  return COUNT_LADDER.reduce((best, candidate) =>
    Math.abs(candidate - value) < Math.abs(best - value) ? candidate : best,
  );
}

function stepLadder(value: number, steps: number): number {
  const index = COUNT_LADDER.indexOf(
    nearestLadder(value) as (typeof COUNT_LADDER)[number],
  );
  const next = Math.min(COUNT_LADDER.length - 1, Math.max(0, index + steps));
  return COUNT_LADDER[next];
}

/** Mavzu kengligiga qarab slaydlar sonini tanlaydi. */
function countFromScope(text: string, archetype: StorylineArchetype): number {
  const base = nearestLadder(naturalSlideCount(archetype));

  const branches = (text.match(BREADTH_SEPARATORS) ?? []).length;
  const wordCount = text.split(/\s+/).filter(Boolean).length;

  let steps = 0;
  // Uch va undan ortiq mustaqil yo'nalish — keng mavzu.
  if (branches >= 3 || wordCount >= 14) steps += 1;
  if (hasAny(text, NARROW_SIGNALS)) steps -= 1;

  return stepLadder(base, steps);
}

/**
 * Brifni quradi.
 *
 * Qaytadigan qiymat TO'LIQ deterministik: bir xil kirish — bir xil brif.
 * Shuning uchun uni AI'siz test qilish mumkin va Phase 2 test holatlari
 * aynan shu funksiyani tekshiradi.
 */
export function buildBrief(input: BriefInput): PresentationBrief {
  const fromLessonPlan = input.lessonPlan !== undefined;

  /*
    Signal qidiriladigan matn: mavzu VA fan/sinf. Sinf maydoni
    "8-sinf" bo'lsa, bu ham ta'limiy signal — foydalanuvchi uni
    mavzu matnida takrorlashi shart emas.
  */
  const haystack = normalize(
    [input.topic, input.subject ?? "", input.grade ?? ""].join(" "),
  );

  const { archetype, locked } = detectArchetype(haystack, fromLessonPlan);
  const explicit = parseExplicitSlideCount(input.topic);

  let slideCount: SlideCountDecision;

  if (explicit !== null) {
    slideCount = { value: explicit, source: "explicit" };
  } else if (input.lessonPlan) {
    /*
      Dars ishlanmasi bo'lsa son STRUKTURADAN keladi: har bosqichga
      bitta slayd, ustiga muqova va xulosa. Bu Phase 1 dagi xatti-
      harakat edi va o'qituvchilar unga o'rganib qolgan — o'zgartirish
      uchun sabab yo'q.
    */
    const wanted = input.lessonPlan.stages.length + 2;
    slideCount = {
      value: Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, wanted)),
      source: "structure",
    };
  } else {
    slideCount = { value: countFromScope(haystack, archetype), source: "scope" };
  }

  const audience = detectAudience(haystack, fromLessonPlan);

  return {
    topic: input.topic,
    subject: input.subject ?? null,
    grade: input.grade ?? null,
    language: input.language,
    audience,
    purpose: purposeFor(archetype),
    archetype,
    archetypeLocked: locked,
    slideCount,
    audienceAge: parseAudienceAge(input.topic) ?? ageFromGrade(input.grade ?? null),
    fromLessonPlan,
  };
}
