import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { assertSameOrigin } from "@/lib/api/csrf";
import { assertNoNullBytes } from "@/lib/api/url-guard";
import { AiError } from "@/lib/ai/types";
import { EnvError } from "@/lib/env";
import { translateFieldErrors, translateKey } from "@/lib/i18n/translate";
import { createLogger, describeError } from "@/lib/observability/log";

const log = createLogger("api");

/** So'rovni bog'laydigan identifikator sarlavhasi. */
export const REQUEST_ID_HEADER = "x-request-id";

/**
 * So'rov identifikatori.
 *
 * ── Nega proxy'da emas, SHU YERDA ─────────────────────────────────────────
 * `proxy.ts` ning matcher'i `/api` ni ataylab chetlab o'tadi (API o'zini
 * `requireUser()` bilan himoya qiladi va JSON qaytaradi). Ya'ni API
 * so'rovlari proxy'dan UMUMAN o'tmaydi va u yerda yaratilgan
 * identifikator ularga yetib bormasdi.
 *
 * Tashqi qiymat (masalan Nginx yoki CDN qo'ygan) bo'lsa — u ustun
 * turadi: shunda bitta so'rov qatlamlar bo'ylab bir xil nom bilan
 * kuzatiladi. Uzunligi cheklanadi: sarlavha mijoz boshqaradigan qiymat.
 */
function requestIdOf(request: Request): string {
  const incoming = request.headers.get(REQUEST_ID_HEADER);
  if (incoming !== null && incoming.trim() !== "") {
    return incoming.trim().slice(0, 64);
  }
  return crypto.randomUUID();
}

/**
 * API route'lar uchun umumiy xatolik qayta ishlovchisi.
 *
 * Maqsad: har bir modulda (dars ishlanmasi, prezentatsiya, Excel, tarjima)
 * bir xil try/catch blokini qayta yozmaslik va MUHIMI — texnik tafsilotlar
 * (API kaliti, SQL, stack trace) foydalanuvchiga tushib ketmasligi.
 *
 * Ishlatilishi:
 *
 *   export const POST = withErrorHandling(async (request) => {
 *     const body = await parseJsonBody(request, mySchema);
 *     const result = await doWork(body);
 *     return NextResponse.json({ ok: true, data: result });
 *   });
 */

/** Muvaffaqiyatli javobning standart shakli. */
export type ApiSuccess<T> = { ok: true; data: T };

/** Xatolik javobining standart shakli — frontend shunga tayanadi. */
export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    /**
     * Foydalanuvchiga ko'rsatish uchun xabar — SO'ROV TILIDA tarjima
     * qilingan.
     *
     * Tarjima aynan shu yerda, javob shakllanayotganda qilinadi: xato
     * tashlangan joy (servis qatlami) foydalanuvchi tilini bilmaydi.
     */
    message: string;
    /**
     * Tarjima kaliti — klient o'zi tarjima qilmoqchi bo'lsa yoki xato
     * turini dasturiy aniqlashi kerak bo'lsa.
     */
    messageKey: string;
    /** Forma maydonlari bo'yicha xatolar (tarjima qilingan), bo'lsa. */
    fieldErrors?: Record<string, string[]>;
  };
};

type Handler<TContext> = (request: Request, context: TContext) => Promise<Response>;

export function withErrorHandling<TContext>(
  handler: Handler<TContext>,
): Handler<TContext> {
  return async (request, context) => {
    try {
      /*
        CSRF tekshiruvi BARCHA route'larda, bitta joyda.

        Nega har bir route'da alohida emas: yangi endpoint yozgan
        dasturchi uni qo'shishni unutishi mumkin va himoya jim
        yo'qolardi. `withErrorHandling` esa har bir route'da
        allaqachon ishlatiladi — ya'ni yangi route avtomatik
        himoyalanadi.
      */
      assertSameOrigin(request);

      /*
        Manzil shakli — CSRF bilan bir xil sababga ko'ra shu yerda.

        Yo'ldagi nol bayt (`%00`) `params.id` ga o'zgarishsiz tushar va
        bazadan 500 qaytarardi. Sababi va nega faqat nol bayt
        tekshirilishi: lib/api/url-guard.ts
      */
      assertNoNullBytes(request);

      return await handler(request, context);
    } catch (caught) {
      return await toErrorResponse(caught, request, requestIdOf(request));
    }
  };
}

