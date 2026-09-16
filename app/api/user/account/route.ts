import { prisma } from "@/lib/db";
import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { apiErrors } from "@/lib/api/errors";
import { deleteAccount, requireUser, verifyPassword } from "@/lib/auth/session";
import { accountDeleteSchema } from "@/lib/validations/user";

/**
 * `DELETE /api/user/account` — hisobni butunlay o'chiradi.
 *
 * ── Qaytarib bo'lmaydi ────────────────────────────────────────────────────
 * Shuning uchun ikki to'siq: UI'da tasdiq, serverda esa PAROL. Bitta
 * tasodifiy bosish hisobni yo'q qilmasligi kerak.
 *
 * ── Fayllar AVVAL o'chadi ─────────────────────────────────────────────────
 * Bazadagi cascade fayl tizimini bilmaydi: yozuv o'chsa, .pptx/.xlsx
 * yo'llari ham yo'qoladi va fayllar diskda abadiy qolardi. Tartib
 * `deleteAccount()` ichida — fayllar, keyin yozuv.
 */
export const DELETE = withErrorHandling(async (request) => {
  const user = await requireUser();
  const input = await parseJsonBody(request, accountDeleteSchema);

  const record = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  const correct = await verifyPassword(input.password, record.passwordHash);
  if (!correct) {
    throw apiErrors.validation(
      { password: ["errors.domain.invalidCredentials"] },
      "errors.domain.invalidCredentials",
    );
  }

  await deleteAccount(user.id);

  return ok({ deleted: true });
});
