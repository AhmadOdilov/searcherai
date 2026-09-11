"use client";

import { useUser } from "@/lib/hooks/use-user";

/**
 * `useUser()` dan foydalanishga namuna.
 *
 * Bu komponent klient tomonida ishlaydi, lekin foydalanuvchini olish uchun
 * HECH QANDAY so'rov yubormaydi — maket contextga qo'ygan qiymatni oladi.
 * Keyingi modullar (dars ishlanmasi formasi, til almashtirgich) shu usulda
 * yoziladi.
 */
export function UserGreeting() {
  const user = useUser();

  return (
    <div>
      <h1 className="text-xl font-semibold text-slate-900">
        Xush kelibsiz, {user.fullName}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Quyidagi modullar keyingi bosqichlarda qo&apos;shiladi.
      </p>
    </div>
  );
}
