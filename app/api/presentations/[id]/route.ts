import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { apiErrors } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";
import {
  deletePresentation,
  getPresentation,
  updatePresentationContent,
} from "@/lib/presentations/service";
import { presentationEditSchema } from "@/lib/validations/presentation";

type RouteContext = { params: Promise<{ id: string }> };

/** `GET /api/presentations/[id]` — bitta yozuv. Faqat egasi. */
export const GET = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const presentation = await getPresentation(id, user.id);
  if (!presentation) throw apiErrors.notFound("errors.domain.presentationNotFound");

  return ok({ presentation });
});

/**
 * `PATCH /api/presentations/[id]` — o'qituvchi tahririni saqlaydi.
 *
 * ── AI CHAQIRILMAYDI ─────────────────────────────────────────────────────
 * Bu route'ning butun mazmuni shu: mavjud natijani o'zgartirish uchun
 * qayta generatsiya (va qayta to'lov) kerak emas. Tekshirilgan JSON
 * bazaga yoziladi va .pptx fayl undan qayta yasaladi.
 *
 * Shu sababli bu yerda `runInBackground` ham, `maxDuration` ham yo'q —
 * ular AI kutish vaqti uchun edi.
 *
 * ── Nega PATCH, PUT emas ─────────────────────────────────────────────────
 * So'rovda yozuvning FAQAT bir qismi (mazmuni) keladi; fan, sinf, til va
 * shablon o'zgarmaydi. PUT butun yozuv almashtirilishini bildirardi.
 *
 * Tekshiruvlar tartibi: kirish → egalik → shakl → holat. Egalik
 * `updatePresentationContent` ichida, `where: { id, userId }` orqali —
 * begona yozuv uchun 404, 403 emas (mavjudligini oshkor qilmaymiz).
 */
export const PATCH = withErrorHandling<RouteContext>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const body = await parseJsonBody(request, presentationEditSchema);
  const presentation = await updatePresentationContent(id, user.id, body.content);

  return ok({ presentation });
});

/** `DELETE /api/presentations/[id]` — yozuv va faylni o'chiradi. */
export const DELETE = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await deletePresentation(id, user.id);

  return ok({ deleted: true });
});
