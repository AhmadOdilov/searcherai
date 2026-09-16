import type { MetadataRoute } from "next";

/**
 * `robots.txt` — qidiruv tizimlari uchun qoida.
 *
 * ── Nega kerak ────────────────────────────────────────────────────────────
 * Faylsiz `/robots.txt` 404 qaytaradi. Bu xato emas (krauler "hamma
 * narsa ochiq" deb hisoblaydi), lekin ikki narsani yo'qotamiz: xususiy
 * bo'limlarni aniq belgilash va sayt xaritasiga ishora.
 *
 * ── Dashboard ALLAQACHON himoyalangan ─────────────────────────────────────
 * `proxy.ts` kirmagan so'rovni `/login` ga yo'naltiradi, ya'ni krauler
 * o'qituvchining materiallarini KO'RA OLMAYDI. Bu yerdagi `disallow` —
 * ikkinchi qatlam: u krauler keraksiz manzillarni umuman so'ramasligini
 * ta'minlaydi va server yukini kamaytiradi.
 *
 * ── Nega `/api` ham yopiladi ──────────────────────────────────────────────
 * API JSON qaytaradi va uni indekslashdan foyda yo'q. `/api/health`
 * ochiq bo'lsa ham, uning qidiruv natijalarida chiqishi mantiqsiz.
 *
 * ── Ochiq qoladigan sahifalar ─────────────────────────────────────────────
 * `/`, `/about`, `/login`, `/register` — mahsulotni topish uchun aynan
 * shular kerak. Ular ataylab bloklanmaydi.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        // O'qituvchining shaxsiy ish sohasi.
        "/dashboard",
        // JSON javoblar — indekslashdan foyda yo'q.
        "/api",
        // Sessiya tugaganda cookie'ni tozalaydigan texnik yo'l.
        "/session-expired",
      ],
    },
    /*
      `sitemap` ATAYLAB ko'rsatilmagan: loyihada sitemap yo'q va
      mavjud bo'lmagan faylga ishora qilish krauler uchun buzuq
      havola bo'lardi. Ochiq sahifalar to'rtta va ular bir-biriga
      havola qiladi — sitemap'siz ham topiladi.
    */
  };
}
