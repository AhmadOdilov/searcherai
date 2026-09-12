import "server-only";
import { prisma } from "@/lib/db";
import { generateJson } from "@/lib/ai/provider";
import { AiError } from "@/lib/ai/types";
import { apiErrors } from "@/lib/api/errors";
import { markStaleAsFailed } from "@/lib/generation/stale";
import { generatePptx } from "@/lib/pptx/generate";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type PresentationPromptContext,
} from "@/lib/presentations/prompt";
import { deleteFile, saveFile } from "@/lib/storage/files";
import { parseLessonPlanContent } from "@/lib/validations/lesson-plan";
import {
  presentationContentSchema,
  type PresentationInput,
  type PresentationListQuery,
} from "@/lib/validations/presentation";
import type { LanguageCode } from "@/lib/validations/common";

/**
 * Prezentatsiya — biznes mantiq qatlami.
 *
 * Dars ishlanmasi modulidagi kabi route'dan ajratilgan: `userId` argument
 * sifatida keladi, sessiyaga qaramaydi, shuning uchun sinovda to'g'ridan-
 * to'g'ri chaqirilishi mumkin.
 */

const LIST_FIELDS = {
  id: true,
  lessonPlanId: true,
  topic: true,
  subject: true,
  grade: true,
  title: true,
  language: true,
  status: true,
  errorMessage: true,
  slideCount: true,
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

export type PresentationDetail = NonNullable<Awaited<ReturnType<typeof getPresentation>>>;

/** Generatsiya uchun kerakli boshlang'ich ma'lumot — ikki rejim uchun umumiy. */
interface ResolvedSource {
  lessonPlanId: string | null;
  topic: string;
  subject: string | null;
  grade: string | null;
  language: LanguageCode;
  promptContext: PresentationPromptContext;
}

/**
 * Kirish rejimini boshlang'ich ma'lumotga aylantiradi.
 *
 * `from-lesson-plan` rejimida mavzu, fan, sinf va TIL yozuvning o'zidan
 * olinadi — foydalanuvchi ularni qaytadan kiritmaydi va nomuvofiqlik
 * bo'lmaydi (masalan dars o'zbekcha, prezentatsiya inglizcha).
 */
async function resolveSource(
  userId: string,
  input: PresentationInput,
): Promise<ResolvedSource> {
  if (input.mode === "standalone") {
    return {
      lessonPlanId: null,
      topic: input.topic,
      subject: input.subject ?? null,
      grade: input.grade ?? null,
      language: input.language,
      promptContext: {
        topic: input.topic,
        subject: input.subject,
        grade: input.grade,
        language: input.language,
      },
    };
  }

  const plan = await prisma.lessonPlan.findFirst({
    // `userId` shartda — boshqa foydalanuvchining dars ishlanmasidan
    // prezentatsiya yasab bo'lmaydi.
    where: { id: input.lessonPlanId, userId },
    select: {
      id: true,
      subject: true,
      grade: true,
      topic: true,
      language: true,
      status: true,
      content: true,
    },
  });

  if (!plan) {
    // 404, 403 emas: boshqa foydalanuvchining yozuvi BORLIGINI ham
    // bildirmaymiz. Mavjud bo'lmagan id ham shu javobni oladi.
    throw apiErrors.notFound("errors.domain.lessonPlanNotFound");
  }

  // Dars ishlanmasi hali tayyor bo'lmasa, uning mazmuni yo'q — bunday
  // holatda prezentatsiya tuzish mantiqsiz.
  const planContent =
    plan.status === "READY" ? parseLessonPlanContent(plan.content) : null;

  if (planContent === null) {
    throw apiErrors.validation(
      undefined,
      {
        PENDING: "errors.domain.lessonPlanPending",
        FAILED: "errors.domain.lessonPlanFailed",
        READY: "errors.domain.lessonPlanBroken",
      }[plan.status],
    );
  }

  return {
    lessonPlanId: plan.id,
    topic: plan.topic,
    subject: plan.subject,
    grade: plan.grade,
    language: plan.language,
    promptContext: {
      topic: plan.topic,
      subject: plan.subject,
      grade: plan.grade,
      language: plan.language,
      lessonPlan: planContent,
    },
  };
}

/**
 * PENDING yozuv yaratadi va uni DARHOL qaytaradi.
 *
 * Generatsiya bu yerda boshlanmaydi — route uni `runInBackground()` orqali
 * javob yuborilgandan keyin ishga tushiradi.
 *
 * `resolveSource` esa SINXRON qoladi: u dars ishlanmasining egaligini va
 * tayyorligini tekshiradi, ya'ni xato bo'lsa foydalanuvchi DARHOL bilishi
 * kerak (404/400), keraksiz PENDING yozuv yaratilmasligi kerak.
 */
export async function createPresentation(
  userId: string,
  input: PresentationInput,
): Promise<{ record: PresentationDetail; promptContext: PresentationPromptContext }> {
  const source = await resolveSource(userId, input);

  const created = await prisma.presentation.create({
    data: {
      userId,
      lessonPlanId: source.lessonPlanId,
      topic: source.topic,
      subject: source.subject,
      grade: source.grade,
      language: source.language,
      status: "PENDING",
    },
    select: DETAIL_FIELDS,
  });

  return { record: created, promptContext: source.promptContext };
}

/**
 * Yaratilgan yozuv uchun generatsiyani bajaradi — FON ishi.
 */
export async function runPresentationGeneration(
  id: string,
  promptContext: PresentationPromptContext,
): Promise<void> {
  await runGeneration(id, promptContext);
}

/** Mavjud yozuvni qayta generatsiya qiladi — parametrlar yozuvdan olinadi. */
export async function regeneratePresentation(
  id: string,
  userId: string,
): Promise<{ record: PresentationDetail; promptContext: PresentationPromptContext }> {
  const existing = await prisma.presentation.findFirst({
    where: { id, userId },
    select: {
      id: true,
      topic: true,
      subject: true,
      grade: true,
      language: true,
      lessonPlanId: true,
      filePath: true,
    },
  });

  if (!existing) throw notFound();

  // Dars ishlanmasiga bog'langan bo'lsa, uning mazmunini QAYTA o'qiymiz:
  // foydalanuvchi orada darsni qayta yaratgan bo'lishi mumkin.
  let promptContext: PresentationPromptContext = {
    topic: existing.topic,
    subject: existing.subject ?? undefined,
    grade: existing.grade ?? undefined,
    language: existing.language,
  };

  if (existing.lessonPlanId !== null) {
    const plan = await prisma.lessonPlan.findFirst({
      where: { id: existing.lessonPlanId, userId },
      select: { status: true, content: true },
    });
    const planContent =
      plan?.status === "READY" ? parseLessonPlanContent(plan.content) : null;
    // Dars ishlanmasi o'chirilgan yoki buzilgan bo'lsa — mustaqil rejimda
    // davom etamiz, butun amalni yiqitmaymiz.
    if (planContent !== null) {
      promptContext = { ...promptContext, lessonPlan: planContent };
    }
  }

  // Eski faylni o'chiramiz — yangisi uning o'rniga yoziladi.
  if (existing.filePath !== null) {
    await deleteFile("pptx", existing.filePath);
  }

  const reset = await prisma.presentation.update({
    where: { id },
    data: {
      status: "PENDING",
      errorMessage: null,
      filePath: null,
      fileSize: null,
      slideCount: null,
    },
    select: DETAIL_FIELDS,
  });

  return { record: reset, promptContext };
}

/** AI chaqiruvi, .pptx yasash va saqlash — ikki oqim uchun umumiy qism. */
async function runGeneration(
  id: string,
  promptContext: PresentationPromptContext,
): Promise<void> {
  try {
    const { data, meta } = await generateJson({
      schema: presentationContentSchema,
      systemPrompt: buildSystemPrompt(promptContext.language),
      prompt: buildUserPrompt(promptContext),
    });

    // Fayl AI javobidan KEYIN yasaladi — shu tartib muhim: AI yiqilsa
    // keraksiz fayl qolib ketmaydi.
    const { buffer, slideCount } = await generatePptx(data);
    const { filePath, fileSize } = await saveFile("pptx", id, buffer);

    await prisma.presentation.update({
      where: { id },
      data: {
        status: "READY",
        title: data.title,
        content: data,
        filePath,
        fileSize,
        slideCount,
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

    await prisma.presentation
      .update({
        where: { id },
        data: { status: "FAILED", errorMessage: messageKey },
      })
      .catch(() => undefined);

    throw caught;
  }
}

/** Foydalanuvchining prezentatsiyalari — eng yangisi birinchi. */
export async function listPresentations(userId: string, query: PresentationListQuery) {
  const items = await prisma.presentation.findMany({
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

/** Bitta prezentatsiya — faqat egasi uchun. Topilmasa `null`. */
export async function getPresentation(id: string, userId: string) {
  await markStaleAsFailed("presentation", userId);

  return prisma.presentation.findFirst({
    where: { id, userId },
    select: DETAIL_FIELDS,
  });
}

/** O'chirish — yozuv va fayl birga. */
export async function deletePresentation(id: string, userId: string): Promise<void> {
  // Faylni o'chirish uchun yo'lini bilish kerak, shuning uchun avval
  // o'qiymiz (egalik sharti bilan).
  const existing = await prisma.presentation.findFirst({
    where: { id, userId },
    select: { id: true, filePath: true },
  });

  if (!existing) throw notFound();

  await prisma.presentation.delete({ where: { id: existing.id } });

  // Yozuv o'chgandan KEYIN fayl — aks holda fayl o'chib, yozuv qolib
  // ketishi mumkin edi (yanada yomon holat).
  if (existing.filePath !== null) {
    await deleteFile("pptx", existing.filePath);
  }
}

/** Foydalanuvchining tayyor dars ishlanmalari — formadagi dropdown uchun. */
export async function listLessonPlanOptions(userId: string) {
  return prisma.lessonPlan.findMany({
    // Faqat READY: tayyor bo'lmagan darsdan prezentatsiya tuzib bo'lmaydi.
    where: { userId, status: "READY" },
    select: {
      id: true,
      topic: true,
      subject: true,
      grade: true,
      language: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

function notFound() {
  return apiErrors.notFound("errors.domain.presentationNotFound");
}
