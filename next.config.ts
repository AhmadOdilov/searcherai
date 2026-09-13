import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

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
};

export default withNextIntl(nextConfig);
