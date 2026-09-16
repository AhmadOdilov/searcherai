import "server-only";
import { prisma } from "@/lib/db";
import { generateJson } from "@/lib/ai/provider";
import { AiError } from "@/lib/ai/types";
import { apiErrors } from "@/lib/api/errors";
import { releaseAiQuota, type QuotaReservation } from "@/lib/ai/rate-limit";
import { markStaleAsFailed } from "@/lib/generation/stale";
import { generatePptx } from "@/lib/pptx/generate";
import { DEFAULT_TEMPLATE } from "@/lib/pptx/theme";
import {
  buildSystemPrompt,
  buildUserPrompt,
  type PresentationPromptContext,
} from "@/lib/presentations/prompt";
import { deleteFile, saveFile } from "@/lib/storage/files";
import { parseLessonPlanContent } from "@/lib/validations/lesson-plan";
import {
  generatedPresentationContentSchema,
  type PresentationContent,
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
  template: true,
  content: true,
  filePath: true,
  aiModel: true,
  aiDurationMs: true,
  aiAttempts: true,
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
      /*
        Shablon YOZUVDA saqlanadi, generatsiya paytida uzatilmaydi.
        Sabab: «Qayta urinish» tugmasi ham shu yozuvdan ishlaydi —
        o'qituvchi tanlagan ko'rinish qayta yasalganda ham saqlanishi
        kerak.
      */
      template: input.template,
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
  /*
    Band qilingan AI kvotasi.

    Generatsiya YIQILSA u qaytariladi — aks holda provayder uzilgan
    paytda o'qituvchi o'z aybisiz bloklanardi. Ixtiyoriy: sinovlar bu
    funksiyani kvotasiz ham chaqiradi.
    Batafsil: lib/ai/rate-limit.ts → releaseAiQuota
  */
  reservation?: QuotaReservation,
): Promise<void> {
  try {
    await runGeneration(id, promptContext);
  } catch (caught) {
    await releaseAiQuota(reservation);
    throw caught;
  }
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
      status: true,
      topic: true,
      subject: true,
      grade: true,
      language: true,
      lessonPlanId: true,
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
      // Generatsiya sxemasi — asos + slaydlar soni chegarasi (6-10).
      // Tahrirlashda chegara kengroq: lib/validations/presentation.ts
      schema: generatedPresentationContentSchema,
      systemPrompt: buildSystemPrompt(promptContext.language),
      prompt: buildUserPrompt(promptContext),
    });

    // Shablon yozuvda turadi — qayta generatsiyada ham o'sha ko'rinish
    // chiqsin. Yozuv topilmasa (poyga holati) standart shablon.
    const record = await prisma.presentation.findUnique({
      where: { id },
      select: { template: true },
    });

    // Fayl AI javobidan KEYIN yasaladi — shu tartib muhim: AI yiqilsa
    // keraksiz fayl qolib ketmaydi.
    const { buffer, slideCount } = await generatePptx(
      data,
      record?.template ?? DEFAULT_TEMPLATE,
    );
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

/**
 * O'qituvchi tahririni saqlaydi va .pptx faylni QAYTA YASAYDI.
 *
 * ── Nega bu funksiya mahsulot uchun hal qiluvchi ──────────────────────────
 * Shu paytgacha AI natijasini o'zgartirishning yagona yo'li «qaytadan
 * tayyorlash» edi: u eski natijani butunlay tashlab, yangi AI so'rovi
 * yuborardi. Ya'ni bitta bandni tuzatish uchun o'qituvchi butun ishni
 * yo'qotardi va tizim yana pul sarflardi.
 *
 * Bu yerda AI UMUMAN chaqirilmaydi. Oqim:
 *   tekshirilgan JSON → .pptx → saqlagich → baza
 *
 * ── Nega fayl DARHOL yasaladi (fon rejimi yo'q) ──────────────────────────
 * Generatsiyada fon rejimi kerak edi, chunki AI javobi 20-90 soniya
 * kutdiradi. Bu yerda esa AI yo'q: `generatePptx` odatda 100 ms dan kam
 * vaqt oladi. Fon ishi qo'shsak, foydalanuvchi «saqlandi» degan javobni
 * olib, fayl esa hali eski bo'lib qolardi — bu jim nomuvofiqlik.
 *
 * ── Nega eski fayl o'chirilmaydi ─────────────────────────────────────────
 * Fayl nomi yozuv id sidan olinadi (`fileNameFor`), ya'ni yangi fayl
 * eskisining USTIGA yoziladi. Avval o'chirib keyin yozsak, orada xato
 * chiqsa foydalanuvchi faylsiz qolardi.
 */
export async function updatePresentationContent(
  id: string,
  userId: string,
  content: PresentationContent,
): Promise<PresentationDetail> {
  const existing = await prisma.presentation.findFirst({
    // Egalik sharti — begona yozuvni tahrirlab bo'lmaydi.
    where: { id, userId },
    select: { id: true, status: true, template: true },
  });

  if (!existing) throw notFound();

  /*
    Faqat TAYYOR yozuvni tahrirlash mumkin.

    · PENDING — fon ishi hali yozayapti; tahrir saqlansa, generatsiya
      tugagach uni bosib ketardi (yo'qolgan ish).
    · FAILED  — tahrirlanadigan mazmun yo'q.
  */
  if (existing.status !== "READY") {
    throw apiErrors.conflict(
      existing.status === "PENDING"
        ? "errors.domain.generationInProgress"
        : "errors.domain.presentationNotEditable",
    );
  }

  const { buffer, slideCount } = await generatePptx(
    content,
    existing.template || DEFAULT_TEMPLATE,
  );
  const { filePath, fileSize } = await saveFile("pptx", id, buffer);

  return prisma.presentation.update({
    where: { id },
    data: {
      content,
      // Sarlavha yozuvda alohida ustunda ham turadi (ro'yxatda ko'rinadi)
      // — tahrirda u ham yangilanishi kerak, aks holda ro'yxat va
      // hujjat bir-biriga mos kelmay qoladi.
      title: content.title,
      slideCount,
      filePath,
      fileSize,
      /*
        `aiDurationMs` va `aiAttempts` TEGILMAYDI: ular AI generatsiyasining
        o'lchovi va `npm run ai:stats` ularni hisoblaydi. Tahrir AI
        chaqirmagani uchun bu raqamlarga aloqasi yo'q.
      */
    },
    select: DETAIL_FIELDS,
  });
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
