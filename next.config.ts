import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";
import { SECURITY_HEADERS } from "./lib/security/headers";

/**
 * next-intl plagini `i18n/request.ts` faylini topib, tarjimalarni
 * server komponentlariga ulaydi.
 */
const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig: NextConfig = {
  /*
    ── `standalone` — Docker uchun ──────────────────────────────────────────
    Bu rejimda `next build` `.next/standalone/` ichiga TO'LIQ ishlaydigan
    server yig'adi: `server.js` va faqat HAQIQATAN ishlatiladigan
    `node_modules` fayllari (Next buni import izlari bo'yicha aniqlaydi).

    Nega muhim: bu bo'lmasa Docker image'ga butun `node_modules` (~500 MB)
    ko'chirilishi kerak bo'lardi. Standalone bilan runner bosqichiga
    ~150 MB tushadi va `npm ci --omit=dev` ham kerak emas.

    DIQQAT: `.next/static` va `public` standalone ichiga KIRMAYDI — ular
    Dockerfile'da alohida ko'chiriladi (Next hujjatlarida ham shunday).
  */
  output: "standalone",

  /*
    Ishonchli proksi ortida ishlayapmiz (Nginx). Next so'rov manzilini
    `X-Forwarded-*` sarlavhalaridan oladi — shunda `APP_URL` va cookie
    `secure` bayrog'i to'g'ri ishlaydi.
  */
  poweredByHeader: false,

  /*
    ── `storage/` standalone natijasiga TUSHMASLIGI kerak ───────────────────
    `lib/storage/local.ts` saqlagich ildizini `path.join(process.cwd(),
    "storage")` bilan hisoblaydi. Izlarni yig'uvchi (file tracing) shu
    naqshni STATIK ko'radi va butun papkani bog'liqlik deb belgilaydi —
    natijada `next build` o'qituvchilar yaratgan .pptx/.xlsx fayllarni
    `.next/standalone/storage/` ga NUSXALAYDI.

    Ikki oqibati bor:
     · deploy paketiga begona foydalanuvchilarning hujjatlari tushadi;
     · standalone server o'z ish papkasiga yozadi, ya'ni keyingi build
       eski nusxani ustiga qo'yib, haqiqiy fayllarni yo'qotishi mumkin.

    Docker yo'lida bu ko'rinmaydi: `.dockerignore` `storage` ni build
    kontekstidan chiqaradi, ya'ni builder bosqichida papka umuman yo'q.
    Lekin bu tasodifiy himoya — Docker'siz build qilingan zahoti muammo
    qaytadi. Shuning uchun chiqarib tashlash AYNAN shu yerda.

    Fayllar runtime'da o'qiladi (yo'l bazadan keladi), ya'ni ularni
    izga qo'shishning hech qanday foydasi yo'q.
  */
  outputFileTracingExcludes: {
    "/*": ["storage/**/*"],
  },

  /*
    ── Xavfsizlik sarlavhalari ──────────────────────────────────────────────
    Ro'yxat va har birining sababi `lib/security/headers.ts` da.

    `source: "/(.*)"` — BARCHA yo'llar: HTML sahifalar, API javoblari va
    statik fayllar. Ataylab shunday: audit aynan shu yerda bo'shliq
    topgan edi (Nginx'da sarlavhalar faqat ba'zi `location` larga
    tushardi), shuning uchun endi istisno yo'q.

    CSP bu ro'yxatda YO'Q — u har so'rovda yangi nonce talab qiladi va
    `proxy.ts` da qo'yiladi.
  */
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [...SECURITY_HEADERS],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
