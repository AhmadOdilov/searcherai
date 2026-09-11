import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { apiErrors } from "@/lib/api/errors";
import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { createSession, hashPassword } from "@/lib/auth/session";
import { registerSchema } from "@/lib/validations/auth";

/**
 * `POST /api/auth/register` — ro'yxatdan o'tish.
 *
 * Muvaffaqiyatda sessiya DARHOL yaratiladi: foydalanuvchi ro'yxatdan
 * o'tgandan keyin qaytadan kirishga majbur bo'lmasin.
 */
export const POST = withErrorHandling(async (request) => {
  const input = await parseJsonBody(request, registerSchema);

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
      throw apiErrors.conflict(
        "Bu email allaqachon ro'yxatdan o'tgan. Kirishga urinib ko'ring.",
      );
    }
    throw caught;
  }

  await createSession(user.id);

  return ok({ user }, 201);
});
