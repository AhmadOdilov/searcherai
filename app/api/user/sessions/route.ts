import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { createSession, destroyAllSessions, requireUser } from "@/lib/auth/session";

/**
 * `DELETE /api/user/sessions` — barcha qurilmalardan chiqish.
 *
 * ── Nega bu kerak ─────────────────────────────────────────────────────────
 * O'qituvchi maktabdagi umumiy kompyuterda hisobini ochiq qoldirgan
 * bo'lishi mumkin. Bu tugma unga o'sha sessiyani uzoqdan yopish
 * imkonini beradi.
 *
 * Joriy qurilma uchun sessiya QAYTA ochiladi: foydalanuvchi shu yerda
 * ishlashda davom etadi, boshqa hamma joyda esa chiqib ketadi.
 */
export const DELETE = withErrorHandling(async () => {
  const user = await requireUser();

  const count = await destroyAllSessions(user.id);
  await createSession(user.id);

  return ok({ revoked: count });
});
