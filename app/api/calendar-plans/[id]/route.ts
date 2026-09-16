import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { apiErrors } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";
import {
  deleteCalendarPlan,
  getCalendarPlan,
  updateCalendarPlanContent,
} from "@/lib/calendar-plans/service";
import { calendarPlanEditSchema } from "@/lib/validations/calendar-plan";

type RouteContext = { params: Promise<{ id: string }> };

/** `GET /api/calendar-plans/[id]` — bitta yozuv. Faqat egasi. */
export const GET = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const calendarPlan = await getCalendarPlan(id, user.id);
  if (!calendarPlan) throw apiErrors.notFound("errors.domain.calendarPlanNotFound");

  return ok({ calendarPlan });
});

/**
 * `PATCH /api/calendar-plans/[id]` — o'qituvchi tahririni saqlaydi.
 *
 * Prezentatsiyadagi kabi: AI CHAQIRILMAYDI, .xlsx fayl tekshirilgan
 * JSON'dan qayta yasaladi. Egalik `updateCalendarPlanContent` ichida —
 * begona yozuv uchun 404.
 */
export const PATCH = withErrorHandling<RouteContext>(async (request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const body = await parseJsonBody(request, calendarPlanEditSchema);
  const calendarPlan = await updateCalendarPlanContent(id, user.id, body.content);

  return ok({ calendarPlan });
});

/** `DELETE /api/calendar-plans/[id]` — yozuv va faylni o'chiradi. */
export const DELETE = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  await deleteCalendarPlan(id, user.id);

  return ok({ deleted: true });
});
