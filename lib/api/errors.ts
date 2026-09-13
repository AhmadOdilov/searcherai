/**
 * API qatlamining xatolik turlari.
 *
 * `AiError` (lib/ai/types.ts) — AI xizmatiga aloqador nosozliklar uchun.
 * Bu yerdagi `ApiError` — ilova mantig'iga aloqador nosozliklar uchun:
 * topilmadi, ruxsat yo'q, validatsiya o'tmadi.
 *
 * ── Xabarlar TARJIMA KALITI sifatida saqlanadi ────────────────────────────
 * Xato tashlanadigan joy (servis qatlami) foydalanuvchining tilini
 * bilmaydi va bilishi shart emas. Shuning uchun bu yerda faqat kalit
 * bo'ladi, tarjima esa javob shakllanadigan joyda (`withErrorHandling`)
 * qilinadi.
 */

export type ApiErrorCode =
  | "validation_error" // 400 — kiritilgan ma'lumot noto'g'ri
  | "unauthorized" // 401 — kirish kerak
  | "forbidden" // 403 — huquq yo'q
  | "not_found" // 404
  | "conflict" // 409 — masalan email allaqachon band
  | "too_many_requests" // 429 — juda ko'p urinish (brute-force himoyasi)
  | "internal_error"; // 500

const HTTP_STATUS: Record<ApiErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  too_many_requests: 429,
  internal_error: 500,
};

/** Har bir kod uchun standart tarjima kaliti. */
const DEFAULT_MESSAGE_KEYS: Record<ApiErrorCode, string> = {
  validation_error: "errors.api.validation_error",
  unauthorized: "errors.api.unauthorized",
  forbidden: "errors.api.forbidden",
  not_found: "errors.api.not_found",
  conflict: "errors.api.conflict",
  too_many_requests: "errors.api.too_many_requests",
  internal_error: "errors.api.internal_error",
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** Foydalanuvchiga ko'rsatiladigan xabarning tarjima kaliti. */
  readonly messageKey: string;
  /**
   * Maydon bo'yicha validatsiya xatolari — qiymatlar TARJIMA KALITI:
   * `{ email: ["errors.validation.emailInvalid"] }`
   */
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: ApiErrorCode,
    options: {
      /** Foydalanuvchiga ko'rsatiladigan xabarning tarjima kaliti. */
      messageKey?: string;
      /** Log uchun texnik tafsilot. */
      detail?: string;
      fieldErrors?: Record<string, string[]>;
      cause?: unknown;
    } = {},
  ) {
    super(options.detail ?? options.messageKey ?? code, { cause: options.cause });
    this.name = "ApiError";
    this.code = code;
    this.messageKey = options.messageKey ?? DEFAULT_MESSAGE_KEYS[code];
    this.fieldErrors = options.fieldErrors;
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code];
  }
}

/**
 * Qulaylik uchun qisqa yordamchilar.
 *
 * `messageKey` — `messages/*.json` dagi kalit, masalan
 * `"errors.domain.lessonPlanNotFound"`.
 */
export const apiErrors = {
  validation: (fieldErrors?: Record<string, string[]>, messageKey?: string) =>
    new ApiError("validation_error", { fieldErrors, messageKey }),
  unauthorized: (messageKey?: string) => new ApiError("unauthorized", { messageKey }),
  forbidden: (messageKey?: string) => new ApiError("forbidden", { messageKey }),
  notFound: (messageKey?: string) => new ApiError("not_found", { messageKey }),
  conflict: (messageKey?: string) => new ApiError("conflict", { messageKey }),
};
