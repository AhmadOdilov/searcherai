"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AuthForm } from "@/components/auth-form";
import { Input } from "@/components/ui/field";

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
      description={t("register.description")}
      submitLabel={t("register.submit")}
      submittingLabel={t("register.submitting")}
      endpoint="/api/auth/register"
      redirectTo="/dashboard"
      footer={
        <>
          {t("register.hasAccount")}{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline underline-offset-4"
          >
            {t("register.loginLink")}
          </Link>
        </>
      }
    >
      {(errors) => (
        <>
          <Input
            label={t("fields.fullName")}
            name="fullName"
            autoComplete="name"
            required
            placeholder={t("fields.fullNamePlaceholder")}
            help={t("fields.fullNameHelp")}
            errors={errors}
          />
          <Input
            label={t("fields.email")}
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder={t("fields.emailPlaceholder")}
            help={t("fields.emailHelp")}
            errors={errors}
          />
          <Input
            label={t("fields.password")}
            name="password"
            type="password"
            autoComplete="new-password"
            required
            hint={t("fields.passwordHint")}
            help={t("fields.passwordHelp")}
            errors={errors}
          />
        </>
      )}
    </AuthForm>
  );
}
