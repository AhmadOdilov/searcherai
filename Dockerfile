# syntax=docker/dockerfile:1
#
# Searcher AI — production image.
#
# ── Nega ko'p bosqichli (multi-stage) ────────────────────────────────────────
# Build uchun kerak bo'lgan narsalar (TypeScript, Tailwind, ESLint, butun
# `node_modules` — ~500 MB) ishlab turgan serverda KERAK EMAS. Ular oxirgi
# bosqichga umuman ko'chirilmaydi: tayyor image ~200 MB atrofida qoladi.
#
# Bosqichlar:
#   deps     — bog'liqliklarni o'rnatadi (kesh uchun alohida)
#   builder  — Prisma klientini yasaydi va `next build` ni bajaradi
#   migrator — migratsiyalarni qo'llaydigan bir martalik konteyner
#   runner   — YAKUNIY image: faqat `standalone` server
#
# Qo'lda yig'ish:
#   docker build -t searcher-ai .

# Node 22 LTS — Next.js 16 kamida 20.9 ni talab qiladi.
# Alpine tanlandi: Prisma 7 driver adapter bilan ishlaydi, ya'ni platformaga
# bog'liq "query engine" binari kerak emas (klient sof JavaScript).
ARG NODE_IMAGE=node:22-alpine

# ─── 1. Bog'liqliklar ────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS deps
WORKDIR /app

# Faqat manifestlar ko'chiriladi: kod o'zgarganda ham bu qatlam keshdan
# olinadi va `npm ci` qaytadan ishlamaydi.
COPY package.json package-lock.json ./

# `--ignore-scripts` — `postinstall` (prisma generate) bu yerda kerak emas,
# u builder bosqichida sxema bilan birga ishlaydi.
RUN npm ci --ignore-scripts

# ─── 2. Build ────────────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma klienti `lib/generated/prisma` ga yasaladi (schema.prisma dagi
# `output`). Bu qadam build'dan OLDIN bo'lishi shart — `lib/db.ts` uni
# import qiladi.
RUN npx prisma generate

# `next build` uchun haqiqiy sirlar KERAK EMAS: `lib/env.ts` tekshiruvi
# dangasa (birinchi so'rovda ishlaydi), sahifalar esa dinamik render
# bo'ladi. Shunga qaramay AUTH_SECRET uzunligi bo'yicha tekshiruvga
# tushib qolmaslik uchun soxta qiymat beriladi — u image'ga tushmaydi,
# chunki runner bosqichiga faqat build natijasi ko'chiriladi.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-vaqtidagi-soxta-kalit-kamida-32-belgi"

# ── `NEXT_PUBLIC_*` — build vaqtida kerak ───────────────────────────────────
# Next.js `NEXT_PUBLIC_` bilan boshlanadigan o'zgaruvchilarni brauzerga
# ketadigan kodga BUILD paytida yozib qo'yadi. Ya'ni uni faqat `.env` ga
# qo'yish yetarli emas — build'ga uzatilishi kerak, aks holda foydalanuvchi
# eski (standart) qiymatni ko'radi.
#
# Bu sir emas: yordam uchun Telegram nomi, u baribir sahifada ko'rinadi.
ARG NEXT_PUBLIC_SUPPORT_TELEGRAM=""
ENV NEXT_PUBLIC_SUPPORT_TELEGRAM=${NEXT_PUBLIC_SUPPORT_TELEGRAM}

RUN npm run build

# Next `standalone` natijasiga loyihadagi `.env*` fayllarini ham ko'chiradi.
# `.dockerignore` ularni build kontekstidan chiqarib tashlaydi, lekin bu
# qator — ikkinchi himoya chizig'i: sir image'ga TUSHMASLIGI kerak.
RUN rm -f .next/standalone/.env .next/standalone/.env.*

# ─── 3. Migratsiya konteyneri ────────────────────────────────────────────────
# Alohida bosqich, chunki `prisma` CLI va sxema fayllari yakuniy image'da
# kerak emas. Bu konteyner `docker compose` da bir marta ishlab, tugaydi.
FROM ${NODE_IMAGE} AS migrator
WORKDIR /app

# `deps` bosqichidagi tayyor `node_modules` ni ko'chirish oson bo'lardi,
# lekin u ~1.4 GB: ichida Next, TypeScript, ESLint, AWS SDK — migratsiya
# uchun keraksiz hammasi. Kichik VPS diskida bu sezilarli.
#
# Shuning uchun bu yerda FAQAT ikki paket o'rnatiladi: `prisma` (CLI) va
# `dotenv` (uni `prisma7.config.ts` import qiladi).
#
# DIQQAT: loyihaning `package.json` i ATAYLAB `/tmp` ga qo'yilgan. Agar u
# ish papkasida tursa, `npm install` uning BARCHA bog'liqliklarini ham
# tortib keladi va butun tejamkorlik yo'qqa chiqadi (sinab ko'rildi: image
# 2.8 GB bo'lib ketdi).
COPY package.json /tmp/loyiha-package.json

RUN npm init -y >/dev/null \
 && npm install --ignore-scripts \
      "prisma@$(node -p "require('/tmp/loyiha-package.json').devDependencies.prisma")" \
      "dotenv@$(node -p "require('/tmp/loyiha-package.json').devDependencies.dotenv")" \
 && npm cache clean --force

COPY prisma7.config.ts ./
COPY prisma ./prisma

# `migrate deploy` — yangi migratsiyalarni qo'llaydi, hech qachon
# ma'lumotni o'chirmaydi va savol bermaydi (CI/production uchun mo'ljallangan).
CMD ["npx", "prisma", "migrate", "deploy"]

# ─── 4. Yakuniy image ────────────────────────────────────────────────────────
FROM ${NODE_IMAGE} AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# `standartda` server faqat localhost'ni tinglaydi — konteyner ichida bu
# tashqaridan (Nginx'dan) ulanib bo'lmasligini bildiradi.
ENV HOSTNAME=0.0.0.0

# ── Xavfsizlik: root EMAS ────────────────────────────────────────────────────
# Konteyner ichidagi zaiflik root huquqini bermasligi uchun ilova alohida
# foydalanuvchi nomidan ishlaydi. Alpine'da `node` guruhi/foydalanuvchisi
# allaqachon bor (uid 1000), lekin aniqlik uchun o'zimiznikini yaratamiz.
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

# `standalone` — server.js va faqat kerakli node_modules.
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Statik fayllar va `public/` standalone ichiga kirmaydi — alohida.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Generatsiya qilingan .pptx/.xlsx fayllar shu yerga tushadi
# (STORAGE_DRIVER=local). Compose'da bu papkaga volume ulanadi — konteyner
# qayta qurilganda fayllar yo'qolmaydi.
RUN mkdir -p storage && chown -R nextjs:nodejs storage

USER nextjs

EXPOSE 3000

# Sog'lik tekshiruvi konteynerning O'ZIDA — orkestrator (compose) shunga
# qarab "app tayyor" deb hisoblaydi. `wget` Alpine'da allaqachon bor.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget --quiet --spider --tries=1 http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
