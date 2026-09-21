import { z } from "zod";
import { gradeSchema, languageSchema, subjectSchema } from "@/lib/validations/common";
import { stripTags } from "@/lib/validations/sanitize";

/**
 * AI qidiruv — kirish va javob sxemalari.
 *
 * ── Bu "qidiruv" nima va nima EMAS ────────────────────────────────────────
 * Bu internetni qidirmaydi va havola qaytarmaydi. O'qituvchi savol beradi
 * ("Fotosintez nima?", "Kasrlarni qanday tushuntirsam bo'ladi?"), model
 * esa DARSGA tayyorlanish uchun javob beradi: qisqa tushuntirish, asosiy
 * nuqtalar va sinfda qanday ishlatish mumkinligi.
 *
 * Nega shunday: o'qituvchiga "10 ta havola" emas, darhol ishlatsa
 * bo'ladigan material kerak. Havolalar ortidan yurish — bu vaqt, u esa
 * yo'q.
 *
 * ── Nega natija standart holatda bazaga yozilmaydi ────────────────────────
 * Qolgan uch modul natijani saqlaydi, chunki ular FAYL yasaydi va
 * generatsiya 20-90 soniya oladi. Qidiruv esa 5-10 soniyada tugaydi va
 * natija bir martalik — har bir savolni yozib borish jadvalni behuda
 * to'ldirardi va maxfiylik xavfini oshirardi.
 *
 * ISTISNO: o'qituvchi suhbatni davom ettirmoqchi bo'lsa
 * (`startConversation`), savol va javob `SearchConversation` ga
 * yoziladi — keyingi savol oldingi mavzuni meros olishi uchun.
 * Batafsil: `lib/search/conversation-store.ts`.
 */

/** Foydalanuvchi savoli. */
export const searchInputSchema = z.object({
  question: z
    .string({ error: "errors.validation.questionTooShort" })
    .trim()
    .transform(stripTags)
    .pipe(
      z
        .string()
        .min(5, "errors.validation.questionTooShort")
        .max(500, "errors.validation.questionTooLong"),
    ),

  /*
    Fan va sinf IXTIYORIY, lekin berilsa javob sezilarli aniqroq bo'ladi:
    "fotosintez" 6-sinf biologiyasida va 11-sinfda butunlay boshqacha
    chuqurlikda tushuntiriladi.
  */
  subject: subjectSchema.optional(),
  grade: gradeSchema.optional(),

  /** Javob tili — interfeys tilidan mustaqil. */
  language: languageSchema.default("UZ"),

  /*
    ── Ko'p bosqichli suhbat ───────────────────────────────────────────────

    Ikkita maydon, chunki ikkita ALOHIDA qaror bor:

      · `startConversation` — "bu savoldan boshlab kontekst eslansin".
        Berilmasa API avvalgidek ishlaydi: hech narsa yozilmaydi, hech
        narsa meros olinmaydi. Ya'ni saqlash — ATAYLAB tanlanadigan
        holat, standart emas (`docs/MULTI_TURN_V3_SPEC.md` §2.2).

      · `conversationId` — "bu savol mana shu suhbatning davomi".
        Faqat egasiga tegishli suhbat qabul qilinadi; boshqasi 404
        beradi.

    Nega kontekstning O'ZI (previousTopic va h.k.) mijozdan olinmaydi:
    u holda har qanday mijoz javobga ta'sir qiladigan soxta kontekst
    yubora olardi va serverdagi suhbat tarixi bilan mijozdagi holat
    ajralib ketardi. Server faqat O'ZI yozgan burilishlarga ishonadi.
  */
  conversationId: z.string().trim().min(1).max(64).optional(),
  startConversation: z.boolean().optional(),
});

export type SearchInput = z.infer<typeof searchInputSchema>;

/**
 * Model qaytaradigan javob.
 *
 * DIQQAT: bu yerdagi xato xabarlari TABIIY MATN (tarjima kaliti emas) —
 * ular foydalanuvchiga emas, modelga qayta so'rovda yuboriladi va model
 * kalitni emas, tushunarli matnni o'qiydi.
 */
export const searchAnswerSchema = z.object({
  /** Qisqa, to'g'ridan-to'g'ri javob — 2-5 jumla. */
  answer: z
    .string()
    .trim()
    .min(40, "Javob juda qisqa — kamida 2-3 jumla yozing")
    .max(2000, "Javob juda uzun — 5 jumlaga siqing"),

  /** Asosiy nuqtalar — doskaga yozsa bo'ladigan darajada qisqa. */
  keyPoints: z
    .array(z.string().trim().min(3).max(300))
    .min(3, "Kamida 3 ta asosiy nuqta kerak")
    .max(7, "7 tadan ko'p bo'lmasin"),

  /** Sinfda qanday ishlatish — aynan shu qism o'qituvchiga eng qimmatli. */
  classroomIdeas: z
    .array(z.string().trim().min(10).max(400))
    .min(2, "Kamida 2 ta sinfda qo'llash g'oyasi kerak")
    .max(5, "5 tadan ko'p bo'lmasin"),

  /**
   * Ehtiyot bo'lish kerak bo'lgan joy — ixtiyoriy.
   *
   * Masalan: "Bu mavzuda 7-sinf darsligida boshqa ta'rif berilgan" yoki
   * "Tarixiy sanalar manbalarga qarab farq qiladi".
   */
  caution: z.string().trim().min(10).max(500).optional(),
});

export type SearchAnswer = z.infer<typeof searchAnswerSchema>;
