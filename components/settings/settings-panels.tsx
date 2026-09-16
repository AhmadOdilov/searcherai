"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check, LogOut, ShieldAlert, Trash2 } from "lucide-react";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Card, ToneCard } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { HelpLink } from "@/components/ui/help-link";

/**
 * Sozlamalar sahifasining amal qiladigan qismlari.
 *
 * ── Nega uchta alohida panel, bitta katta forma emas ──────────────────────
 * Uchta amal uch xil og'irlikda: profilni saqlash — kundalik ish,
 * parolni o'zgartirish — xavfsizlik amali, hisobni o'chirish — qaytarib
 * bo'lmaydigan. Ularni bitta formaga qo'shsak, "Saqlash" tugmasi
 * ularning hammasini anglatardi va o'qituvchi nima bo'layotganini
 * bilmay qolardi.
 *
 * ── Har panelning O'Z holati bor ──────────────────────────────────────────
 * Bitta umumiy "yuklanmoqda" bayrog'i bo'lsa, parol o'zgarayotganda
 * profil tugmasi ham o'chib qolardi va sabab tushunarsiz bo'lardi.
 */

interface AccountUser {
  fullName: string;
  email: string;
  phone: string | null;
}

export function SettingsPanels({ user }: { user: AccountUser }) {
  return (
    <div className="space-y-8">
      <AccountPanel user={user} />
      <SecurityPanel />
      <DangerPanel />
    </div>
  );
}

/** Kundalik ma'lumot: ism va telefon. */
function AccountPanel({ user }: { user: AccountUser }) {
  const t = useTranslations("settings.account");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [fullName, setFullName] = useState(user.fullName);
  const [phone, setPhone] = useState(user.phone ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const dirty = fullName !== user.fullName && true;

  async function handleSave() {
    setBusy(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);

    try {
      await apiRequest("/api/user/profile", {
        method: "PATCH",
        body: { fullName, phone },
      });
      setSaved(true);
      // Sarlavhadagi ism ham yangilansin.
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        if (caught.fieldErrors) setFieldErrors(caught.fieldErrors);
        else setError(caught.message);
      } else {
        setError(tCommon("unexpectedError"));
      }
    }
    setBusy(false);
  }

  return (
    <Panel title={t("title")}>
      <div className="space-y-5">
        <Input
          label={t("fullName")}
          name="fullName"
          value={fullName}
          onChange={(event) => {
            setFullName(event.target.value);
            setSaved(false);
          }}
          errors={fieldErrors}
        />

        {/*
          Email faqat KO'RSATILADI. Uni o'zgartirish yangi manzilni
          tasdiqlashni talab qiladi (tasdiqlash xati), bunday
          infratuzilma esa loyihada yo'q. "Ishlaydigandek ko'rinadigan,
          lekin ishlamaydigan" maydon qo'yilmadi.
        */}
        <div>
          <span className="mb-2 block text-base font-medium text-neutral-800">
            {t("email")}
          </span>
          <p className="min-h-11 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-base break-all text-neutral-600">
            {user.email}
          </p>
          <p className="mt-1 text-sm text-neutral-500">{t("emailHint")}</p>
        </div>

        <Input
          label={t("phone")}
          name="phone"
          type="tel"
          hint={t("phoneHint")}
          value={phone}
          onChange={(event) => {
            setPhone(event.target.value);
            setSaved(false);
          }}
          errors={fieldErrors}
        />

        {error !== null && <ErrorNote message={error} />}

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} loading={busy} disabled={busy || !dirty}>
            {t("save")}
          </Button>
          {saved && <SavedNote text={t("saved")} />}
        </div>
      </div>
    </Panel>
  );
}

