import { z } from "zod";
import { languageSchema } from "@/lib/validations/common";

/**
 * Autentifikatsiya sxemalari.
 *
 * Xato xabarlari TARJIMA KALITI — ular `fieldErrors` orqali formaga
 * chiqadi va `withErrorHandling` da so'rov tiliga o'giriladi.
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
  .min(1, "errors.validation.emailRequired")
  .max(255, "errors.validation.emailTooLong")
  .pipe(z.email("errors.validation.emailInvalid"));

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
  .min(8, "errors.validation.passwordTooShort")
  .max(72, "errors.validation.passwordTooLong");

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, "errors.validation.fullNameRequired")
  .max(120, "errors.validation.fullNameTooLong");

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
  password: z.string().min(1, "errors.validation.passwordRequired"),
});

export type LoginInput = z.infer<typeof loginSchema>;
