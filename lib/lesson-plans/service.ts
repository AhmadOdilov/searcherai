import "server-only";
import { prisma } from "@/lib/db";
import { generateJson } from "@/lib/ai/provider";
import { AiError } from "@/lib/ai/types";
import { apiErrors } from "@/lib/api/errors";
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
  updatedAt: true,
} as const;

export type LessonPlanListItem = Awaited<
  ReturnType<typeof listLessonPlans>
>["items"][number];

export type LessonPlanDetail = NonNullable<Awaited<ReturnType<typeof getLessonPlan>>>;

/**
 * Dars ishlanmasini generatsiya qiladi.
 *
 * Oqim: PENDING yozuv → AI → READY yoki FAILED.
 *
 * ── Nega avval PENDING yoziladi ───────────────────────────────────────────
 * Generatsiya sinxron bo'lsa ham yozuv OLDIN yaratiladi. Uch sabab:
 *  1. AI yiqilsa, foydalanuvchi ro'yxatda FAILED yozuvni ko'radi va
 *     "qayta urinish" tugmasini bosadi — kiritgan ma'lumoti yo'qolmaydi.
 *  2. Generatsiya qancha vaqt olgani (`aiDurationMs`) saqlanadi — Step 5
 *     (performance) uchun o'lchov.
 *  3. Keyinchalik fon rejimiga o'tganda oqim o'zgarmaydi: route yozuvni
 *     yaratib darhol qaytadi, generatsiya esa alohida ishlaydi.
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
    select: { id: true },
  });

  return runGeneration(created.id, userId, input);
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
): Promise<LessonPlanDetail> {
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

  await prisma.lessonPlan.update({
    where: { id },
    // Eski xato xabarini tozalaymiz — aks holda muvaffaqiyatli natija
    // yonida eski xato ko'rinib turadi.
    data: { status: "PENDING", errorMessage: null },
  });

  return runGeneration(id, userId, {
    subject: existing.subject,
    grade: existing.grade,
    topic: existing.topic,
    durationMinutes: existing.durationMinutes,
    lessonType: existing.lessonType,
    language: existing.language,
  });
}

/** AI chaqiruvi va natijani saqlash — ikki oqim uchun umumiy qism. */
async function runGeneration(
  id: string,
  userId: string,
  input: LessonPlanInput,
): Promise<LessonPlanDetail> {
  try {
    const { data, meta } = await generateJson({
      // Vaqt yig'indisi tekshiruvi shu darsning davomiyligiga bog'liq.
      schema: lessonPlanContentSchemaFor(input.durationMinutes),
      systemPrompt: buildSystemPrompt(input.language),
      prompt: buildUserPrompt(input),
    });

    const updated = await prisma.lessonPlan.update({
      where: { id },
      data: {
        status: "READY",
        content: data,
        errorMessage: null,
        aiModel: meta.model,
        aiDurationMs: meta.durationMs,
      },
      select: DETAIL_FIELDS,
    });

    return updated;
  } catch (caught) {
    // Xatoni yozuvga belgilaymiz, keyin yuqoriga uzatamiz.
    //
    // `errorMessage` ga FOYDALANUVCHIGA ko'rsatiladigan xabar yoziladi,
    // texnik tafsilot emas: bu ustun to'g'ridan-to'g'ri UI'da ko'rinadi va
    // unda API kaliti yoki ichki manzil bo'lmasligi kerak.
    const userMessage =
      caught instanceof AiError
        ? caught.userMessage
        : "Dars ishlanmasini yaratishda xatolik yuz berdi.";

    await prisma.lessonPlan
      .update({
        where: { id },
        data: { status: "FAILED", errorMessage: userMessage },
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
  return apiErrors.notFound("Dars ishlanmasi topilmadi.");
}
