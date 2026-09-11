"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthForm, Field } from "@/components/auth-form";

/**
 * `/login` — tizimga kirish.
 *
 * `useSearchParams` Suspense talab qiladi, shuning uchun forma alohida
 * komponentga ajratilgan.
 */
function LoginForm() {
  const searchParams = useSearchParams();
  // Proxy foydalanuvchini bu yerga yuborganda qaysi sahifani so'raganini
  // `?next=` da uzatadi — kirgandan keyin shu sahifaga qaytaramiz.
  const next = searchParams.get("next");
  // Faqat ichki yo'llarga ruxsat: tashqi manzil bo'lsa hujumchi
  // foydalanuvchini o'z saytiga yo'naltirib, ishonchli ko'rinishdan
  // foydalanishi mumkin (open redirect).
  const redirectTo =
    next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";

  return (
    <AuthForm
      title="Hisobingizga kiring"
      submitLabel="Kirish"
      endpoint="/api/auth/login"
      redirectTo={redirectTo}
      footer={
        <>
          Hisobingiz yo&apos;qmi?{" "}
          <Link href="/register" className="font-medium text-slate-900 underline">
            Ro&apos;yxatdan o&apos;tish
          </Link>
        </>
      }
    >
      {(errors) => (
        <>
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
            autoComplete="current-password"
            errors={errors}
          />
        </>
      )}
    </AuthForm>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
