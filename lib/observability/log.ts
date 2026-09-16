/**
 * Loglar — yagona, bog'liqliksiz qatlam.
 *
 * ── Nega tashqi xizmat QO'SHILMADI ────────────────────────────────────────
 * Sentry, OpenTelemetry va shunga o'xshashlar yangi bog'liqlik, yangi
 * sozlama va yangi maxfiylik savoli keltiradi. Loyihada hali haqiqiy
 * foydalanuvchilar yo'q va "qaysi xato ko'p uchraydi" degan savol ham
 * paydo bo'lmagan. Ular kerak bo'lganda, bu qatlam ustiga qo'shiladi —
 * chaqiruv joylari o'zgarmaydi.
 *
 * ── Nega mavjud PREFIKSLAR saqlandi ───────────────────────────────────────
 * Kod bazasida allaqachon izchil konventsiya bor edi: `[api]`, `[fon]`,
 * `[storage:s3]`, `[rate-limit]`, `[lesson-plan]`. Operator loglarni
 * aynan shu bo'yicha filtrlaydi. Ularni "chiroyliroq" formatga
 * almashtirish mavjud odatni buzardi va hech narsa qo'shmasdi.
 *
 * Qo'shilgani — KONTEKST: `requestId`, `generationId` va boshqa xavfsiz
 * maydonlar. Ular bo'lmasa "shu foydalanuvchining shu generatsiyasiga
 * nima bo'ldi?" degan savolga javob berib bo'lmasdi.
 *
 * ── Sirlar HECH QACHON loglanmaydi ────────────────────────────────────────
 * Parol, token, cookie, API kaliti, `Authorization` sarlavhasi — hech
 * biri. Bu shunchaki qoida emas: pastdagi `redact()` ularni kalit nomi
 * bo'yicha avtomatik o'chiradi, ya'ni chaqiruvchi xato qilsa ham sir
 * logga tushmaydi.
 */

/** Log darajasi — `console` ning mos metodiga tushadi. */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Loglarga qo'shiladigan kontekst.
 *
 * Ataylab TOR: bu yerga nima qo'shilishi mumkinligi aniq bo'lsin.
 * "Istalgan narsa" ruxsat etilsa, bir kun kimdir foydalanuvchi
 * kiritgan matnni yoki sessiya ma'lumotini qo'shib yuborardi.
 */
export interface LogContext {
  /** Bitta HTTP so'rovini boshidan oxirigacha bog'laydi. */
  requestId?: string;
  /** Qaysi yozuv ustida ish ketyapti. */
  generationId?: string;
  /** Foydalanuvchi identifikatori — ism yoki email EMAS. */
  userId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  /** Xato kodi (`validation_error`, `ai_timeout`) — matn emas. */
  code?: string;
  [key: string]: string | number | boolean | undefined;
}

/**
 * Nomi shu ro'yxatga mos kalitlar logga TUSHMAYDI.
 *
 * Tekshiruv kalit nomining bir qismi bo'yicha: `apiKey`, `api_key`,
 * `AUTH_SECRET` — uchalasi ham ushlanadi.
 */
const SECRET_KEY_PATTERN = /pass|secret|token|cookie|auth|key|credential|session|bearer/i;

/** Sir bo'lishi mumkin bo'lgan maydonlarni olib tashlaydi. */
function redact(context: LogContext): LogContext {
  const safe: LogContext = {};

  for (const [key, value] of Object.entries(context)) {
    if (value === undefined) continue;
    if (SECRET_KEY_PATTERN.test(key)) {
      safe[key] = "[olib tashlandi]";
      continue;
    }
    safe[key] = value;
  }
  return safe;
}

/** `{ requestId: "abc", status: 404 }` → `requestId=abc status=404`. */
function format(context: LogContext): string {
  return Object.entries(redact(context))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join(" ");
}

/**
 * Berilgan prefiks uchun logger yaratadi.
 *
 * Ishlatilishi:
 *   const log = createLogger("api");
 *   log.warn("validation", { requestId, route, code });
 *   → [api] validation requestId=... route=... code=...
 */
export function createLogger(prefix: string) {
  function write(level: LogLevel, message: string, context?: LogContext): void {
    const parts = [`[${prefix}]`, message];
    if (context !== undefined) {
      const formatted = format(context);
      if (formatted !== "") parts.push(formatted);
    }

    const line = parts.join(" ");

    /*
      `console` ATAYLAB ishlatiladi. Docker va Nginx loglarni stdout'dan
      yig'adi; alohida transport qo'shish hech narsa qo'shmasdi.
    */
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  }

  return {
    debug: (message: string, context?: LogContext) => write("debug", message, context),
    info: (message: string, context?: LogContext) => write("info", message, context),
    warn: (message: string, context?: LogContext) => write("warn", message, context),
    error: (message: string, context?: LogContext) => write("error", message, context),
  };
}

/** Xatoni logga yozish uchun xavfsiz matnga aylantiradi. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    /*
      Faqat nom va xabar. `stack` ATAYLAB yo'q: u uzun, loglarni
      to'ldiradi va ba'zan fayl yo'llari orqali ichki tuzilmani
      oshkor qiladi. Kerak bo'lsa chaqiruvchi uni alohida yozadi.
    */
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}
