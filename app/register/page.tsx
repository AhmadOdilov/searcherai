"use client";

import Link from "next/link";
import { AuthForm, Field } from "@/components/auth-form";

/**
 * `/register` — ro'yxatdan o'tish.
 *
 * Rol so'ralmaydi — hozircha barcha foydalanuvchilar o'qituvchi (backend
 * uni so'rovdan olmaydi, sxemadagi standart qiymatni ishlatadi).
 */
export default function RegisterPage() {
  return (
    <AuthForm
      title="Yangi hisob yarating"
      submitLabel="Ro'yxatdan o'tish"
      endpoint="/api/auth/register"
      redirectTo="/dashboard"
      footer={
        <>
          Hisobingiz bormi?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            Kirish
          </Link>
        </>
      }
    >
      {(errors) => (
        <>
          <Field
            label="To'liq ism"
            name="fullName"
            autoComplete="name"
            placeholder="Aziza Karimova"
            errors={errors}
          />
          <Field
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ism@maktab.uz"
            errors={errors}
          />
          <Field
            label="Parol"
            name="password"
            type="password"
            autoComplete="new-password"
            hint="Kamida 8 belgi"
            errors={errors}
          />
        </>
      )}
    </AuthForm>
  );
}
