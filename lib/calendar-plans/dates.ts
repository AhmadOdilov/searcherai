/**
 * Hafta sanalarini hisoblash.
 *
 * ── Nega sanalarni AI EMAS, kod hisoblaydi ────────────────────────────────
 * AI sana arifmetikasida ishonchsiz: 30 kunli oylarni 31 deb, kabisa yilini
 * unutib yuboradi. Boshlanish sanasi va hafta raqami ma'lum bo'lsa, oraliqni
 * aniq hisoblash — oddiy arifmetika. Shuning uchun promptga TAYYOR sanalar
 * yuboriladi va AI faqat mavzularni taqsimlaydi.
 */

/** Bitta haftaning boshlanish va tugash sanasi. */
export interface WeekRange {
  weekNumber: number;
  start: Date;
  end: Date;
  label: string;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Sanani kunlik aniqlikda siljitadi.
 *
 * DIQQAT: `setDate()` emas, UTC millisekund arifmetikasi ishlatiladi —
 * `setDate()` yozgi vaqtga o'tish kunlarida bir soat adashib, sanani
 * noto'g'ri kunga surib yuborishi mumkin.
 */
function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Sanani "14.09.2026" ko'rinishida. */
function formatDate(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${day}.${month}.${date.getUTCFullYear()}`;
}

/**
 * Davr uchun hafta oraliqlarini hisoblaydi.
 *
 * Har bir hafta — 7 kun: boshlanish sanasidan boshlab dushanba-yakshanba
 * emas, ATAYLAB oddiy 7 kunlik oraliq. Sabab: o'quv choragi har doim ham
 * dushanbadan boshlanmaydi, o'qituvchi kiritgan sana aynan birinchi dars
 * kuni bo'ladi.
 */
export function buildWeekRanges(startDate: Date, weeks: number): WeekRange[] {
  // Vaqt mintaqasi ta'siridan qochish uchun UTC yarim tunga keltiramiz.
  const start = new Date(
    Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()),
  );

  return Array.from({ length: weeks }, (_, index) => {
    const weekStart = addDays(start, index * 7);
    const weekEnd = addDays(weekStart, 6);

    return {
      weekNumber: index + 1,
      start: weekStart,
      end: weekEnd,
      label: `${formatDate(weekStart)} – ${formatDate(weekEnd)}`,
    };
  });
}
