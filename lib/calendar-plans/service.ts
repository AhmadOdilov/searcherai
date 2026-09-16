import "server-only";
import { prisma } from "@/lib/db";
import { generateJson } from "@/lib/ai/provider";
import { AiError } from "@/lib/ai/types";
import { apiErrors } from "@/lib/api/errors";
import { markStaleAsFailed } from "@/lib/generation/stale";
import { getEnv } from "@/lib/env";
import { generateXlsx } from "@/lib/xlsx/generate";
import {
  buildSystemPrompt,
  buildUserPrompt,
  formatCurriculumContext,
} from "@/lib/calendar-plans/prompt";
import { listCurriculumTopics } from "@/lib/curriculum/service";
import { deleteFile, saveFile } from "@/lib/storage/files";
import {
  calendarPlanContentSchemaFor,
  totalRowCount,
  type CalendarPlanContent,
  type CalendarPlanInput,
  type CalendarPlanListQuery,
} from "@/lib/validations/calendar-plan";

/**
 * Kalendar-tematik reja — biznes mantiq qatlami.
 *
 * Avvalgi modullar bilan bir xil tuzilish: `userId` argument sifatida
 * keladi, funksiya sessiyaga qaramaydi.
 */

const LIST_FIELDS = {
  id: true,
  subject: true,
  grade: true,
  period: true,
  weeks: true,
  hoursPerWeek: true,
  startDate: true,
  language: true,
  title: true,
  status: true,
  errorMessage: true,
  rowCount: true,
  fileSize: true,
  createdAt: true,
} as const;

const DETAIL_FIELDS = {
  ...LIST_FIELDS,
  content: true,
  filePath: true,
  aiModel: true,
  aiDurationMs: true,
  aiAttempts: true,
  updatedAt: true,
} as const;

export type CalendarPlanDetail = NonNullable<Awaited<ReturnType<typeof getCalendarPlan>>>;

/**
 * Shu reja uchun kerakli token chegarasi.
 *
 * ── Nega standart AI_MAX_TOKENS yetmasligi mumkin ─────────────────────────
 * Bu modul boshqalardan ancha uzun javob qaytaradi. Bitta mavzu qatori
 * JSON'da ~50 token (`{"name":"...","hours":2,"note":"..."}`). Bir o'quv
 * yili = 36 hafta × 2-3 mavzu ≈ 100 qator ≈ 5000 token, ustiga struktura
 * va sana matnlari. 52 haftalik reja esa 16000 ga zo'rg'a sig'adi —
 * javob o'rtada kesilsa JSON buziladi va generatsiya yiqiladi.
 *
 * Shuning uchun chegara hafta soniga qarab hisoblanadi va .env dagi
 * qiymatdan PAST bo'lmaydi.
 */
export function estimateMaxTokens(weeks: number): number {
  const env = getEnv();
  // Har hafta uchun ~400 token (2-3 mavzu + izohlar) + struktura zaxirasi.
  const estimated = weeks * 400 + 2000;
  return Math.min(Math.max(estimated, env.AI_MAX_TOKENS), 32_000);
}

/**
 * PENDING yozuv yaratadi va uni DARHOL qaytaradi.
 *
 * Bu modul uchun fon rejimi AYNIQSA muhim: generatsiya 40-60 soniya
 * oladi, ya'ni sinxron rejimda brauzer "javob bermayapti" deb
 * ko'rsatishi mumkin edi.
 */
export async function createCalendarPlan(
  userId: string,
  input: CalendarPlanInput,
): Promise<CalendarPlanDetail> {
  const created = await prisma.calendarPlan.create({
    data: {
      userId,
      subject: input.subject,
      grade: input.grade,
      period: input.period,
      startDate: input.startDate,
      weeks: input.weeks,
      hoursPerWeek: input.hoursPerWeek,
      language: input.language,
      status: "PENDING",
    },
    select: DETAIL_FIELDS,
  });

  return created;
}

/** Yaratilgan yozuv uchun generatsiyani bajaradi — FON ishi. */
export async function runCalendarPlanGeneration(
  id: string,
  input: CalendarPlanInput,
): Promise<void> {
  await runGeneration(id, input);
}

