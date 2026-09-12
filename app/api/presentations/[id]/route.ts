import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { apiErrors } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";
import { deletePresentation, getPresentation } from "@/lib/presentations/service";

type RouteContext = { params: Promise<{ id: string }> };

/** `GET /api/presentations/[id]` — bitta yozuv. Faqat egasi. */
export const GET = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const presentation = await getPresentation(id, user.id);
  if (!presentation) throw apiErrors.notFound("Prezentatsiya topilmadi.");

  return ok({ presentation });
});

/** `DELETE /api/presentations/[id]` — yozuv va faylni o'chiradi. */
export const DELETE = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await deletePresentation(id, user.id);

  return ok({ deleted: true });
});
