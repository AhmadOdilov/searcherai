import "server-only";
import { prisma } from "@/lib/db";
import { generateJson } from "@/lib/ai/provider";
import { AiError } from "@/lib/ai/types";
import { apiErrors } from "@/lib/api/errors";
import { markStaleAsFailed } from "@/lib/generation/stale";
import { buildSystemPrompt, buildUserPrompt } from "@/lib/lesson-plans/prompt";
import {
  lessonPlanContentSchemaFor,
  type LessonPlanInput,
  type LessonPlanListQuery,
} from "@/lib/validations/lesson-plan";

/**
 * Dars ishlanmasi — biznes mantiq qatlami.
 *
 * ── Nega route'dan ajratilgan ─────────────────────────────────────────────
 * Route handler `cookies()` va `headers()` ga tayanadi, ya'ni uni sinovda
 * chaqirish uchun HTTP so'rov konteksti kerak. Mantiq shu yerda bo'lsa,
 * sinov uni to'g'ridan-to'g'ri chaqira oladi.
 *
 * `userId` HAR BIR funksiyaga argument sifatida uzatiladi — funksiyaning
 * o'zi sessiyaga qaramaydi. Kim ekanini aniqlash route'ning ishi
 * (`requireUser()`), kimga tegishli ekanini tekshirish — shu qatlamning.
 */

/** Ro'yxatda ko'rsatiladigan maydonlar — `content` olinmaydi (og'ir bo'lishi mumkin). */
const LIST_FIELDS = {
  id: true,
  subject: true,
  grade: true,
  topic: true,
  durationMinutes: true,
  lessonType: true,
  language: true,
  status: true,
  errorMessage: true,
  createdAt: true,
} as const;

/** Bitta yozuv uchun — `content` bilan. */
const DETAIL_FIELDS = {
  ...LIST_FIELDS,
  content: true,
  aiModel: true,
  aiDurationMs: true,
  aiAttempts: true,
  updatedAt: true,
} as const;

export type LessonPlanListItem = Awaited<
  ReturnType<typeof listLessonPlans>
>["items"][number];

export type LessonPlanDetail = NonNullable<Awaited<ReturnType<typeof getLessonPlan>>>;

/**
 * PENDING yozuv yaratadi va uni DARHOL qaytaradi.
 *
 * Generatsiya bu funksiyada BOSHLANMAYDI — route uni `runInBackground()`
 * orqali javob yuborilgandan keyin ishga tushiradi. Shu tufayli
 * foydalanuvchi 15 soniya kutish o'rniga darhol javob oladi.
 */
export async function createLessonPlan(
  userId: string,
  input: LessonPlanInput,
): Promise<LessonPlanDetail> {
  const created = await prisma.lessonPlan.create({
    data: {
      userId,
      subject: input.subject,
      grade: input.grade,
      topic: input.topic,
      durationMinutes: input.durationMinutes,
      lessonType: input.lessonType,
      language: input.language,
      status: "PENDING",
    },
    select: DETAIL_FIELDS,
  });

  return created;
}

/**
 * Yaratilgan yozuv uchun generatsiyani bajaradi — FON ishi.
 *
 * Route uni `runInBackground()` ichida chaqiradi. Xatolik bo'lsa yozuv
 * FAILED qilinadi va xato yuqoriga uzatiladi (u yerda faqat loglanadi —
 * javob allaqachon yuborilgan).
 */
export async function runLessonPlanGeneration(
  id: string,
  input: LessonPlanInput,
): Promise<void> {
  await runGeneration(id, input);
}

/**
 * Mavjud yozuvni qayta generatsiya qiladi (FAILED holatidan keyin).
 *
 * Parametrlar yozuvning o'zidan olinadi — foydalanuvchi formani qaytadan
 * to'ldirmasligi uchun.
 */
export async function regenerateLessonPlan(
  id: string,
  userId: string,
): Promise<{ record: LessonPlanDetail; input: LessonPlanInput }> {
  const existing = await prisma.lessonPlan.findFirst({
    // `userId` shartda — boshqa foydalanuvchi yozuvini qayta generatsiya
    // qilib bo'lmaydi.
    where: { id, userId },
    select: {
      id: true,
      subject: true,
      grade: true,
      topic: true,
      durationMinutes: true,
      lessonType: true,
      language: true,
    },
  });

  if (!existing) throw notFound();

  const reset = await prisma.lessonPlan.update({
    where: { id },
    // Eski xato xabarini tozalaymiz — aks holda muvaffaqiyatli natija
    // yonida eski xato ko'rinib turadi.
    data: { status: "PENDING", errorMessage: null },
    select: DETAIL_FIELDS,
  });

  return {
    record: reset,
    input: {
      subject: existing.subject,
      grade: existing.grade,
      topic: existing.topic,
      durationMinutes: existing.durationMinutes,
      lessonType: existing.lessonType,
      language: existing.language,
    },
  };
}

