import { withErrorHandling } from "@/lib/api/with-error-handling";
import { apiErrors } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";
import { getPresentation } from "@/lib/presentations/service";
import {
  PPTX_MIME_TYPE,
  contentDispositionFor,
  readPresentationFile,
} from "@/lib/presentations/storage";

/**
 * `GET /api/presentations/[id]/download` — .pptx faylni yuklab olish.
 *
 * ── Nega fayl SHU YERDAN beriladi ─────────────────────────────────────────
 * Fayllar `public/` da saqlanmaydi (u yerda ular statik tarqalib, quyidagi
 * egalik tekshiruvini chetlab o'tardi). Fayl faqat shu route orqali
 * beriladi va har so'rovda:
 *   1. foydalanuvchi tizimga kirganmi,
 *   2. yozuv AYNAN shu foydalanuvchiga tegishlimi —
 * tekshiriladi.
 */

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const presentation = await getPresentation(id, user.id);
  if (!presentation) throw apiErrors.notFound("Prezentatsiya topilmadi.");

  if (presentation.status !== "READY" || presentation.filePath === null) {
    throw apiErrors.validation(undefined, "Prezentatsiya fayli hali tayyor emas.");
  }

  const buffer = await readPresentationFile(presentation.filePath);
  if (buffer === null) {
    // Yozuv bazada bor, lekin fayl diskda yo'q — masalan saqlagich
    // tozalangan. Foydalanuvchiga nima qilishni aytamiz.
    throw apiErrors.notFound("Fayl topilmadi. Prezentatsiyani qaytadan yaratib ko'ring.");
  }

  const fileName = presentation.title ?? presentation.topic;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": PPTX_MIME_TYPE,
      "content-disposition": contentDispositionFor(fileName),
      "content-length": String(buffer.length),
      // Shaxsiy fayl — hech qanday kesh (brauzer yoki proksi) saqlamasin.
      "cache-control": "private, no-store",
    },
  });
});
