"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthForm, Field } from "@/components/auth-form";

/**
 * `/register` — ro'yxatdan o'tish.
 *
 * Rol so'ralmaydi — hozircha barcha foydalanuvchilar o'qituvchi (backend
 * uni so'rovdan olmaydi, sxemadagi standart qiymatni ishlatadi).
 */
export default function RegisterPage() {
  const t = useTranslations("auth");

  return (
    <AuthForm
      title={t("register.title")}
      submitLabel={t("register.submit")}
      endpoint="/api/auth/register"
      redirectTo="/dashboard"
      footer={
        <>
          {t("register.hasAccount")}{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            {t("register.loginLink")}
          </Link>
        </>
      }
    >
      {(errors) => (
        <>
          <Field
            label={t("fields.fullName")}
            name="fullName"
            autoComplete="name"
            placeholder={t("fields.fullNamePlaceholder")}
            errors={errors}
          />
          <Field
            label={t("fields.email")}
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t("fields.emailPlaceholder")}
            errors={errors}
          />
          <Field
            label={t("fields.password")}
            name="password"
            type="password"
            autoComplete="new-password"
            hint={t("fields.passwordHint")}
            errors={errors}
          />
        </>
      )}
    </AuthForm>
  );
}
