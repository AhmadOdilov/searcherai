import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { LogoutButton } from "@/components/logout-button";
import { UserGreeting } from "@/components/user-greeting";

/**
 * `/dashboard` — kirgan foydalanuvchining ishchi sahifasi.
 *
 * Avtorizatsiya `app/dashboard/layout.tsx` da tekshirilgan, shuning uchun
 * bu yerda foydalanuvchi albatta mavjud. `getCurrentUser` `cache()` bilan
 * o'ralgan — maket allaqachon chaqirgani uchun bazaga QAYTA so'rov ketmaydi.
 */
export default async function DashboardPage() {
  // Maket kirmagan foydalanuvchini /login ga yuborgan, demak `user` bor.
  const user = (await getCurrentUser())!;

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Searcher AI</p>
            <p className="text-xs text-slate-500">{user.email}</p>
          </div>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-10">
        {/* Klient komponenti — foydalanuvchini contextdan oladi. */}
        <UserGreeting />

        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {MODULES.map((module) => (
            <li
              key={module.title}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="text-sm font-medium text-slate-900">{module.title}</p>
              <p className="mt-1 text-xs text-slate-500">{module.description}</p>
              <p className="mt-3 text-xs font-medium text-slate-400">Tez orada</p>
            </li>
          ))}
        </ul>

        <p className="mt-8 text-xs text-slate-400">
          Tizim holati:{" "}
          <Link href="/api/health" className="underline">
            /api/health
          </Link>
        </p>
      </div>
    </main>
  );
}

const MODULES = [
  {
    title: "Dars ishlanmasi",
    description: "Mavzu, sinf va fanni kiritib to'liq dars rejasini oling.",
  },
  {
    title: "Prezentatsiya (.pptx)",
    description: "Dars asosida tayyor slaydlar avtomatik yaratiladi.",
  },
  {
    title: "Kalendar reja (.xlsx)",
    description: "Chorak yoki yil uchun darslar jadvali Excel formatida.",
  },
  {
    title: "Tarjima (UZ / RU / EN)",
    description: "Interfeys va generatsiya qilingan kontent uch tilda.",
  },
];
