/**
 * Prezentatsiya shablonlari — rang, shrift va o'lchamlar.
 *
 * Alohida faylda, chunki dizayn o'zgarganda generatsiya mantig'iga
 * tegmaslik kerak. Barcha o'lchamlar DUYMDA (inch) — pptxgenjs shu
 * birlikda ishlaydi. 16:9 slayd = 10 × 5.625 duym.
 */

export const SLIDE = {
  width: 10,
  height: 5.625,
} as const;

/**
 * "Maktab" palitrasi — ilovaning o'zi bilan BIR XIL ranglar
 * (`app/globals.css` dagi tokenlar).
 *
 * Ilgari slaydlar ko'kish-kulrang (slate) edi, ilova esa zumrad —
 * o'qituvchi ekranda bir rangni ko'rib, yuklab olgan faylda boshqasini
 * ko'rardi. Ranglar bu yerda ARGB emas, RGB: pptxgenjs shu shaklni
 * kutadi.
 */
const MAKTAB = {
  /** Asosiy zumrad — `--color-primary`. */
  primary: "0F766E",
  primaryDark: "134E4A",
  /** Och zumrad — to'q fon ustidagi ikkinchi darajali matn. */
  primaryLight: "99F6E4",
  /** Ogohlantirish/aksent — `--color-accent`. */
  accent: "B45309",
  /** Iliq qora — `--color-neutral-900`. */
  ink: "1C1A17",
  /** Asosiy matn — `--color-neutral-700`. */
  body: "433E36",
  /** Ikkinchi darajali matn — `--color-neutral-400`. */
  muted: "A8A093",
  /** Ajratuvchi chiziq — `--color-neutral-200`. */
  rule: "E7E3DC",
  white: "FFFFFF",
  /** Iliq oq — `--color-canvas`. */
  canvas: "FAF9F7",
} as const;

/** Bitta shablonning to'liq tavsifi. */
export interface PptxPalette {
  /** Sarlavha slaydi. */
  titleBackground: string;
  titleText: string;
  titleSubtext: string;
  /** Mazmun slaydlari. */
  background: string;
  heading: string;
  body: string;
  muted: string;
  /** Sarlavha ostidagi chiziq. */
  rule: string;
  /** Xulosa slaydining sarlavhasi va chizig'i. */
  summary: string;
  /**
   * Har slaydning chap chetidagi rangli tasma.
   *
   * `null` — tasma yo'q. Bu shablonlar orasidagi YAGONA tuzilma farqi;
   * qolgan hammasi rang bilan hal bo'ladi.
   */
  accentBar: string | null;

  /**
   * Karta va ustunlarning ichki foni (V6 maketlari uchun).
   *
   * Slayd fonidan BIR POG'ONA farq qiladi: kartaning chegarasi bilan
   * birga u "qalqib turgan" blok hissini beradi. To'q shablonda fon
   * biroz ochroq, oq shablonda esa biroz iliqroq bo'ladi.
   */
  cardFill: string;
}

/**
 * Uchta shablon.
 *
 * ── Nega aynan uchta ──────────────────────────────────────────────────────
 * Ikkita tanlov "farq bormi?" degan savol tug'diradi, beshtasi esa
 * tanlashni ishga aylantiradi. Uchtasi bir qatorga sig'adi va ular
 * bir-biridan BIR QARASHDA farq qiladi: oq / to'q / tasmali.
 *
 * Standarti — `klassik`: proyektor eskirgan va xona yorug' bo'lsa, oq
 * fon eng ishonchli o'qiladi.
 */
export const TEMPLATES = {
  /** Oq fon, zumrad sarlavha — eng xavfsiz tanlov. */
  klassik: {
    titleBackground: MAKTAB.white,
    titleText: MAKTAB.primary,
    titleSubtext: MAKTAB.body,
    background: MAKTAB.white,
    heading: MAKTAB.primary,
    body: MAKTAB.body,
    muted: MAKTAB.muted,
    rule: MAKTAB.rule,
    summary: MAKTAB.primaryDark,
    accentBar: null,
    cardFill: MAKTAB.canvas,
  },
  /** To'q fon, och matn — qorong'i xona va yangi proyektorlar uchun. */
  zamonaviy: {
    titleBackground: MAKTAB.ink,
    titleText: MAKTAB.white,
    titleSubtext: MAKTAB.primaryLight,
    background: MAKTAB.ink,
    heading: MAKTAB.white,
    body: MAKTAB.rule,
    muted: MAKTAB.muted,
    rule: MAKTAB.primary,
    summary: MAKTAB.primaryLight,
    accentBar: null,
    cardFill: "26231F",
  },
  /** Oq fon, to'ldirilgan sarlavha slaydi va har slaydda rangli tasma. */
  rangli: {
    titleBackground: MAKTAB.primary,
    titleText: MAKTAB.white,
    titleSubtext: MAKTAB.primaryLight,
    background: MAKTAB.canvas,
    heading: MAKTAB.primaryDark,
    body: MAKTAB.body,
    muted: MAKTAB.muted,
    rule: MAKTAB.primary,
    summary: MAKTAB.accent,
    accentBar: MAKTAB.primary,
    cardFill: MAKTAB.white,
  },
} as const satisfies Record<string, PptxPalette>;

export type PptxTemplate = keyof typeof TEMPLATES;

/** Tanlanmagan bo'lsa — shu. */
export const DEFAULT_TEMPLATE: PptxTemplate = "klassik";

/** Shablon nomlari ro'yxati — sxema va forma uchun. */
export const TEMPLATE_NAMES = Object.keys(TEMPLATES) as [PptxTemplate, ...PptxTemplate[]];

/** Nomni palitraga aylantiradi; notanish nom standart shablonni beradi. */
export function paletteOf(template: string | null | undefined): PptxPalette {
  return TEMPLATES[(template ?? DEFAULT_TEMPLATE) as PptxTemplate] ?? TEMPLATES.klassik;
}

export const FONT = {
  /**
   * Shrift oilasi.
   *
   * "Arial" tanlangan, chunki o'zbek lotin alifbosidagi `oʻ` va `gʻ`
   * belgilarini Windows, macOS va LibreOffice'da bir xil ko'rsatadi.
   * Chiroyliroq shriftlar (masalan Calibri) ba'zi tizimlarda o'rniga
   * boshqasini qo'yib, harflarni buzadi.
   */
  family: "Arial",
  titleSize: 40,
  subtitleSize: 18,
  headingSize: 28,
  /**
   * Bandlar shrifti — UCH pog'ona.
   *
   * Ilgari yagona 16pt edi. Sinfning orqa qatoridan 16pt deyarli
   * o'qilmaydi, shuning uchun standart 20pt ga ko'tarildi. Lekin
   * 8 ta uzun band 20pt'da slaydga sig'maydi — shuning uchun matn
   * hajmiga qarab pog'ona tushadi (`bulletFontSize`).
   */
  bulletSize: 20,
  bulletSizeDense: 17,
  bulletSizeTight: 14,
  footerSize: 10,
} as const;

/** Chekkalar. */
export const MARGIN = {
  x: 0.6,
  top: 0.5,
  bottom: 0.45,
} as const;

/** "Rangli" shablondagi chap tasmaning kengligi. */
export const ACCENT_BAR_WIDTH = 0.16;
