import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { createCalendarPlan, listCalendarPlans } from "@/lib/calendar-plans/service";
import {
  calendarPlanInputSchema,
  calendarPlanListQuerySchema,
} from "@/lib/validations/calendar-plan";

/**
 * `POST /api/calendar-plans` — kalendar-tematik reja generatsiya qiladi.
 *
 * DIQQAT: bu eng SEKIN modul. 30-70 qatorli javob 40-60 soniya olishi
 * mumkin. MVP'da sinxron qoldirilgan (fon rejimi Step 5 da), frontend esa
 * kutish uzoq bo'lishini aniq ogohlantiradi.
 */
export const POST = withErrorHandling(async (request) => {
  const user = await requireUser();
  const input = await parseJsonBody(request, calendarPlanInputSchema);

  const calendarPlan = await createCalendarPlan(user.id, input);

  return ok({ calendarPlan }, 201);
});

/** `GET /api/calendar-plans` — foydalanuvchining ro'yxati. */
export const GET = withErrorHandling(async (request) => {
  const user = await requireUser();

  const url = new URL(request.url);
  const query = calendarPlanListQuerySchema.parse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });

  return ok(await listCalendarPlans(user.id, query));
});
