import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError } from "@/lib/api/errors";
import { AiError } from "@/lib/ai/types";
import { EnvError } from "@/lib/env";

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
    /** Foydalanuvchiga ko'rsatish uchun xabar (o'zbek tilida). */
    message: string;
    /** Forma maydonlari bo'yicha xatolar, bo'lsa. */
    fieldErrors?: Record<string, string[]>;
  };
};

type Handler<TContext> = (request: Request, context: TContext) => Promise<Response>;

export function withErrorHandling<TContext>(
  handler: Handler<TContext>,
): Handler<TContext> {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (caught) {
      return toErrorResponse(caught, request);
    }
  };
}

function jsonError(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string[]>,
): NextResponse<ApiFailure> {
  return NextResponse.json<ApiFailure>(
    { ok: false, error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } },
    { status },
  );
}

function toErrorResponse(caught: unknown, request: Request): NextResponse<ApiFailure> {
  // Log — SERVER tomonida, to'liq tafsilot bilan.
  const route = `${request.method} ${new URL(request.url).pathname}`;

  if (caught instanceof ApiError) {
    // Kutilgan holat — foydalanuvchi xatosi. `warn` darajasida.
    console.warn(`[api] ${route} → ${caught.code}: ${caught.message}`);
    return jsonError(
      caught.httpStatus,
      caught.code,
      caught.userMessage,
      caught.fieldErrors,
    );
  }

  if (caught instanceof AiError) {
    console.error(`[api] ${route} → ai:${caught.kind}: ${caught.message}`);
    return jsonError(caught.httpStatus, `ai_${caught.kind}`, caught.userMessage);
  }

  if (caught instanceof z.ZodError) {
    // Handler ichida `.parse()` ishlatilgan va biz ushlamagan holat.
    console.warn(`[api] ${route} → validation: ${z.prettifyError(caught)}`);
    return jsonError(
      400,
      "validation_error",
      "Kiritilgan ma'lumotlar to'g'ri emas.",
      z.flattenError(caught).fieldErrors as Record<string, string[]>,
    );
  }

  if (caught instanceof EnvError) {
    // Sozlama xatosi — foydalanuvchi ayblanmaydi, lekin tafsilot ham berilmaydi.
    console.error(`[api] ${route} → env: ${caught.message}`);
    return jsonError(
      503,
      "not_configured",
      "Xizmat vaqtincha mavjud emas. Administrator bilan bog'laning.",
    );
  }

  // Kutilmagan xatolik — to'liq loglaymiz, foydalanuvchiga umumiy xabar.
  console.error(`[api] ${route} → kutilmagan xatolik:`, caught);
  return jsonError(
    500,
    "internal_error",
    "Serverda xatolik yuz berdi. Iltimos, qayta urinib ko'ring.",
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
      userMessage: "So'rov tanasi to'g'ri JSON emas.",
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
