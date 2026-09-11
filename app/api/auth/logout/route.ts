import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { destroySession } from "@/lib/auth/session";

/**
 * `POST /api/auth/logout` — tizimdan chiqish.
 *
 * Faqat cookie'ni o'chirmaydi, bazadagi sessiya yozuvini ham o'chiradi —
 * shuning uchun token nusxasi qolgan bo'lsa ham u ishlamaydi.
 *
 * GET emas, POST: brauzer oldindan yuklashi (prefetch) yoki `<img>` tegi
 * foydalanuvchini tasodifan tizimdan chiqarib yubormasligi uchun.
 */
export const POST = withErrorHandling(async () => {
  await destroySession();
  return ok({ loggedOut: true });
});