/** Mavjud yozuvni qayta generatsiya qiladi — parametrlar yozuvdan olinadi. */
export async function regenerateCalendarPlan(
  id: string,
  userId: string,
): Promise<{ record: CalendarPlanDetail; input: CalendarPlanInput }> {
  const existing = await prisma.calendarPlan.findFirst({
    where: { id, userId },
    select: {
      id: true,
      status: true,
      subject: true,
      grade: true,
      period: true,
      startDate: true,
      weeks: true,
      hoursPerWeek: true,
      language: true,
      filePath: true,
    },
  });

  if (!existing) throw notFound();

  /*
    Allaqachon ishlayotgan generatsiyani IKKI MARTA boshlamaymiz.

    Foydalanuvchi «Qayta urinish» tugmasini ikki marta bossa (yoki sahifani
    yangilab qayta bossa), ilgari ikkita fon ishi bir vaqtda ishga tushardi:
    ikkalasi bir qatorga yozardi va AI ikki marta chaqirilardi — ya'ni
    ikki barobar pul. Endi ikkinchi so'rov 409 oladi.
  */
  if (existing.status === "PENDING") {
    throw apiErrors.conflict("errors.domain.generationInProgress");
  }

  // Eski faylni o'chiramiz — yangisi uning o'rniga yoziladi.
  if (existing.filePath !== null) {
    await deleteFile("xlsx", existing.filePath);
  }

  const reset = await prisma.calendarPlan.update({
    where: { id },
    data: {
      status: "PENDING",
      errorMessage: null,
      filePath: null,
      fileSize: null,
      rowCount: null,
    },
    select: DETAIL_FIELDS,
  });

  return {
    record: reset,
    input: {
      subject: existing.subject,
      grade: existing.grade,
      period: existing.period,
      startDate: existing.startDate,
      weeks: existing.weeks,
      hoursPerWeek: existing.hoursPerWeek,
      language: existing.language,
    },
  };
}

/**
 * Rasmiy dasturning BUTUN ro'yxatini oladi.
 *
 * ── Nega `find` emas, `list` ──────────────────────────────────────────────
 * Dars ishlanmasi bitta mavzu haqida — unga faqat mos bo'lim kerak.
 * Kalendar reja esa butun chorak/yil uchun ketma-ketlik tuzadi, ya'ni
 * unga dasturning HAMMA bo'limi kerak: qaysi biri qaysidan keyin
 * kelishini faqat to'liq ro'yxatdan bilish mumkin.
 *
 * Xato bo'lsa jim o'tiladi — bu yaxshilash, majburiy qadam emas.
 */
async function curriculumContextFor(input: CalendarPlanInput): Promise<string> {
  try {
    const topics = await listCurriculumTopics({
      subject: input.subject,
      grade: input.grade,
    });
    return formatCurriculumContext(input.language, topics);
  } catch (error) {
    console.warn("[calendar-plan] o'quv dasturini o'qib bo'lmadi:", error);
    return "";
  }
}

/** AI chaqiruvi, .xlsx yasash va saqlash — ikki oqim uchun umumiy qism. */
async function runGeneration(id: string, input: CalendarPlanInput): Promise<void> {
  try {
    const curriculumContext = await curriculumContextFor(input);

    const { data, meta } = await generateJson({
      schema: calendarPlanContentSchemaFor(input),
      systemPrompt: buildSystemPrompt(input.language),
      prompt: buildUserPrompt({ ...input, curriculumContext }),
      // Uzun javob uchun kengaytirilgan chegara — yuqoridagi izohga qara.
      maxTokens: estimateMaxTokens(input.weeks),
      /*
        Bu modul uchun model ALOHIDA sozlanishi mumkin.

        Sabab: uzun ro'yxat (20+ hafta) generatsiyasi modellarni sezilarli
        farqlaydi — ba'zilari "ANIQ N ta hafta yoz" ko'rsatmasiga rioya
        qilmaydi. Qolgan modullarda bunday muammo kuzatilmagan, shuning
        uchun faqat shu yerda.
      */
      model: getEnv().calendarPlanAiModel,
    });

    // Fayl AI javobidan KEYIN yasaladi — AI yiqilsa keraksiz fayl
    // qolib ketmaydi.
    const { buffer, rowCount } = await generateXlsx(data, input.language);
    const { filePath, fileSize } = await saveFile("xlsx", id, buffer);

    await prisma.calendarPlan.update({
      where: { id },
      data: {
        status: "READY",
        title: data.title,
        content: data,
        filePath,
        fileSize,
        rowCount: rowCount > 0 ? rowCount : totalRowCount(data),
        errorMessage: null,
        aiModel: meta.model,
        // Kamida 1 ms — UI "0 soniyada yaratilgan" deb ko'rsatmasligi uchun.
        aiDurationMs: Math.max(meta.totalDurationMs, 1),
        aiAttempts: meta.schemaAttempts,
      },
    });
  } catch (caught) {
    /*
      `errorMessage` ustuniga TARJIMA KALITI yoziladi, tayyor matn emas.

      Nega: yozuv bir marta yaratiladi, lekin ko'p marta ko'riladi —
      foydalanuvchi orada interfeys tilini o'zgartirishi mumkin. Kalit
      saqlansa, xabar har safar JORIY tilda ko'rsatiladi.
    */
    const messageKey =
      caught instanceof AiError ? caught.messageKey : "errors.ai.unknown";

    await prisma.calendarPlan
      .update({
        where: { id },
        data: { status: "FAILED", errorMessage: messageKey },
      })
      .catch(() => undefined);

    throw caught;
  }
}

