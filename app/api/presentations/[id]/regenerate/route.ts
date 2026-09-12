import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { regeneratePresentation } from "@/lib/presentations/service";

/**
 * `POST /api/presentations/[id]/regenerate` — qayta generatsiya.
 *
 * FAILED holatidan keyingi "qayta urinish" uchun. Parametrlar yozuvning
 * o'zidan olinadi; eski fayl o'chirib, yangisi yoziladi.
 */

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const presentation = await regeneratePresentation(id, user.id);

  return ok({ presentation });
});
