import { prisma } from "@/lib/db";
import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { apiErrors } from "@/lib/api/errors";
import {
  destroyAllSessions,
  createSession,
  hashPassword,
  requireUser,
  verifyPassword,
} from "@/lib/auth/session";
import { passwordChangeSchema } from "@/lib/validations/user";

/**
 * `PUT /api/user/password` — parolni o'zgartirish.
 *
 * ── Oqim ──────────────────────────────────────────────────────────────────
 *  1. Joriy parol tekshiriladi — o'g'irlangan sessiya bilan parolni
 *     almashtirib bo'lmasin.
 *  2. Yangi parol hash'lanadi (o'sha bcrypt cost 12).
 *  3. BARCHA sessiyalar bekor qilinadi — jumladan hujumchiniki.
 *  4. Shu qurilma uchun yangi sessiya ochiladi: o'qituvchi parolini
 *     o'zgartirgani uchun tizimdan chiqib qolmasligi kerak.
 *
 * ── Nega barcha sessiyalar bekor qilinadi ─────────────────────────────────
 * Parolni o'zgartirishning asosiy sababi — "kimdir hisobimga kirdi"
 * degan shubha. Eski sessiyalar qolsa, hujumchi kirgan holida qolardi
 * va parol almashtirish hech narsa bermasdi.
 */
export const PUT = withErrorHandling(async (request) => {
  const user = await requireUser();
  const input = await parseJsonBody(request, passwordChangeSchema);

  const record = await prisma.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });

  const correct = await verifyPassword(input.currentPassword, record.passwordHash);
  if (!correct) {
    /*
      `invalidCredentials` — "joriy parol noto'g'ri" degan alohida xabar
      yozilmadi: u allaqachon kirgan foydalanuvchi uchun qo'shimcha
      ma'lumot bermaydi, lekin yangi tarjima kaliti talab qilardi.
    */
    throw apiErrors.validation(
      { currentPassword: ["errors.domain.invalidCredentials"] },
      "errors.domain.invalidCredentials",
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(input.newPassword) },
  });

  await destroyAllSessions(user.id);
  await createSession(user.id);

  return ok({ changed: true });
});
