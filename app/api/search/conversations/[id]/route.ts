import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { requireUser } from "@/lib/auth/session";
import { deleteConversation } from "@/lib/search/conversation-store";

/**
 * `DELETE /api/search/conversations/[id]` — suhbatni o'chirish.
 *
 * ── Nega bu yo'l kerak ────────────────────────────────────────────────────
 * Qidiruv suhbati o'qituvchining savollarini 30 kun saqlaydi. Spetsifikatsiya
 * (`docs/MULTI_TURN_V3_SPEC.md` §2.4) egalik va o'chirish huquqini talab
 * qiladi: saqlanadigan har qanday narsani foydalanuvchi darhol o'chira
 * olishi shart, muddat tugashini kutmasdan.
 *
 * UI'dagi «Yangi suhbat boshlash» tugmasi aynan shu yerga murojaat qiladi —
 * ya'ni yangi suhbat boshlash eskisini shunchaki unutish emas, uni bazadan
 * o'chirish demakdir.
 *
 * Xabarlar `onDelete: Cascade` bilan o'zi ketadi.
 */

type RouteContext = { params: Promise<{ id: string }> };

export const DELETE = withErrorHandling<RouteContext>(async (_request, context) => {
  const user = await requireUser();
  const { id } = await context.params;

  /*
    Yo'q suhbat ham, o'zganiki ham bir xil javob beradi: `deleteConversation`
    `deleteMany` ishlatadi va 0 qator o'chiradi. Bu ATAYLAB — 404 qaytarish
    identifikator taxmin qilgan odamga suhbat BORLIGINI bildirardi.
  */
  await deleteConversation(id, user.id);

  return ok({ deleted: true });
});