/** Parol va sessiyalar. */
function SecurityPanel() {
  const t = useTranslations("settings.security");
  const tCommon = useTranslations("common");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState<null | "password" | "sessions">(null);
  const [done, setDone] = useState<null | "password" | "sessions">(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function changePassword() {
    setBusy("password");
    setError(null);
    setFieldErrors({});
    setDone(null);

    try {
      await apiRequest("/api/user/password", {
        method: "PUT",
        body: { currentPassword: current, newPassword: next },
      });
      setCurrent("");
      setNext("");
      setDone("password");
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        if (caught.fieldErrors) setFieldErrors(caught.fieldErrors);
        else setError(caught.message);
      } else {
        setError(tCommon("unexpectedError"));
      }
    }
    setBusy(null);
  }

  async function revokeSessions() {
    setBusy("sessions");
    setError(null);
    setDone(null);

    try {
      await apiRequest("/api/user/sessions", { method: "DELETE" });
      setDone("sessions");
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : tCommon("unexpectedError"),
      );
    }
    setBusy(null);
  }

  return (
    <Panel title={t("title")}>
      <h3 className="text-base font-semibold text-neutral-900">{t("changePassword")}</h3>

      <div className="mt-4 space-y-5">
        <Input
          label={t("currentPassword")}
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          errors={fieldErrors}
        />
        <Input
          label={t("newPassword")}
          name="newPassword"
          type="password"
          autoComplete="new-password"
          hint={t("newPasswordHint")}
          value={next}
          onChange={(event) => setNext(event.target.value)}
          errors={fieldErrors}
        />

        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={changePassword}
            loading={busy === "password"}
            disabled={busy !== null || current === "" || next === ""}
          >
            {t("changeAction")}
          </Button>
          {done === "password" && <SavedNote text={t("changed")} />}
        </div>

        {done === "password" && (
          <p className="text-base text-neutral-600">{t("changedHint")}</p>
        )}
      </div>

      {/* ── Boshqa qurilmalar ────────────────────────────────────── */}
      <div className="mt-8 border-t border-neutral-200 pt-6">
        <h3 className="text-base font-semibold text-neutral-900">{t("sessionsTitle")}</h3>
        <p className="mt-1 text-base leading-relaxed text-neutral-600">
          {t("sessionsHint")}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="secondary"
            onClick={revokeSessions}
            loading={busy === "sessions"}
            disabled={busy !== null}
            icon={
              busy === "sessions" ? undefined : <LogOut aria-hidden className="size-5" />
            }
          >
            {t("revokeAction")}
          </Button>
          {done === "sessions" && <SavedNote text={t("revoked")} />}
        </div>
      </div>

      {error !== null && (
        <div className="mt-4">
          <ErrorNote message={error} />
        </div>
      )}

      {/*
        Parolni tiklash oqimi YO'Q va bu ataylab: u email yuborishni
        talab qiladi, bunday infratuzilma esa loyihada mavjud emas.
        Ishlamaydigan tugma qo'yish o'rniga tirik odamning kontakti
        beriladi.
      */}
      <div className="mt-8 border-t border-neutral-200 pt-6">
        <p className="text-base leading-relaxed text-neutral-600">{t("resetHint")}</p>
        <div className="mt-2 -ml-3">
          <HelpLink />
        </div>
      </div>
    </Panel>
  );
}

/** Qaytarib bo'lmaydigan amal. */
function DangerPanel() {
  const t = useTranslations("settings.danger");
  const tCommon = useTranslations("common");
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function handleDelete() {
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      await apiRequest("/api/user/account", { method: "DELETE", body: { password } });
      // Hisob yo'q — bosh sahifaga.
      router.replace("/");
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        if (caught.fieldErrors) setFieldErrors(caught.fieldErrors);
        else setError(caught.message);
      } else {
        setError(tCommon("unexpectedError"));
      }
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <section>
      <h2 className="text-xl font-semibold text-danger-ink">{t("title")}</h2>

      <ToneCard tone="danger" className="mt-3">
        <p className="flex gap-3 text-base leading-relaxed text-danger-ink">
          <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
          <span>{t("warning")}</span>
        </p>

        <div className="mt-5 max-w-sm">
          <Input
            label={t("confirmLabel")}
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            errors={fieldErrors}
          />
        </div>

        {error !== null && (
          <div className="mt-4">
            <ErrorNote message={error} />
          </div>
        )}

        {/*
          Ikki qadamli tasdiq: parol + alohida savol. Qaytarib
          bo'lmaydigan amal uchun bitta bosish yetarli emas.
        */}
        {confirming ? (
          <div className="mt-5">
            <p className="text-base font-semibold text-danger-ink">
              {t("confirmQuestion")}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="danger" onClick={handleDelete} loading={busy}>
                {t("confirmYes")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={busy}
              >
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-5">
            <Button
              variant="danger"
              onClick={() => setConfirming(true)}
              disabled={password === ""}
              icon={<Trash2 aria-hidden className="size-5" />}
            >
              {t("action")}
            </Button>
          </div>
        )}
      </ToneCard>
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl font-semibold text-neutral-900">{title}</h2>
      <Card className="mt-3">{children}</Card>
    </section>
  );
}

function SavedNote({ text }: { text: string }) {
  return (
    <span aria-live="polite" className="flex items-center gap-2 text-base text-success">
      <Check aria-hidden className="size-5 shrink-0" />
      {text}
    </span>
  );
}

function ErrorNote({ message }: { message: string }) {
  return (
    <ToneCard tone="danger" padding="sm" role="alert">
      <p className="text-base leading-relaxed text-danger-ink">{message}</p>
    </ToneCard>
  );
}
