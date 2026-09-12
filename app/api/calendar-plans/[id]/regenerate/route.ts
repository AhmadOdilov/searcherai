import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { regenerateCalendarPlan } from "@/lib/calendar-plans/service";

/** `POST /api/calendar-plans/[id]/regenerate` — qayta generatsiya. */

type RouteContext = { params: Promise<{ id: string }> };

export const POST = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const calendarPlan = await regenerateCalendarPlan(id, user.id);

  return ok({ calendarPlan });
});
