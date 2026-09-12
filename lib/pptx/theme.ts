/**
 * Prezentatsiya shabloni — yagona rang va o'lcham sxemasi.
 *
 * Alohida faylda, chunki dizayn o'zgarganda generatsiya mantig'iga
 * tegmaslik kerak. Barcha o'lchamlar DUYMDA (inch) — pptxgenjs shu birlikda
 * ishlaydi. 16:9 slayd = 10 × 5.625 duym.
 */

export const SLIDE = {
  width: 10,
  height: 5.625,
} as const;

/** Rang sxemasi — bitta asosiy rang va kulrang shkala. */
export const COLORS = {
  /** Asosiy rang — sarlavha slaydi foni va aksentlar. */
  primary: "1E293B",
  /** Sarlavha slaydidagi matn. */
  onPrimary: "FFFFFF",
  /** Mazmun slaydlaridagi sarlavha. */
  heading: "0F172A",
  /** Asosiy matn. */
  body: "334155",
  /** Ikkinchi darajali matn (pastki qism, raqamlar). */
  muted: "94A3B8",
  /** Ajratuvchi chiziq. */
  rule: "E2E8F0",
  background: "FFFFFF",
} as const;

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
  bulletSize: 16,
  footerSize: 10,
} as const;

/** Chekkalar. */
export const MARGIN = {
  x: 0.6,
  top: 0.5,
  bottom: 0.45,
} as const;
