/**
 * API qatlamining xatolik turlari.
 *
 * `AiError` (lib/ai/types.ts) — AI xizmatiga aloqador nosozliklar uchun.
 * Bu yerdagi `ApiError` — ilova mantig'iga aloqador nosozliklar uchun:
 * topilmadi, ruxsat yo'q, validatsiya o'tmadi.
 */

export type ApiErrorCode =
  | "validation_error" // 400 — kiritilgan ma'lumot noto'g'ri
  | "unauthorized" // 401 — kirish kerak
  | "forbidden" // 403 — huquq yo'q
  | "not_found" // 404
  | "conflict" // 409 — masalan email allaqachon band
  | "internal_error"; // 500

const HTTP_STATUS: Record<ApiErrorCode, number> = {
  validation_error: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  internal_error: 500,
};

/** Har bir kod uchun foydalanuvchiga ko'rsatiladigan standart xabar. */
const DEFAULT_MESSAGES: Record<ApiErrorCode, string> = {
  validation_error: "Kiritilgan ma'lumotlar to'g'ri emas.",
  unauthorized: "Davom etish uchun tizimga kiring.",
  forbidden: "Bu amalni bajarishga ruxsatingiz yo'q.",
  not_found: "So'ralgan ma'lumot topilmadi.",
  conflict: "Bu ma'lumot allaqachon mavjud.",
  internal_error: "Serverda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
};

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  /** Foydalanuvchiga ko'rsatiladigan xabar. */
  readonly userMessage: string;
  /** Maydon bo'yicha validatsiya xatolari: { email: ["..."] } */
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    code: ApiErrorCode,
    options: {
      userMessage?: string;
      /** Log uchun texnik tafsilot. */
      detail?: string;
      fieldErrors?: Record<string, string[]>;
      cause?: unknown;
    } = {},
  ) {
    super(options.detail ?? options.userMessage ?? DEFAULT_MESSAGES[code], {
      cause: options.cause,
    });
    this.name = "ApiError";
    this.code = code;
    this.userMessage = options.userMessage ?? DEFAULT_MESSAGES[code];
    this.fieldErrors = options.fieldErrors;
  }

  get httpStatus(): number {
    return HTTP_STATUS[this.code];
  }
}

/** Qulaylik uchun qisqa yordamchilar. */
export const apiErrors = {
  validation: (fieldErrors?: Record<string, string[]>, userMessage?: string) =>
    new ApiError("validation_error", { fieldErrors, userMessage }),
  unauthorized: (userMessage?: string) => new ApiError("unauthorized", { userMessage }),
  forbidden: (userMessage?: string) => new ApiError("forbidden", { userMessage }),
  notFound: (userMessage?: string) => new ApiError("not_found", { userMessage }),
  conflict: (userMessage?: string) => new ApiError("conflict", { userMessage }),
};
