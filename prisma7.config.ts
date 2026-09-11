// Prisma 7 sozlamasi.
//
// Prisma 7'da ulanish manzili schema.prisma ichida EMAS — migratsiya va
// introspeksiya uchun shu fayldan, ilova ichida esa driver adapter orqali
// (lib/db.ts) olinadi.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
