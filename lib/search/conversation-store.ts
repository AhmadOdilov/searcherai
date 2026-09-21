import "server-only";
import { prisma } from "@/lib/db";
import { apiErrors } from "@/lib/api/errors";
import { createLogger, describeError } from "@/lib/observability/log";
import type { LanguageCode } from "@/lib/validations/common";
import { deriveConversationContext } from "./multi-turn-service";
import type {
  ConversationTurnContext,
  QueryUnderstanding,
  SearchIntent,
} from "./understanding";

/**
 * Qidiruv suhbati — BAZADAGI ombor (`SearchConversation` / `SearchMessage`).
 *
 * ── Nega `MultiTurnService` yetarli emas ──────────────────────────────────
 * U suhbatlarni `Map` da, ya'ni jarayon xotirasida saqlaydi. Bu kutubxona
 * baholari (`npm run search:eval-multiturn`) va birlik sinovlari uchun
 * to'g'ri, lekin mahsulot uchun emas: `next dev` har o'zgarishda modullarni
 * qayta yuklaydi, deploy jarayonni almashtiradi, bir nechta nusxa esa
 * xotirani BO'LISHMAYDI. O'qituvchi ikkinchi savolini yuborgan paytda
 * birinchi savol allaqachon yo'qolgan bo'lishi mumkin edi.
 *
 * Jadvallar `20260917185801_search_conversations` migratsiyasida qo'shilgan
 * va shu paytgacha bo'sh turgan edi — bu modul aynan ularni ishga soladi.
 *
 * ── Meros semantikasi bu yerda TAKRORLANMAYDI ─────────────────────────────
 * Oldingi mavzu/fan/sinfni ajratish `deriveConversationContext()` da, ya'ni
 * xotiradagi ombor bilan BIR XIL kodda. Aks holda baholash skripti
 * o'lchayotgan xatti-harakat mahsulotdagidan sezdirmay ajralib ketardi.
 */

const log = createLogger("search-conversation");

/**
 * Bitta suhbatda saqlanadigan maksimal savol soni.
 *
 * `MultiTurnService` dagi chegara bilan bir xil (50). Undan oshgani
 * o'chiriladi: kontekst uchun eng yangi burilishlar muhim, eskilari esa
 * faqat jadvalni shishiradi.
 */
const MAX_TURNS_PER_CONVERSATION = 50;

/**
 * Kontekst uchun o'qiladigan oxirgi savollar soni.
 *
 * Nega 12: `deriveConversationContext()` oxiridan boshlab qidiradi va
 * mavzu/fan/sinf topilishi bilan to'xtaydi — amalda 1-3 ta burilish
 * yetadi. 12 ta zaxira, "faqat modifikator" ketma-ketligi uzun bo'lsa ham
 * ishlashi uchun. Butun suhbatni o'qish esa javob yo'liga keraksiz
 * kechikish qo'shardi.
 */
const CONTEXT_WINDOW_TURNS = 12;

/** Saqlash muddati — `docs/MULTI_TURN_V3_SPEC.md` §2.3 dagi 30 kun. */
export const CONVERSATION_TTL_DAYS = 30;

/** Sarlavha uchun savolning boshi — ro'yxatda suhbatni tanib olish uchun. */
const TITLE_MAX_LENGTH = 100;

export interface SearchConversationRef {
  id: string;
  language: LanguageCode;
}

/**
 * Suhbat yozuvini EGALIK tekshiruvi bilan olish.
 *
 * ── Nega boshqa foydalanuvchining suhbati uchun 404, 403 emas ─────────────
 * 403 "bunday suhbat BOR, lekin sizniki emas" degan ma'lumotni beradi.
 * Identifikator taxmin qilinsa, bu boshqa o'qituvchining faoliyati haqida
 * ma'lumot sizib chiqishi demakdir. Yo'q va o'zga suhbat mijoz uchun bir
 * xil ko'rinadi.
 *
 * (`MultiTurnService` xotirada ataylab XATO tashlaydi — u kutubxona
 * qatlami va u yerdagi sinov IDOR urinishini aniq ko'rishni talab qiladi.
 * HTTP qatlamida esa sukut saqlash to'g'riroq.)
 */
export async function requireOwnedConversation(
  conversationId: string,
  userId: string,
): Promise<SearchConversationRef> {
  const conversation = await prisma.searchConversation.findUnique({
    where: { id: conversationId },
    select: { id: true, userId: true, language: true },
  });

  if (!conversation || conversation.userId !== userId) {
    throw apiErrors.notFound("errors.domain.searchConversationNotFound");
  }

  return { id: conversation.id, language: conversation.language };
}

