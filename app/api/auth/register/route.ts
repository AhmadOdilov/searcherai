import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { apiErrors } from "@/lib/api/errors";
import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { createSession, hashPassword } from "@/lib/auth/session";
import { consumeRegisterQuota } from "@/lib/auth/rate-limit";
import { registerSchema } from "@/lib/validations/auth";

/**
 * `POST /api/auth/register` — ro'yxatdan o'tish.
 *
 * Muvaffaqiyatda sessiya DARHOL yaratiladi: foydalanuvchi ro'yxatdan
 * o'tgandan keyin qaytadan kirishga majbur bo'lmasin.
 */
export const POST = withErrorHandling(async (request) => {
  const input = await parseJsonBody(request, registerSchema);

  /*
    Kvota VALIDATSIYADAN KEYIN yeyiladi: formani noto'g'ri to'ldirish
    (qisqa parol, xato email) cheklovni yeb qo'ymasligi kerak.

    Parol hash'lashdan OLDIN esa shuning uchun: bcrypt ~250 ms oladi va
    bu hisoblash resursi ham himoyalanishi kerak.
  */
  await consumeRegisterQuota();

  const passwordHash = await hashPassword(input.password);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
        fullName: input.fullName,
        language: input.language,
        // Rol ATAYLAB so'rovdan olinmaydi — aks holda har kim o'zini
        // ADMIN qilib ro'yxatdan o'ta olardi. Sxemadagi standart: TEACHER.
      },
      select: { id: true, email: true, fullName: true, role: true, language: true },
    });
  } catch (caught) {
    // P2002 — `@unique` cheklovi buzildi. Email band.
    //
    // Nega oldindan `findUnique` qilmaymiz: ikki so'rov orasida boshqa
    // so'rov ayni emailni band qilib qo'yishi mumkin (poyga holati).
    // Bazaning cheklovi — yagona ishonchli tekshiruv.
    if (
      caught instanceof Prisma.PrismaClientKnownRequestError &&
      caught.code === "P2002"
    ) {
      throw apiErrors.conflict("errors.domain.emailTaken");
    }
    throw caught;
  }

  await createSession(user.id);

  return ok({ user }, 201);
});
