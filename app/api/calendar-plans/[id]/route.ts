import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { apiErrors } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";
import { deleteCalendarPlan, getCalendarPlan } from "@/lib/calendar-plans/service";

type RouteContext = { params: Promise<{ id: string }> };

/** `GET /api/calendar-plans/[id]` — bitta yozuv. Faqat egasi. */
export const GET = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const calendarPlan = await getCalendarPlan(id, user.id);
  if (!calendarPlan) throw apiErrors.notFound("Kalendar reja topilmadi.");

  return ok({ calendarPlan });
});

/** `DELETE /api/calendar-plans/[id]` — yozuv va faylni o'chiradi. */
export const DELETE = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await deleteCalendarPlan(id, user.id);

  return ok({ deleted: true });
});
