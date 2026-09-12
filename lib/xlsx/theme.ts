/**
 * Excel jadvali shabloni — rang, kenglik va chegaralar.
 *
 * `lib/pptx/theme.ts` bilan bir xil yondashuv: dizayn o'zgarganda
 * generatsiya mantig'iga tegish kerak emas.
 */

/** Ranglar — ARGB formatida (exceljs shuni kutadi). */
export const COLORS = {
  /** Sarlavha qatori foni. */
  headerFill: "FF1E293B",
  /** Sarlavha qatori matni. */
  headerText: "FFFFFFFF",
  /** Hafta ajratuvchi qator foni — haftalar ko'zga tashlanib tursin. */
  weekFill: "FFF1F5F9",
  /** Chegara rangi. */
  border: "FFCBD5E1",
  /** Oddiy matn. */
  text: "FF0F172A",
  /** Ikkinchi darajali matn (izohlar). */
  muted: "FF64748B",
} as const;

export const FONT = {
  /**
   * Shrift — pptx qatlamidagi bilan bir xil sabab: "Arial" o'zbek lotin
   * alifbosidagi `oʻ` va `gʻ` belgilarini barcha tizimlarda bir xil
   * ko'rsatadi.
   */
  family: "Arial",
  titleSize: 14,
  headerSize: 11,
  bodySize: 11,
} as const;

/**
 * Ustunlar — tartibi jadvaldagi tartib bilan bir xil.
 *
 * DIQQAT: kenglik AYNAN 9 bo'lmasin. ExcelJS 9 ni o'zining standart
 * kengligi deb biladi va uni faylga UMUMAN yozmaydi (`<col>` elementi
 * tushib qoladi). Natijada ustun standart kenglikda chiqadi — bu holda
 * deyarli bir xil, lekin niyat jim yo'qoladi va keyinchalik kenglikni
 * o'zgartirmoqchi bo'lgan odam nega ishlamayotganini tushunmaydi.
 */
export const COLUMNS = [
  { key: "weekNumber", width: 10 },
  { key: "dateRange", width: 24 },
  { key: "topic", width: 52 },
  { key: "hours", width: 8 },
  { key: "note", width: 38 },
] as const;

/** Sarlavha qatori nomlari — tilga qarab. */
export const COLUMN_HEADERS = {
  UZ: ["Hafta", "Sana oralig'i", "Mavzu", "Soat", "Izoh"],
  RU: ["Неделя", "Период", "Тема", "Часы", "Примечание"],
  EN: ["Week", "Date range", "Topic", "Hours", "Note"],
} as const;

/** Jami qatoridagi yorliq. */
export const TOTAL_LABELS = {
  UZ: "Jami",
  RU: "Итого",
  EN: "Total",
} as const;

/** Ish varag'i nomi (Excel 31 belgidan oshishiga ruxsat bermaydi). */
export const SHEET_NAMES = {
  UZ: "Kalendar reja",
  RU: "Календарный план",
  EN: "Calendar plan",
} as const;

/** Barcha katakchalar uchun yupqa chegara. */
export const THIN_BORDER = {
  top: { style: "thin" as const, color: { argb: COLORS.border } },
  left: { style: "thin" as const, color: { argb: COLORS.border } },
  bottom: { style: "thin" as const, color: { argb: COLORS.border } },
  right: { style: "thin" as const, color: { argb: COLORS.border } },
};
