import { z } from "zod";
import { fullNameSchema, passwordSchema } from "@/lib/validations/auth";

/**
 * Hisob sozlamalari sxemalari.
 *
 * Xato xabarlari — TARJIMA KALITI, qolgan kirish sxemalaridagi kabi.
 */

/**
 * Telefon — ixtiyoriy.
 *
 * ── Nega qat'iy format YO'Q ───────────────────────────────────────────────
 * O'zbekistonda raqam "+998 90 123 45 67", "998901234567" va
 * "90 123-45-67" ko'rinishida yoziladi. Qat'iy naqsh o'qituvchini
 * "to'g'ri" formatni topishga majbur qilardi, holbuki bu maydon
 * hozircha hech qayerda ISHLATILMAYDI — u faqat aloqa uchun saqlanadi.
 *
 * Shuning uchun faqat uzunlik va belgilar to'plami tekshiriladi.
 */
export const phoneSchema = z
  .string({ error: "errors.validation.phoneInvalid" })
  .trim()
  .max(32, "errors.validation.phoneInvalid")
  .regex(/^[0-9+()\-\s]*$/, "errors.validation.phoneInvalid");

/** Profil ma'lumotlari — email O'ZGARMAYDI (quyidagi izohga qarang). */
export const profileUpdateSchema = z
  .object({
    fullName: fullNameSchema,
    /*
      Bo'sh satr "telefon yo'q" degani. `null` emas: forma bo'sh
      maydonni har doim bo'sh satr sifatida yuboradi.
    */
    phone: phoneSchema,
  })
  .strict();

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;

/**
 * Parolni o'zgartirish.
 *
 * ── Nega joriy parol so'raladi ────────────────────────────────────────────
 * Sessiya o'g'irlangan bo'lsa (masalan umumiy kompyuterda ochiq qolgan),
 * hujumchi parolni almashtirib, haqiqiy egasini butunlay chiqarib
 * yuborishi mumkin edi. Joriy parol shuni to'sadi.
 */
export const passwordChangeSchema = z
  .object({
    currentPassword: z
      .string({ error: "errors.validation.passwordRequired" })
      .min(1, "errors.validation.passwordRequired"),
    newPassword: passwordSchema,
  })
  .strict();

export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

/**
 * Hisobni o'chirish — parol bilan tasdiqlanadi.
 *
 * Qaytarib bo'lmaydigan amal uchun bitta bosish yetarli emas: UI'da
 * tasdiq so'raladi, server esa parolni ham talab qiladi.
 */
export const accountDeleteSchema = z
  .object({
    password: z
      .string({ error: "errors.validation.passwordRequired" })
      .min(1, "errors.validation.passwordRequired"),
  })
  .strict();

export type AccountDeleteInput = z.infer<typeof accountDeleteSchema>;
