import "server-only";
import { generateJson } from "@/lib/ai/provider";
import type { AiUsage } from "@/lib/ai/types";
import { getEnv } from "@/lib/env";
import { buildSearchSystemPrompt, buildSearchUserPrompt } from "@/lib/search/prompt";
import {
  searchAnswerSchema,
  type SearchAnswer,
  type SearchInput,
} from "@/lib/validations/search";

/**
 * AI qidiruv — biznes mantiq qatlami.
 *
 * ── Nega bu modul SINXRON ────────────────────────────────────────────────
 * Qolgan uch modul fon rejimida ishlaydi: PENDING yozuv yaratiladi, 202
 * qaytadi, frontend so'rab turadi. Sabab — ular 20-90 soniya davom etadi
 * va fayl yasaydi.
 *
 * Qidiruv esa 5-10 soniya oladi va hech narsa saqlamaydi. Shu qadar
 * qisqa ish uchun fon mexanizmi (baza yozuvi, so'rab turish, migratsiya,
 * o'chirish oqimi) ortiqcha murakkablik bo'lardi — foydalanuvchi
 * baribir ekran oldida kutib turadi.
 *
 * ── Nega natija saqlanmaydi ──────────────────────────────────────────────
 * Savol bir martalik: o'qituvchi javobni o'qiydi va dars ishlanmasiga
 * o'tadi. Tarix kerak bo'lsa, bu alohida bosqichning ishi — u jadval,
 * ro'yxat sahifasi va o'chirish tugmasini talab qiladi.
 */

export interface SearchResult {
  answer: SearchAnswer;
  /** Qancha davom etgani — diagnostika uchun, foydalanuvchiga ko'rsatilmaydi. */
  durationMs: number;
  model: string;
  /**
   * Sarflangan tokenlar — route ularni kvota yozuviga yozadi.
   *
   * Servis o'zi yozmaydi: bandlik route'da olinadi va uni shu yerga
   * uzatish qatlamlarni bir-biriga bog'lab qo'yardi.
   */
  usage: AiUsage;
}

export async function runSearch(input: SearchInput): Promise<SearchResult> {
  const { data, meta } = await generateJson({
    schema: searchAnswerSchema,
    systemPrompt: buildSearchSystemPrompt(input.language),
    prompt: buildSearchUserPrompt(input),
    /*
      Qidiruv — yagona modul bo'lib, ERKIN MATN yozadi. Aynan shu yerda
      modelning o'zbek tili sifati ko'rinadi: haqiqiy o'lchovda bir model
      "kislorod" o'rniga "oksid gaz", "yutadi" o'rniga "yodirish" deb
      yozdi. Shuning uchun modelni alohida sozlash imkoni bor
      (`SEARCH_AI_MODEL`); belgilanmasa umumiy `AI_MODEL` ishlaydi.
    */
    model: getEnv().searchAiModel,
  });

  return {
    answer: data,
    durationMs: meta.totalDurationMs,
    model: meta.model,
    usage: meta.usage,
  };
}
