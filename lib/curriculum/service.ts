import "server-only";
import { prisma } from "@/lib/db";
import { searchTerms } from "@/lib/curriculum/terms";

/**
 * O'quv dasturi mavzularini qidirish.
 *
 * ── Qidiruv qanday ishlaydi ───────────────────────────────────────────────
 * Ikki bosqich:
 *  1. QAT'IY filtr — fan va sinf. Bu yerda taxmin yo'q: 7-sinf
 *     matematikasi uchun 5-sinf mavzusini berish natijani yaxshilamaydi,
 *     buzadi.
 *  2. YUMSHOQ moslik — mavzu nomi bo'yicha. Foydalanuvchi "kasrlarni
 *     qo'shish" deb yozadi, dasturda esa "ODDIY KASRLAR" turadi:
 *     to'liq moslik hech qachon topilmaydi, shuning uchun so'zma-so'z
 *     qidiriladi.
 *
 * ── Nega `to_tsvector` emas ───────────────────────────────────────────────
 * PostgreSQL full-text search o'zbek tili uchun lug'atga ega emas
 * (`simple` konfiguratsiyasi faqat bo'shliq bo'yicha ajratadi, o'zak
 * ajratmaydi). Ya'ni u bizga `ILIKE` dan ortiqcha hech narsa bermaydi,
 * lekin migratsiya, indeks va tushunish qiyinligini qo'shadi.
 *
 * Jadval kichik (bir fan-sinf uchun 5-20 qator) va qidiruv allaqachon
 * fan+sinf bilan cheklangan — `ILIKE` shu hajmda bir necha millisekund.
 * Jadval o'nlab ming qatorga yetganda qayta ko'rib chiqiladi.
 */

export interface CurriculumMatch {
  topicName: string;
  description: string;
  expectedHours: number | null;
  expectedOutcomes: string[];
  source: string;
}

/**
 * Berilgan fan, sinf va mavzuga mos dastur bo'limlarini qaytaradi.
 *
 * Hech narsa topilmasa — BO'SH massiv. Bu XATO emas: fan-sinf hali
 * qo'shilmagan bo'lishi mumkin va oqim o'sha holda ham ishlashi kerak.
 */
export async function findCurriculumTopics(input: {
  subject: string;
  grade: string;
  topic: string;
  limit?: number;
}): Promise<CurriculumMatch[]> {
  const terms = searchTerms(input.topic);

  /*
    Fan va sinf bo'yicha filtr — `equals` emas, `mode: "insensitive"`:
    o'qituvchi "matematika" yoki "Matematika" deb yozishi mumkin.
  */
  const scope = {
    subject: { equals: input.subject, mode: "insensitive" as const },
    grade: { equals: input.grade, mode: "insensitive" as const },
  };

  const rows = await prisma.curriculumTopic.findMany({
    where:
      terms.length === 0
        ? scope
        : {
            ...scope,
            OR: terms.flatMap((term) => [
              { topicName: { contains: term, mode: "insensitive" as const } },
              { description: { contains: term, mode: "insensitive" as const } },
            ]),
          },
    select: {
      topicName: true,
      description: true,
      expectedHours: true,
      expectedOutcomes: true,
      source: true,
    },
    /*
      Ikkita bo'lim — ataylab kam.

      Uchta bo'lim bilan prompt 4000 belgiga o'sdi va model javobi
      sxemadan o'tmay qoldi. Mavzu odatda bitta bo'limga tegishli;
      ikkinchisi chegaradosh mavzular uchun zaxira.
    */
    take: input.limit ?? 2,
  });

  return rows;
}

/**
 * Butun fan-sinf uchun BARCHA bo'limlarni qaytaradi.
 *
 * Kalendar reja uchun: u bitta mavzu emas, butun chorak/yil uchun
 * mavzular ketma-ketligini tuzadi, ya'ni unga dasturning to'liq
 * ro'yxati kerak.
 */
export async function listCurriculumTopics(input: {
  subject: string;
  grade: string;
}): Promise<CurriculumMatch[]> {
  return prisma.curriculumTopic.findMany({
    where: {
      subject: { equals: input.subject, mode: "insensitive" },
      grade: { equals: input.grade, mode: "insensitive" },
    },
    select: {
      topicName: true,
      description: true,
      expectedHours: true,
      expectedOutcomes: true,
      source: true,
    },
    orderBy: { createdAt: "asc" },
  });
}
