/**
 * O'zbek va ko'p tilli qidiruv normalizatsiyasi.
 *
 * Vazifalari:
 *  1. Apostrof variantlarini standartlashtirish (o', o‘, oʻ, o`, o').
 *  2. Kirillcha o'zbekcha yozuvni lotinchaga moslashtirish (ў -> o', қ -> q, ғ -> g', ҳ -> h).
 *  3. Sinf belgilarini standartlashtirish ("7 sinf", "7sinf", "7-синф" -> "7-sinf").
 *  4. Ko'p uchraydigan pedagogik va ilmiy so'zlardagi typo'larni tuzatish.
 *  5. Asl so'rovni (originalQuery) va tozalangan so'rovni (normalizedQuery) saqlash.
 */

/** Turli xil apostrof belgilarini yagona standartga keltirish */
const APOSTROPHE_REGEX = /[\u2018\u2019\u02BB\u02BC\u0060\u00B4]/g;

/** O'zbek kirillcha -> lotincha xaritalash */
const CYRILLIC_TO_LATIN_MAP: Record<string, string> = {
  а: "a",
  б: "b",
  в: "v",
  г: "g",
  д: "d",
  е: "e",
  ё: "yo",
  ж: "j",
  з: "z",
  и: "i",
  й: "y",
  к: "k",
  л: "l",
  м: "m",
  н: "n",
  о: "o",
  п: "p",
  р: "r",
  с: "s",
  т: "t",
  у: "u",
  ф: "f",
  х: "x",
  ц: "ts",
  ч: "ch",
  ш: "sh",
  щ: "sh",
  ъ: "'",
  ы: "i",
  ь: "",
  э: "e",
  ю: "yu",
  я: "ya",
  ў: "o'",
  қ: "q",
  ғ: "g'",
  ҳ: "h",
};

/** Pedagogik va faniy atamalar bo'yicha keng tarqalgan xatolar lug'ati (o'zak va to'liq shakllar) */
const TYPO_MAP: Record<string, string> = {
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
};

export interface NormalizedQuery {
  original: string;
  cleaned: string;
  normalized: string;
  isCyrillic: boolean;
  tokens: string[];
  corrections: Array<{ from: string; to: string }>;
}

/**
 * Matndagi kirillcha o'zbek so'zlarini lotinchaga o'tkazadi.
 */
export function cyrillicToLatin(text: string): string {
  let result = "";
  const lower = text.toLowerCase();

  for (let i = 0; i < lower.length; i++) {
    const char = lower[i];
    result += CYRILLIC_TO_LATIN_MAP[char] ?? char;
  }

  return result;
}

/**
 * Kirill yozuvidagi matn ekanligini aniqlaydi.
 */
export function isCyrillicText(text: string): boolean {
  const cyrillicMatch = text.match(/[\u0400-\u04FF]/g);
  if (!cyrillicMatch) return false;
  return cyrillicMatch.length >= 3 || cyrillicMatch.length / text.length > 0.3;
}

/**
 * Apostroflarni yagona standart belgi `'` ga keltiradi.
 */
export function normalizeApostrophes(text: string): string {
  return text.replace(APOSTROPHE_REGEX, "'");
}

/**
 * Sinf ifodalarini standart shaklga keltiradi: "7 sinf", "7sinf", "7-синф" -> "7-sinf"
 * Unicode mos bo'lishi uchun \b o'rniga boundary tekshiruvi.
 */
export function normalizeGrades(text: string): string {
  return text
    .replace(/(^|[^\p{L}\p{N}])([1-9]|1[0-1])\s*[-_]?\s*(?:sinf|синф|class|grade|класс[а-я]*)(?=$|[^\p{L}\p{N}])/giu, "$1$2-sinf")
    .replace(/(^|[^\p{L}\p{N}])(?:sinf|синф|class|grade|класс[а-я]*)\s*([1-9]|1[0-1])(?=$|[^\p{L}\p{N}])/giu, "$1$2-sinf");
}

/**
 * So'rovni to'liq normalizatsiya qiladi.
 */
export function normalizeQuery(query: string): NormalizedQuery {
  const original = query.trim();
  const isCyrillic = isCyrillicText(original);

  // 1. Apostroflarni birlashtirish
  let step1 = normalizeApostrophes(original);

  // 2. Sinf ifodalarini birlashtirish (kirillcha "8-синф" ham "8-sinf" ga aylanadi)
  step1 = normalizeGrades(step1);

  // 3. Kirill harflarini (to'liq yoki aralash) lotinga o'tkazish
  step1 = cyrillicToLatin(step1);

  // 4. Tokenlarga ajratish va typo tekshiruvi
  const words = step1.split(/\s+/);
  const corrections: Array<{ from: string; to: string }> = [];

  const normalizedWords = words.map((rawWord) => {
    // Tinish belgilaridan tozalash
    const cleanWord = rawWord.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");
    if (TYPO_MAP[cleanWord]) {
      const fixed = TYPO_MAP[cleanWord];
      corrections.push({ from: cleanWord, to: fixed });
      return rawWord.toLowerCase().replace(cleanWord, fixed);
    }
    // Agar o'zagi fatasintez bo'lsa
    if (cleanWord.startsWith("fatasintez")) {
      const fixed = cleanWord.replace("fatasintez", "fotosintez");
      corrections.push({ from: cleanWord, to: fixed });
      return rawWord.toLowerCase().replace(cleanWord, fixed);
    }
    return rawWord.toLowerCase();
  });

  const normalized = normalizedWords.join(" ").trim();
  const tokens = normalized
    .split(/[^\p{L}\p{N}']+/u)
    .filter((token) => token.length > 0);

  return {
    original,
    cleaned: step1,
    normalized,
    isCyrillic,
    tokens,
    corrections,
  };
}
