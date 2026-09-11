import { ok, withErrorHandling } from "@/lib/api/with-error-handling";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * `GET /api/auth/me` — joriy foydalanuvchi.
 *
 * Frontenddagi `useUser` hook'i shu endpointdan foydalanadi.
 *
 * Kirmagan foydalanuvchi uchun 401 EMAS, `{ user: null }` bilan 200
 * qaytaradi: "kim ekanini so'rash" muvaffaqiyatli bajarildi, javob esa
 * "hech kim". Shunda hook har safar xato holatini boshqarishi shart emas.
 */
export const GET = withErrorHandling(async () => {
  const user = await getCurrentUser();
  return ok({ user });
});