async function jsonError(
  status: number,
  code: string,
  messageKey: string,
  fieldErrorKeys?: Record<string, string[]>,
  requestId?: string,
): Promise<NextResponse<ApiFailure>> {
  const message = await translateKey(messageKey);
  const fieldErrors =
    fieldErrorKeys === undefined ? undefined : await translateFieldErrors(fieldErrorKeys);

  const response = NextResponse.json<ApiFailure>(
    {
      ok: false,
      error: {
        code,
        message,
        messageKey,
        ...(fieldErrors ? { fieldErrors } : {}),
      },
    },
    { status },
  );

  /*
    Identifikator javob sarlavhasida ham qaytadi.

    Nega: o'qituvchi "xato chiqdi" deb yozganda, uning brauzeridagi
    javobda shu qiymat turadi va uni loglardan ANIQ topish mumkin
    bo'ladi. Aks holda vaqt bo'yicha taxmin qilishga to'g'ri kelardi.
  */
  if (requestId !== undefined) response.headers.set(REQUEST_ID_HEADER, requestId);

  return response;
}

async function toErrorResponse(
  caught: unknown,
  request: Request,
  requestId: string,
): Promise<NextResponse<ApiFailure>> {
  /*
    Log SERVER tomonida va endi KONTEKST bilan: `requestId` javob
    sarlavhasida ham qaytadi, ya'ni foydalanuvchi aytgan xatoni
    loglardan aniq topish mumkin.

    Xato MATNI (`caught.message`) chiqariladi — u ichki tafsilot
    (`detail`) bo'lib, foydalanuvchiga hech qachon yuborilmaydi.
  */
  const url = new URL(request.url);
  const base = { requestId, route: url.pathname, method: request.method };

  if (caught instanceof ApiError) {
    // Kutilgan holat — foydalanuvchi xatosi. `warn` darajasida.
    log.warn(caught.message, {
      ...base,
      code: caught.code,
      status: caught.httpStatus,
    });
    return jsonError(
      caught.httpStatus,
      caught.code,
      caught.messageKey,
      caught.fieldErrors,
      requestId,
    );
  }

  if (caught instanceof AiError) {
    log.error(caught.message, {
      ...base,
      code: `ai_${caught.kind}`,
      status: caught.httpStatus,
    });
    return jsonError(
      caught.httpStatus,
      `ai_${caught.kind}`,
      caught.messageKey,
      undefined,
      requestId,
    );
  }

  if (caught instanceof z.ZodError) {
    // Handler ichida `.parse()` ishlatilgan va biz ushlamagan holat.
    log.warn(z.prettifyError(caught), { ...base, code: "validation_error", status: 400 });
    return jsonError(
      400,
      "validation_error",
      "errors.api.validation_error",
      z.flattenError(caught).fieldErrors as Record<string, string[]>,
      requestId,
    );
  }

  if (caught instanceof EnvError) {
    // Sozlama xatosi — foydalanuvchi ayblanmaydi, lekin tafsilot ham berilmaydi.
    log.error(caught.message, { ...base, code: "not_configured", status: 503 });
    return jsonError(
      503,
      "not_configured",
      "errors.api.not_configured",
      undefined,
      requestId,
    );
  }

  // Kutilmagan xatolik — loglaymiz, foydalanuvchiga umumiy xabar.
  log.error(describeError(caught), { ...base, code: "internal_error", status: 500 });
  return jsonError(
    500,
    "internal_error",
    "errors.api.internal_error",
    undefined,
    requestId,
  );
}

/**
 * So'rov tanasini o'qib, zod sxemasi bilan tekshiradi.
 *
 * Validatsiya o'tmasa `ApiError` tashlaydi — `withErrorHandling` uni
 * maydonlar bo'yicha xatolar bilan 400 javobiga aylantiradi.
 */
export async function parseJsonBody<TSchema extends z.ZodType>(
  request: Request,
  schema: TSchema,
): Promise<z.infer<TSchema>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch (cause) {
    throw new ApiError("validation_error", {
      messageKey: "errors.api.invalidJsonBody",
      detail: "request.json() muvaffaqiyatsiz",
      cause,
    });
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError("validation_error", {
      fieldErrors: z.flattenError(parsed.error).fieldErrors as Record<string, string[]>,
      detail: z.prettifyError(parsed.error),
    });
  }

  return parsed.data as z.infer<TSchema>;
}

/** Muvaffaqiyatli javob — qo'lda `{ ok: true }` yozmaslik uchun. */
export function ok<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json<ApiSuccess<T>>({ ok: true, data }, { status });
}
