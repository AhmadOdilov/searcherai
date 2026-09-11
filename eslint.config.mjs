import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";

/**
 * ESLint sozlamasi.
 *
 * `eslint-config-prettier` ENG OXIRIDA turadi — u formatlashga aloqador
 * qoidalarni o'chiradi, aks holda ESLint va Prettier bir-biriga qarshi ishlaydi.
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma generatsiya qilgan kod tekshirilmaydi
    "lib/generated/**",
  ]),
  {
    rules: {
      // `_` bilan boshlanadigan argumentlar ataylab ishlatilmagan deb hisoblanadi
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  prettierConfig,
]);

export default eslintConfig;
