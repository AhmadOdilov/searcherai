import { prisma } from "@/lib/db";
import { apiErrors } from "@/lib/api/errors";
import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import {
  createSession,
  equalizePasswordTiming,
  verifyPassword,
} from "@/lib/auth/session";
import { loginSchema } from "@/lib/validations/auth";
import {
  assertLoginAllowed,
  clearLoginAttempts,
  recordFailedLogin,
} from "@/lib/auth/rate-limit";

/**
 * `POST /api/auth/login` — tizimga kirish.
 *
 * Xavfsizlik qarori: "email topilmadi" va "parol xato" holatlari BIR XIL
 * xabar qaytaradi. Aks holda hujumchi qaysi emaillar ro'yxatda borligini
 * bittalab aniqlay olardi (hisob sanash — account enumeration).
 */
export const POST = withErrorHandling(async (request) => {
  const input = await parseJsonBody(request, loginSchema);

  // Parolni tekshirishdan OLDIN: chegaradan oshgan bo'lsa 429.
  // Aks holda hujumchi cheksiz urinib, bcrypt'ni yuklab turardi.
  await assertLoginAllowed(input.email);

  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      language: true,
      passwordHash: true,
    },
  });

  if (!user) {
    // Javob vaqti mavjud email holatidagidek bo'lishi uchun — izohni
    // `equalizePasswordTiming` ichida qara.
    await equalizePasswordTiming(input.password);
    await recordFailedLogin(input.email);
    throw invalidCredentials();
  }

  const passwordMatches = await verifyPassword(input.password, user.passwordHash);
  if (!passwordMatches) {
    await recordFailedLogin(input.email);
    throw invalidCredentials();
  }

  // Muvaffaqiyatli kirish — hisoblagich tozalanadi, aks holda o'z parolini
  // bir necha marta xato yozgan foydalanuvchi keyin ham bloklanib turardi.
  await clearLoginAttempts(input.email);

  await createSession(user.id);

  return ok({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      language: user.language,
    },
  });
});

function invalidCredentials() {
  return apiErrors.unauthorized("errors.domain.invalidCredentials");
}
