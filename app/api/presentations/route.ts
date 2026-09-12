import { ok, parseJsonBody, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { createPresentation, listPresentations } from "@/lib/presentations/service";
import {
  presentationInputSchema,
  presentationListQuerySchema,
} from "@/lib/validations/presentation";

/**
 * `POST /api/presentations` — prezentatsiya generatsiya qiladi.
 *
 * Ikki rejim, `mode` maydoni bilan ajratiladi:
 *   { "mode": "from-lesson-plan", "lessonPlanId": "..." }
 *   { "mode": "standalone", "topic": "...", "subject": "...", "grade": "..." }
 *
 * MVP'da sinxron — AI + .pptx yasash tugagach javob qaytadi.
 */
export const POST = withErrorHandling(async (request) => {
  const user = await requireUser();
  const input = await parseJsonBody(request, presentationInputSchema);

  const presentation = await createPresentation(user.id, input);

  return ok({ presentation }, 201);
});

/** `GET /api/presentations` — foydalanuvchining ro'yxati. */
export const GET = withErrorHandling(async (request) => {
  const user = await requireUser();

  const url = new URL(request.url);
  const query = presentationListQuerySchema.parse({
    limit: url.searchParams.get("limit") ?? undefined,
    cursor: url.searchParams.get("cursor") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });

  return ok(await listPresentations(user.id, query));
});
