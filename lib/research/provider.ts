/**
 * TADQIQOT PROVAYDERI — tashqi manbalardan dalil olish qatlami.
 *
 * ── Holat: KALIT YO'Q ─────────────────────────────────────────────────────
 * Hozir hech qaysi web-search provayderining kaliti sozlanmagan. Shuning
 * uchun bu qatlam HAR DOIM "mavjud emas" deb javob beradi.
 *
 * ── Nega baribir yozildi ──────────────────────────────────────────────────
 * Mavjud emasligi generatsiya oqimida AYTILISHI kerak. Aks holda AI
 * "bozor hajmi 2.4 mlrd dollar" kabi raqamlarni O'YLAB TOPADI va ular
 * slaydda ishonchli ko'rinadi. Bu — foydalanuvchini yo'ldan ozdirish.
 *
 * Interfeys borligi uchun slayd rejalashtiruvchi aniq qaror qabul qila
 * oladi: dalil manbasi yo'q → raqamli maketlar (statistika, diagramma)
 * TAQIQLANADI va promptda "statistika o'ylab topma" deyiladi.
 *
 * ── Nega soxta javob QAYTARILMAYDI ────────────────────────────────────────
 * "Namuna ma'lumot" qaytarish eng yomon variant bo'lardi: u tizimning
 * qolgan qismi uchun haqiqiy ma'lumotdan farq qilmaydi va oxir-oqibat
 * o'qituvchining slaydiga tushadi.
 */

export const RESEARCH_PROVIDERS = ["tavily", "brave", "serper"] as const;

export type ResearchProviderName = (typeof RESEARCH_PROVIDERS)[number];

/** Bitta topilma — provayder ulanganda shu shaklda keladi. */
export interface ResearchFinding {
  claim: string;
  url: string;
  title: string;
  publishedAt: string | null;
}

export type ResearchStatus =
  | { available: true; provider: ResearchProviderName }
  | {
      available: false;
      /**
       * `no_credentials` — kalit sozlanmagan (hozirgi holat).
       * `disabled`       — kalit bor, lekin ataylab o'chirilgan.
       */
      reason: "no_credentials" | "disabled";
    };

/*
  Muhit o'zgaruvchilari `lib/env.ts` SXEMASIGA QO'SHILMAGAN va bu ataylab:
  o'sha sxema majburiy sozlamalarni tekshiradi va ilova ishga tushishi
  uchun to'g'ri bo'lishi shart. Tadqiqot esa ixtiyoriy qo'shimcha —
  kaliti yo'qligi ilovani to'xtatmasligi kerak.
*/
const ENV_KEYS: Record<ResearchProviderName, string> = {
  tavily: "TAVILY_API_KEY",
  brave: "BRAVE_SEARCH_API_KEY",
  serper: "SERPER_API_KEY",
};

/**
 * Qaysi provayder sozlangan.
 *
 * Kalitning O'ZI hech qayerga qaytarilmaydi — faqat mavjudligi.
 */
export function researchStatus(): ResearchStatus {
  if (process.env.RESEARCH_DISABLED === "1") {
    return { available: false, reason: "disabled" };
  }

  for (const provider of RESEARCH_PROVIDERS) {
    const value = process.env[ENV_KEYS[provider]];
    if (typeof value === "string" && value.trim().length > 0) {
      return { available: true, provider };
    }
  }

  return { available: false, reason: "no_credentials" };
}

export class ResearchUnavailableError extends Error {
  readonly reason: "no_credentials" | "disabled";

  constructor(reason: "no_credentials" | "disabled") {
    super(`research unavailable: ${reason}`);
    this.name = "ResearchUnavailableError";
    this.reason = reason;
  }
}

/**
 * Tadqiqot so'rovi.
 *
 * Kalit bo'lmasa XATO tashlaydi — bo'sh massiv emas. Sabab: bo'sh massiv
 * "qidirdim, hech narsa topilmadi" degani, bu esa boshqa holat.
 * Chaqiruvchi ikkisini farqlay olishi kerak.
 *
 * Provayder ulangan holat hali yozilmagan — kalit paydo bo'lganda shu
 * yerga transport qo'shiladi. Yarim ishlaydigan implementatsiyadan
 * ko'ra ochiq xato yaxshiroq.
 */
export async function research(query: string): Promise<ResearchFinding[]> {
  const status = researchStatus();
  if (!status.available) throw new ResearchUnavailableError(status.reason);

  void query;
  throw new Error(`research provider "${status.provider}" transport not implemented yet`);
}