/**
 * O'qituvchi tahririni saqlaydi va .xlsx faylni QAYTA YASAYDI.
 *
 * Prezentatsiyadagi bilan bir xil mulohaza: AI UMUMAN chaqirilmaydi.
 * Oqim: tekshirilgan JSON → .xlsx → saqlagich → baza.
 *
 * ── Soat va qatorlar SERVERDA qayta hisoblanadi ──────────────────────────
 * Klient yuborgan qatorlar soni yoki soat yig'indisiga ishonilmaydi —
 * ular so'rov tanasida umuman kelmaydi. Qatorlar soni mazmundan
 * (`totalRowCount`), «Jami» qatoridagi soat esa Excel'ning O'Z SUM
 * formulasidan chiqadi (`lib/xlsx/generate.ts`). Ya'ni o'qituvchi
 * faylda raqamni tuzatsa ham, yig'indi mos qolaveradi.
 */
export async function updateCalendarPlanContent(
  id: string,
  userId: string,
  content: CalendarPlanContent,
): Promise<CalendarPlanDetail> {
  const existing = await prisma.calendarPlan.findFirst({
    where: { id, userId },
    select: { id: true, status: true, language: true },
  });

  if (!existing) throw notFound();

  if (existing.status !== "READY") {
    throw apiErrors.conflict(
      existing.status === "PENDING"
        ? "errors.domain.generationInProgress"
        : "errors.domain.calendarPlanNotEditable",
    );
  }

  const { buffer, rowCount } = await generateXlsx(content, existing.language);
  const { filePath, fileSize } = await saveFile("xlsx", id, buffer);

  return prisma.calendarPlan.update({
    where: { id },
    data: {
      content,
      title: content.title,
      // Generator qaytargan son 0 bo'lsa mazmundan hisoblaymiz —
      // generatsiya yo'lidagi bilan bir xil qoida.
      rowCount: rowCount > 0 ? rowCount : totalRowCount(content),
      filePath,
      fileSize,
    },
    select: DETAIL_FIELDS,
  });
}

/** Foydalanuvchining rejalari — eng yangisi birinchi. */
export async function listCalendarPlans(userId: string, query: CalendarPlanListQuery) {
  const items = await prisma.calendarPlan.findMany({
    where: {
      userId,
      ...(query.status ? { status: query.status } : {}),
    },
    select: LIST_FIELDS,
    orderBy: { createdAt: "desc" },
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > query.limit;
  const page = hasMore ? items.slice(0, query.limit) : items;

  return { items: page, nextCursor: hasMore ? page.at(-1)!.id : null };
}

/** Bitta reja — faqat egasi uchun. Topilmasa `null`. */
export async function getCalendarPlan(id: string, userId: string) {
  await markStaleAsFailed("calendarPlan", userId);

  return prisma.calendarPlan.findFirst({
    where: { id, userId },
    select: DETAIL_FIELDS,
  });
}

/** O'chirish — yozuv va fayl birga. */
export async function deleteCalendarPlan(id: string, userId: string): Promise<void> {
  const existing = await prisma.calendarPlan.findFirst({
    where: { id, userId },
    select: { id: true, filePath: true },
  });

  if (!existing) throw notFound();

  await prisma.calendarPlan.delete({ where: { id: existing.id } });

  // Yozuv o'chgandan KEYIN fayl — aks holda fayl o'chib, yozuv qolib
  // ketishi mumkin edi (yanada yomon holat).
  if (existing.filePath !== null) {
    await deleteFile("xlsx", existing.filePath);
  }
}

function notFound() {
  return apiErrors.notFound("errors.domain.calendarPlanNotFound");
}
