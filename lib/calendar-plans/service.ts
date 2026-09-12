import "server-only";
import { prisma } from "@/lib/db";
import { generateJson } from "@/lib/ai/provider";
import { AiError } from "@/lib/ai/types";
import { apiErrors } from "@/lib/api/errors";
import { getEnv } from "@/lib/env";
import { generateXlsx } from "@/lib/xlsx/generate";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/calendar-plans/prompt";
import { deleteGeneratedFile, saveGeneratedFile } from "@/lib/storage/files";
import {
  calendarPlanContentSchemaFor,
  totalRowCount,
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
 * Kalendar reja yaratadi: PENDING yozuv → AI → .xlsx fayl → READY/FAILED.
 *
 * Avvalgi modullardagi kabi yozuv AI'dan OLDIN yaratiladi — xato bo'lsa
 * foydalanuvchi ro'yxatda FAILED yozuvni ko'rib qayta urinadi.
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
    select: { id: true },
  });

  return runGeneration(created.id, input);
}

/** Mavjud yozuvni qayta generatsiya qiladi — parametrlar yozuvdan olinadi. */
export async function regenerateCalendarPlan(
  id: string,
  userId: string,
): Promise<CalendarPlanDetail> {
  const existing = await prisma.calendarPlan.findFirst({
    where: { id, userId },
    select: {
      id: true,
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

  // Eski faylni o'chiramiz — yangisi uning o'rniga yoziladi.
  if (existing.filePath !== null) {
    await deleteGeneratedFile("xlsx", existing.filePath);
  }

  await prisma.calendarPlan.update({
    where: { id },
    data: {
      status: "PENDING",
      errorMessage: null,
      filePath: null,
      fileSize: null,
      rowCount: null,
    },
  });

  return runGeneration(id, {
    subject: existing.subject,
    grade: existing.grade,
    period: existing.period,
    startDate: existing.startDate,
    weeks: existing.weeks,
    hoursPerWeek: existing.hoursPerWeek,
    language: existing.language,
  });
}

/** AI chaqiruvi, .xlsx yasash va saqlash — ikki oqim uchun umumiy qism. */
async function runGeneration(
  id: string,
  input: CalendarPlanInput,
): Promise<CalendarPlanDetail> {
  try {
    const { data, meta } = await generateJson({
      schema: calendarPlanContentSchemaFor(input),
      systemPrompt: buildSystemPrompt(input.language),
      prompt: buildUserPrompt(input),
      // Uzun javob uchun kengaytirilgan chegara — yuqoridagi izohga qara.
      maxTokens: estimateMaxTokens(input.weeks),
    });

    // Fayl AI javobidan KEYIN yasaladi — AI yiqilsa keraksiz fayl
    // qolib ketmaydi.
    const { buffer, rowCount } = await generateXlsx(data, input.language);
    const { filePath, fileSize } = await saveGeneratedFile("xlsx", id, buffer);

    return prisma.calendarPlan.update({
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
        aiDurationMs: Math.max(meta.durationMs, 1),
      },
      select: DETAIL_FIELDS,
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
    await deleteGeneratedFile("xlsx", existing.filePath);
  }
}

function notFound() {
  return apiErrors.notFound("errors.domain.calendarPlanNotFound");
}
