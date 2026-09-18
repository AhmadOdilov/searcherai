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

import { correctWord } from "./typo-engine";

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

export interface NormalizedQuery {
  original: string;
  cleaned: string;
  normalized: string;
  isCyrillic: boolean;
  tokens: string[];
  corrections: Array<{ from: string; to: string }>;
  didYouMean?: string;
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
 * Sinf ifodalarini standart shaklga keltiradi: "7 sinf", "7sinf", "7-синф", "8-sinfga" -> "7-sinf", "8-sinf"
 * Unicode mos bo'lishi uchun \b o'rniga boundary tekshiruvi va kelishik qo'shimchalari inobatga olinadi.
 */
export function normalizeGrades(text: string): string {
  return text
    .replace(/(^|[^\p{L}\p{N}])([1-9]|1[0-1])\s*[-_]?\s*(?:sinf|синф|class|grade|класс)(?:[a-z'\p{L}]*)?(?=$|[^\p{L}\p{N}])/giu, "$1$2-sinf")
    .replace(/(^|[^\p{L}\p{N}])(?:sinf|синф|class|grade|класс)\s*([1-9]|1[0-1])(?=$|[^\p{L}\p{N}])/giu, "$1$2-sinf");
}

/**
 * O'zbek tili uchun yengil morfologik o'zak ajratgich (Phase 4).
 * Qisqa so'zlarni (tar, ona, fan, suv, nur) false-positive yaratmaslik uchun himoyalaydi (kamida 3 harf).
 */
export function stemUzbekWord(word: string): string {
  const w = word.toLowerCase().trim();
  if (w.length <= 3) return w;

  // 1. Egalik va kelishik qo'shimchalari: -larining, -laridan, -lariga, -larini, -larida
  if (w.length > 7 && /(?:larining|laridan|lariga|larini|larida)$/.test(w)) {
    const stem = w.replace(/(?:larining|laridan|lariga|larini|larida)$/, "");
    if (stem.length >= 3) return stem;
  }
  // 2. -larning, -lardan, -larga, -larni, -larda
  if (w.length > 6 && /(?:larning|lardan|larga|larni|larda)$/.test(w)) {
    const stem = w.replace(/(?:larning|lardan|larga|larni|larda)$/, "");
    if (stem.length >= 3) return stem;
  }
  // 3. -ning, -dan
  if (w.length > 5 && /(?:ning|dan)$/.test(w)) {
    const stem = w.replace(/(?:ning|dan)$/, "");
    if (stem.length >= 3) return stem;
  }
  // 4. -lar, -ga, -ka, -qa, -da, -ni
  if (w.length > 4 && /(?:lar|ga|ka|qa|da|ni)$/.test(w)) {
    const stem = w.replace(/(?:lar|ga|ka|qa|da|ni)$/, "");
    if (stem.length >= 3) return stem;
  }
  // 5. -si, -miz
  if (w.length > 4 && /(?:si|miz)$/.test(w)) {
    const stem = w.replace(/(?:si|miz)$/, "");
    if (stem.length >= 3) return stem;
  }

  return w;
}

/**
 * So'zdagi apostroflarning turli Unicode variantlarini va apostrofsiz shaklini qaytaradi.
 * PostgreSQL ILIKE yoki contains qidiruvida ' vs ‘ vs ’ vs ʻ nomuvofiqligini yo'qotadi.
 */
export function getApostropheVariants(term: string): string[] {
  const clean = term.trim();
  if (!clean) return [];

  const hasApostrophe = /['\u2018\u2019\u02BB\u02BC]/.test(clean);
  if (!hasApostrophe) {
    return [clean];
  }

  const ascii = clean.replace(/['\u2018\u2019\u02BB\u02BC]/g, "'");
  const leftCurly = clean.replace(/['\u2018\u2019\u02BB\u02BC]/g, "\u2018");
  const rightCurly = clean.replace(/['\u2018\u2019\u02BB\u02BC]/g, "\u2019");
  const modLetter = clean.replace(/['\u2018\u2019\u02BB\u02BC]/g, "\u02BB");
  const stripped = clean.replace(/['\u2018\u2019\u02BB\u02BC]/g, "");

  return Array.from(new Set([ascii, leftCurly, rightCurly, modLetter, stripped]));
}

/**
 * So'rovni to'liq normalizatsiya qiladi.
 */
/**
 * Boshqaruv belgilari (C0/C1) va nolinchi kenglikdagi belgilar.
 *
 * Qidiruv moduli chaqiruvchi matnni tozalaganiga TAYANMAYDI: `stripTags`
 * API qatlamida ishlaydi, lekin baholash skriptlari, fon vazifalari yoki
 * kelajakdagi yangi chaqiruv nuqtalari uni chetlab o'tishi mumkin.
 * NUL bayti esa PostgreSQL'da `22021` xatosiga olib keladi.
 */
const UNSAFE_INVISIBLE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\uFEFF]/g;

export function normalizeQuery(query: string): NormalizedQuery {
  const original = query.replace(UNSAFE_INVISIBLE, " ").replace(/\s+/g, " ").trim();
  const isCyrillic = isCyrillicText(original);

  // 1. Apostroflarni birlashtirish
  let step1 = normalizeApostrophes(original);

  // 2. Sinf ifodalarini birlashtirish (kirillcha "8-синф" ham "8-sinf" ga aylanadi)
  step1 = normalizeGrades(step1);

  // 3. Kirill harflarini (to'liq yoki aralash) lotinga o'tkazish
  step1 = cyrillicToLatin(step1);

  // 4. Tokenlarga ajratish va typo tekshiruvi (Typo Engine V2)
  const words = step1.split(/\s+/);
  const corrections: Array<{ from: string; to: string }> = [];
  const didYouMeanSuggestions: string[] = [];

  const normalizedWords = words.map((rawWord) => {
    const cleanWord = rawWord.toLowerCase().replace(/^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu, "");
    if (!cleanWord) return rawWord.toLowerCase();

    const typoResult = correctWord(cleanWord);
    if (typoResult.method !== "none" && typoResult.corrected !== cleanWord) {
      corrections.push({ from: cleanWord, to: typoResult.corrected });
      return rawWord.toLowerCase().replace(cleanWord, typoResult.corrected);
    }
    if (typoResult.didYouMean) {
      didYouMeanSuggestions.push(typoResult.didYouMean);
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
    didYouMean: didYouMeanSuggestions.length > 0 ? didYouMeanSuggestions.join(" ") : undefined,
  };
}
