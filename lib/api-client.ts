/**
 * Brauzer tomonidan API'ga murojaat qilish uchun yupqa qatlam.
 *
 * Nega kerak: backend javoblari har doim `{ ok, data }` yoki
 * `{ ok: false, error }` shaklida. Har bir komponentda shu shaklni
 * ochib, xato holatini qayta ishlash takrorlanmasin.
 *
 * Bu fayl KLIENT tomonida ishlaydi — `server-only` belgisi yo'q.
 */

/** Backenddan kelgan xatolik — forma maydonlari bilan. */
export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly fieldErrors?: Record<string, string[]>;

  constructor(
    status: number,
    code: string,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

interface ApiEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
  };
}

/**
 * API chaqiruvi. Muvaffaqiyatda `data` ni qaytaradi, aks holda
 * `ApiClientError` tashlaydi.
 */
export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const { method = "GET", body, signal } = options;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? {} : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      // Cookie'lar yuborilishi uchun — sessiya shunda.
      credentials: "same-origin",
    });
  } catch (cause) {
    // Tarmoq uzilgan yoki server javob bermadi.
    if (cause instanceof Error && cause.name === "AbortError") throw cause;
    throw new ApiClientError(
      0,
      "network_error",
      "Serverga ulanib bo'lmadi. Internet aloqasini tekshirib ko'ring.",
    );
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiClientError(
      response.status,
      "bad_response",
      "Serverdan kutilmagan javob keldi.",
    );
  }

  if (!response.ok || !envelope.ok) {
    const error = envelope.error;
    throw new ApiClientError(
      response.status,
      error?.code ?? "unknown",
      error?.message ?? "Kutilmagan xatolik yuz berdi.",
      error?.fieldErrors,
    );
  }

  return envelope.data as T;
}
