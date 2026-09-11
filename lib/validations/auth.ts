import { z } from "zod";
import { languageSchema } from "@/lib/validations/common";

/**
 * Autentifikatsiya sxemalari.
 *
 * Xato xabarlari o'zbek tilida — ular to'g'ridan-to'g'ri formada
 * foydalanuvchiga ko'rsatiladi (`fieldErrors` orqali).
 */

/**
 * Email. `.toLowerCase()` MUHIM: "Ali@mail.uz" va "ali@mail.uz" bitta
 * hisob bo'lishi kerak, aks holda bir xil email bilan ikkita hisob
 * yaratilib qoladi (bazada `@unique` katta-kichik harfni farqlaydi).
 */
export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Emailni kiriting")
  .max(255, "Email juda uzun")
  .pipe(z.email("Email formati to'g'ri emas"));

/**
 * Parol. MVP uchun ataylab oddiy qoida: uzunlik.
 *
 * Nega maxsus belgi/raqam talab qilinmaydi: bu qoidalar foydalanuvchini
 * "Parol123!" kabi taxminlanadigan parollarga majburlaydi. Uzunlik esa
 * haqiqiy himoya beradi. 72 bayt cheki — bcrypt shundan keyingi baytlarni
 * JIM tashlab yuboradi, ya'ni uzunroq parol qisqasidan farq qilmay qoladi.
 */
export const passwordSchema = z
  .string()
  .min(8, "Parol kamida 8 belgidan iborat bo'lishi kerak")
  .max(72, "Parol 72 belgidan oshmasligi kerak");

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "Ismni kiriting")
  .max(120, "Ism juda uzun");

/** Ro'yxatdan o'tish. Rol so'ralmaydi — hozircha hamma o'qituvchi. */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: fullNameSchema,
  /** Interfeys tili — tanlanmasa o'zbek. */
  language: languageSchema.default("UZ"),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Kirish. Parolga UZUNLIK QOIDASI QO'LLANMAYDI — faqat bo'sh emasligi.
 *
 * Nega: eski foydalanuvchining paroli qoidaga to'g'ri kelmasa ham u kirishi
 * kerak. Bundan tashqari "parol kamida 8 belgi" degan xato kirish formasida
 * hujumchiga ma'lumot beradi.
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Parolni kiriting"),
});

export type LoginInput = z.infer<typeof loginSchema>;
