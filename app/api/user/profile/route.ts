import { prisma } from "@/lib/db";
import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { profileUpdateSchema } from "@/lib/validations/user";

/**
 * `PATCH /api/user/profile` — ism va telefonni o'zgartirish.
 *
 * ── Nega EMAIL o'zgartirilmaydi ───────────────────────────────────────────
 * Email — kirish identifikatori. Uni almashtirish yangi manzilni
 * TASDIQLASHNI talab qiladi (tasdiqlash xati), aks holda o'qituvchi
 * xato yozib, hisobiga kira olmay qoladi.
 *
 * Email yuborish infratuzilmasi loyihada yo'q, shuning uchun bu maydon
 * o'zgarmaydi va UI'da ham faqat ko'rsatiladi. "Ishlaydigandek
 * ko'rinadigan, lekin ishlamaydigan" maydon qo'yilmadi.
 */
export const PATCH = withErrorHandling(async (request) => {
  const user = await requireUser();
  const input = await parseJsonBody(request, profileUpdateSchema);

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      fullName: input.fullName,
      // Bo'sh satr — "telefon yo'q". Bazada `null` bo'lib turgani
      // ma'qul: `@unique` bo'sh satrlarni to'qnashtirardi.
      phone: input.phone === "" ? null : input.phone,
    },
    select: { id: true, fullName: true, phone: true, email: true },
  });

  return ok({ user: updated });
});
