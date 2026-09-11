import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Bosh sahifa. Kirgan foydalanuvchiga /dashboard havolasi, boshqalarga
 * kirish/ro'yxatdan o'tish taklifi.
 */
export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-semibold text-slate-900">Searcher AI</h1>
        <p className="mt-3 text-sm text-slate-600">
          O&apos;qituvchilar uchun AI-yordamchi: dars ishlanmasi, prezentatsiya, Excel
          reja va ko&apos;p tilli kontent — bir necha daqiqada.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          {user ? (
            <Link
              href="/dashboard"
              className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Ishchi sahifaga o&apos;tish
            </Link>
          ) : (
            <>
              <Link
                href="/register"
                className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                Ro&apos;yxatdan o&apos;tish
              </Link>
              <Link
                href="/login"
                className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white"
              >
                Kirish
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