/** AI chaqiruvi va natijani saqlash — ikki oqim uchun umumiy qism. */
async function runGeneration(id: string, input: LessonPlanInput): Promise<void> {
  try {
    const { data, meta } = await generateJson({
      // Vaqt yig'indisi tekshiruvi shu darsning davomiyligiga bog'liq.
      schema: lessonPlanContentSchemaFor(input.durationMinutes),
      systemPrompt: buildSystemPrompt(input.language),
      prompt: buildUserPrompt(input),
    });

    await prisma.lessonPlan.update({
      where: { id },
      data: {
        status: "READY",
        content: data,
        errorMessage: null,
        aiModel: meta.model,
        // BARCHA urinishlarning vaqti — qayta urinish bo'lganda
        // `durationMs` haqiqiy kutish vaqtidan kam ko'rsatardi.
        aiDurationMs: Math.max(meta.totalDurationMs, 1),
        aiAttempts: meta.schemaAttempts,
      },
    });
  } catch (caught) {
    // Xatoni yozuvga belgilaymiz, keyin yuqoriga uzatamiz.
    //
    /*
      `errorMessage` ustuniga TARJIMA KALITI yoziladi, tayyor matn emas.

      Nega: yozuv bir marta yaratiladi, lekin ko'p marta ko'riladi —
      foydalanuvchi orada interfeys tilini o'zgartirishi mumkin. Kalit
      saqlansa, xabar har safar JORIY tilda ko'rsatiladi.
    */
    const messageKey =
      caught instanceof AiError ? caught.messageKey : "errors.ai.unknown";

    await prisma.lessonPlan
      .update({
        where: { id },
        data: { status: "FAILED", errorMessage: messageKey },
      })
      // Yozuvni belgilash muvaffaqiyatsiz bo'lsa ham asl xatoni yo'qotmaymiz.
      .catch(() => undefined);

    throw caught;
  }
}

/** Foydalanuvchining dars ishlanmalari — eng yangisi birinchi. */
export async function listLessonPlans(userId: string, query: LessonPlanListQuery) {
  const items = await prisma.lessonPlan.findMany({
    where: {
      userId,
      ...(query.status ? { status: query.status } : {}),
    },
    select: LIST_FIELDS,
    orderBy: { createdAt: "desc" },
    // Keyingi sahifa bor-yo'qligini bilish uchun bittasini ortiqcha olamiz.
    take: query.limit + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });

  const hasMore = items.length > query.limit;
  const page = hasMore ? items.slice(0, query.limit) : items;

  return {
    items: page,
    nextCursor: hasMore ? page.at(-1)!.id : null,
  };
}

/**
 * Bitta dars ishlanmasi — faqat EGASI uchun.
 *
 * Topilmasa `null`. Route uni 404 ga aylantiradi — 403 EMAS. Sabab: 403
 * "bu yozuv bor, lekin sizga tegishli emas" degan ma'noni beradi va
 * hujumchiga boshqa foydalanuvchilarning yozuvlari borligini bildiradi.
 */
export async function getLessonPlan(id: string, userId: string) {
  await markStaleAsFailed("lessonPlan", userId);

  return prisma.lessonPlan.findFirst({
    where: { id, userId },
    select: DETAIL_FIELDS,
  });
}

/** O'chirish — faqat egasi. */
export async function deleteLessonPlan(id: string, userId: string): Promise<void> {
  // `deleteMany` ishlatiladi, `delete` emas: `delete` faqat unikal maydon
  // bo'yicha ishlaydi va `userId` ni shartga qo'sha olmaydi. `deleteMany`
  // esa 0 ta o'chirsa — yozuv yo'q yoki bizga tegishli emas.
  const { count } = await prisma.lessonPlan.deleteMany({
    where: { id, userId },
  });

  if (count === 0) throw notFound();
}

function notFound() {
  return apiErrors.notFound("errors.domain.lessonPlanNotFound");
}
