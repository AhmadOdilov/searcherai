import { withErrorHandling } from "@/lib/api/with-error-handling";
import { apiErrors } from "@/lib/api/errors";
import { requireUser } from "@/lib/auth/session";
import { getCalendarPlan } from "@/lib/calendar-plans/service";
import {
  contentDispositionFor,
  mimeTypeFor,
  readGeneratedFile,
} from "@/lib/storage/files";

/**
 * `GET /api/calendar-plans/[id]/download` — .xlsx faylni yuklab olish.
 *
 * Prezentatsiya modulidagi kabi: fayllar `public/` da saqlanmaydi, faqat
 * shu route orqali beriladi va har so'rovda foydalanuvchi hamda EGALIK
 * tekshiriladi.
 */

type RouteContext = { params: Promise<{ id: string }> };

export const GET = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  const plan = await getCalendarPlan(id, user.id);
  if (!plan) throw apiErrors.notFound("errors.domain.calendarPlanNotFound");

  if (plan.status !== "READY" || plan.filePath === null) {
    throw apiErrors.validation(undefined, "errors.domain.calendarPlanFileNotReady");
  }

  const buffer = await readGeneratedFile("xlsx", plan.filePath);
  if (buffer === null) {
    throw apiErrors.notFound("errors.domain.calendarPlanFileMissing");
  }

  const fileName = plan.title ?? `${plan.subject} ${plan.period}`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": mimeTypeFor("xlsx"),
      "content-disposition": contentDispositionFor(fileName, "xlsx"),
      "content-length": String(buffer.length),
      // Shaxsiy fayl — hech qanday kesh saqlamasin.
      "cache-control": "private, no-store",
    },
  });
});