/**
 * Keyingi savol uchun oldingi kontekst (mavzu, fan, sinf, til).
 *
 * Faqat `role: "user"` xabarlari o'qiladi: tahlil (`understanding`) aynan
 * savolga biriktirilgan, AI javobi esa kontekst uchun hech narsa bermaydi.
 */
export async function loadConversationContext(
  conversationId: string,
): Promise<ConversationTurnContext | undefined> {
  const rows = await prisma.searchMessage.findMany({
    where: { conversationId, role: "user" },
    select: { understanding: true },
    orderBy: { createdAt: "desc" },
    take: CONTEXT_WINDOW_TURNS,
  });

  // Baza eng yangisidan beradi, `deriveConversationContext` esa xronologik
  // tartib kutadi.
  const turns = rows
    .reverse()
    .map((row) => ({ understanding: readStoredUnderstanding(row.understanding) }));

  return deriveConversationContext(turns);
}

/** Yangi suhbat ochish — birinchi savol sarlavha bo'ladi. */
export async function createConversation(
  userId: string,
  firstQuestion: string,
  language: LanguageCode,
): Promise<SearchConversationRef> {
  const conversation = await prisma.searchConversation.create({
    data: {
      userId,
      title: firstQuestion.slice(0, TITLE_MAX_LENGTH),
      language,
    },
    select: { id: true, language: true },
  });

  return { id: conversation.id, language: conversation.language };
}

/**
 * Yangi suhbat — yiqilsa javobni to'xtatmaydigan variant.
 *
 * `appendTurnBestEffort` bilan bir xil sabab: bu chaqiruv AI javobi
 * tayyor bo'lgandan keyin bo'ladi va bazaning nosozligi javobni
 * yo'qotishga arzimaydi. Farqi shuki, bu yerda suhbat umuman
 * ochilmaydi — mijoz `conversationId` olmaydi va keyingi savol oddiy,
 * mustaqil qidiruv bo'lib qoladi.
 */
export async function createConversationBestEffort(
  userId: string,
  firstQuestion: string,
  language: LanguageCode,
): Promise<string | undefined> {
  try {
    const created = await createConversation(userId, firstQuestion, language);
    return created.id;
  } catch (error) {
    log.warn("suhbat ochib bo'lmadi", { userId, error: describeError(error) });
    return undefined;
  }
}

export interface AppendTurnInput {
  conversationId: string;
  question: string;
  understanding: QueryUnderstanding;
  /** Javobning boshi — suhbat tarixini ko'rsatish uchun yetarli. */
  answerSnippet: string;
  /** Qaysi o'quv dasturi bo'limlari ishlatilgan. */
  retrievedTopicIds: string[];
}

/**
 * Savol va javobni suhbatga yozish.
 *
 * ── Nega `after()` emas, darhol ───────────────────────────────────────────
 * Spetsifikatsiya (§2.5) yozishni fon rejimiga chiqarishni tavsiya qiladi,
 * chunki u qidiruvning 10 ms li yo'liga kechikish qo'shadi. Bu yerdagi yo'l
 * esa 10 ms emas: `/api/search` AI javobini KUTADI, ya'ni 5-20 soniya.
 * Ikkita `INSERT` ustiga qo'shadigan bir necha millisekund shu fonda
 * o'lchovsiz, almashtirib olinadigan narsa esa qimmat: fon yozuvi mijoz
 * keyingi savolini yuborgandan KEYIN tugasa, kontekst yo'qolardi va
 * xususiyat vaqti-vaqti bilan ishlamay qo'yardi.
 */
export async function appendTurn(input: AppendTurnInput): Promise<void> {
  const understanding = {
    detectedLanguage: input.understanding.detectedLanguage,
    detectedSubject: input.understanding.detectedSubject,
    detectedGrade: input.understanding.detectedGrade,
    detectedIntent: input.understanding.detectedIntent,
    extractedTopic: input.understanding.extractedTopic,
  };

  /*
    Ota yozuv ATAYLAB `update` orqali: shunda `@updatedAt` yangilanadi va
    suhbat ro'yxatda so'nggi faoliyat bo'yicha tartiblanadi hamda 30 kunlik
    tozalash faol suhbatni o'chirib yubormaydi.
  */
  await prisma.searchConversation.update({
    where: { id: input.conversationId },
    data: {
      messages: {
        create: [
          {
            role: "user",
            content: input.question,
            understanding,
            retrievedTopicIds: input.retrievedTopicIds,
          },
          {
            role: "assistant",
            content: input.answerSnippet,
            retrievedTopicIds: [],
          },
        ],
      },
    },
  });

  await trimConversation(input.conversationId);
}

