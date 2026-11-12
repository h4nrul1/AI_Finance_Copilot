"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { useFinance } from "@/components/providers/finance-provider";

/** Full-page layout for login, sign-up, and password screens. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  const { accountsEnabled } = useFinance();

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-moss text-white">
            <GraduationCap size={20} />
          </div>
          <p className="text-lg font-semibold text-ink">SemesterFi</p>
        </Link>
        <div className="mt-6 rounded-lg border border-line bg-white p-6 shadow-soft">
          <h1 className="text-2xl font-semibold text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-5">
            {accountsEnabled ? (
              children
            ) : (
              <p className="rounded-md bg-paper px-3 py-2 text-sm text-ink">
                Accounts aren&apos;t set up on this server yet. You can still use SemesterFi as a guest; your plan is saved in this browser.
              </p>
            )}
          </div>
        </div>
        {footer ? <div className="mt-4 text-center text-sm text-muted">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Lets a visitor skip the account and use SemesterFi with a plan saved in this browser. */
export function ContinueAsGuest() {
  const { continueAsGuest } = useFinance();
  const router = useRouter();

  return (
    <button
      type="button"
      className="underline hover:text-ink"
      onClick={() => {
        continueAsGuest();
        router.push("/");
      }}
    >
      continue as a guest
    </button>
  );
}

export function FormMessage({ tone, children }: { tone: "error" | "info"; children: React.ReactNode }) {
  return (
    <p className={tone === "error" ? "rounded-md border border-coral/40 bg-coral/10 px-3 py-2 text-sm text-ink" : "rounded-md bg-paper px-3 py-2 text-sm text-ink"}>
      {children}
    </p>
  );
}

/** Turns Supabase's error messages into plain language. */
export function friendlyAuthError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("invalid login credentials")) return "Email or password is incorrect.";
  if (text.includes("email not confirmed")) return "Please confirm your email first. Check your inbox for the link we sent.";
  if (text.includes("already registered") || text.includes("already been registered")) return "An account with this email already exists. Try logging in.";
  if (text.includes("password should be") || text.includes("weak")) return "Please choose a stronger password (at least 8 characters).";
  if (text.includes("rate limit") || text.includes("too many")) return "Too many attempts. Please wait a minute and try again.";
  return message;
}

export const MIN_PASSWORD_LENGTH = 8;