/**
 * Retention: 50 ta savoldan oshgan eski burilishlarni o'chirish.
 *
 * Chegara savollar bo'yicha sanaladi, xabarlar bo'yicha emas — bitta
 * burilish ikkita qator (savol + javob).
 */
async function trimConversation(conversationId: string): Promise<void> {
  const questionCount = await prisma.searchMessage.count({
    where: { conversationId, role: "user" },
  });
  if (questionCount <= MAX_TURNS_PER_CONVERSATION) return;

  /*
    Kesish nuqtasi: saqlanadigan eng eski SAVOL. Undan oldingi hamma narsa
    (savollar ham, javoblar ham) ketadi. Sanani ishlatamiz, chunki javob
    o'z savolidan keyin yozilgan va shu bilan juftlik buzilmaydi.
  */
  const [oldestKept] = await prisma.searchMessage.findMany({
    where: { conversationId, role: "user" },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    skip: MAX_TURNS_PER_CONVERSATION - 1,
    take: 1,
  });
  if (!oldestKept) return;

  await prisma.searchMessage.deleteMany({
    where: { conversationId, createdAt: { lt: oldestKept.createdAt } },
  });
}

/** Foydalanuvchining suhbatini o'chirish (UI dagi «yangi suhbat» tugmasi). */
export async function deleteConversation(
  conversationId: string,
  userId: string,
): Promise<void> {
  // `deleteMany` — egasi bo'lmagan urinish jimgina 0 qator o'chiradi.
  await prisma.searchConversation.deleteMany({ where: { id: conversationId, userId } });
}

/**
 * 30 kundan beri tegilmagan suhbatlarni tozalash.
 *
 * Xabarlar `onDelete: Cascade` bilan o'zi ketadi. Server ko'tarilganda
 * chaqiriladi (`instrumentation.ts`) — loyihada rejalashtiruvchi yo'q va
 * uning soxtasi yaratilmadi.
 */
export async function pruneExpiredConversations(): Promise<number> {
  const cutoff = new Date(Date.now() - CONVERSATION_TTL_DAYS * 24 * 60 * 60 * 1000);
  const { count } = await prisma.searchConversation.deleteMany({
    where: { updatedAt: { lt: cutoff } },
  });
  return count;
}

/**
 * Yozuv muvaffaqiyatsiz bo'lsa — javobni YO'QOTMAYMIZ.
 *
 * Bu nuqtaga kelinganda AI chaqiruvi allaqachon bajarilgan va puli
 * to'langan. Baza vaqtincha yetib bo'lmasa, xato tashlash o'qituvchini
 * tayyor javobsiz qoldirardi — faqat kontekst yo'qoladi, javob esa
 * yetkaziladi.
 */
export async function appendTurnBestEffort(input: AppendTurnInput): Promise<void> {
  try {
    await appendTurn(input);
  } catch (error) {
    log.warn("suhbat burilishini yozib bo'lmadi", {
      conversationId: input.conversationId,
      error: describeError(error),
    });
  }
}

/**
 * Bazadagi JSON'ni kontekst uchun o'qish.
 *
 * Qiymatni shu modul yozgan bo'lsa ham, u JADVALDAN keladi: eski
 * migratsiya, qo'lda tahrir yoki formatning o'zgarishi kutilmagan shakl
 * berishi mumkin. Shuning uchun faqat kerakli maydonlar, faqat satr
 * bo'lsa olinadi.
 */
function readStoredUnderstanding(value: unknown): Partial<QueryUnderstanding> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;

  const pick = (key: string): string | undefined => {
    const field = raw[key];
    return typeof field === "string" && field !== "" ? field : undefined;
  };

  return {
    detectedLanguage: pick("detectedLanguage") as LanguageCode | undefined,
    detectedSubject: pick("detectedSubject"),
    detectedGrade: pick("detectedGrade"),
    detectedIntent: pick("detectedIntent") as SearchIntent | undefined,
    extractedTopic: pick("extractedTopic"),
  };
}
