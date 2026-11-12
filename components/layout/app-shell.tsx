"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AlertTriangle,
  Bot,
  Cloud,
  CloudOff,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  ReceiptText,
  RotateCcw,
  Settings2,
  TrendingUp,
  UserRound
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Welcome } from "@/components/onboarding/welcome";
import { useFinance } from "@/components/providers/finance-provider";
import { cn, formatDate } from "@/lib/utils";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/semester", label: "Semester Plan", icon: Settings2 },
  { href: "/spending", label: "Spending", icon: ReceiptText },
  { href: "/scenarios", label: "Scenario Lab", icon: LineChart },
  { href: "/invest", label: "Investing", icon: TrendingUp },
  { href: "/copilot", label: "Copilot", icon: Bot },
  { href: "/account", label: "Account", icon: UserRound }
];

/** Pages shown full-screen, without the sidebar and before any plan exists. */
const FULL_PAGE_PATHS = ["/setup", "/login", "/signup", "/forgot-password", "/auth"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state, status, startOver, user, accountsEnabled, guestChosen, signOut } = useFinance();
  const isDemo = state.mode !== "personal";
  const semesterOver = !isDemo && state.semester.currentDate > state.semester.endDate;
  const fullPage = FULL_PAGE_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  // Signed-out visitors start at the login page until they log in or choose to continue as a guest.
  const needsLogin = accountsEnabled && status !== "loading" && !user && !guestChosen && !fullPage;

  useEffect(() => {
    if (needsLogin) router.replace("/login");
  }, [needsLogin, router]);

  // Login and setup screens render on their own, even while the plan loads.
  if (fullPage) return <>{children}</>;
  // Nothing to show until the plan is read; avoids flashing demo numbers at a returning student.
  if (status === "loading" || needsLogin) return <div className="min-h-screen" />;
  if (status === "error") return <PlanLoadError onSignOut={signOut} />;
  if (status === "needs-setup") return <Welcome />;

  function confirmStartOver() {
    const message = isDemo
      ? "Leave the demo and go back to the start screen?"
      : user
        ? "Start over? This deletes the plan saved in your account and can't be undone."
        : "Start over? This deletes your plan from this browser and can't be undone.";
    if (window.confirm(message)) {
      startOver().catch(() => window.alert("Couldn't delete your plan. Check your connection and try again."));
    }
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-line bg-white/90 px-4 py-4 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-moss text-white">
            <GraduationCap size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">SemesterFi</p>
            <p className="text-xs text-muted">{state.student.school || "Semester planner"}</p>
          </div>
        </div>

        <nav className="mt-5 grid grid-cols-2 gap-2 lg:block lg:space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
                  active ? "bg-moss text-white" : "text-muted hover:bg-paper hover:text-ink"
                )}
              >
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-6 hidden rounded-lg border border-line bg-paper p-4 lg:block">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">{isDemo ? "Demo plan" : "Your plan"}</p>
          <p className="mt-2 font-semibold text-ink">{state.student.name || "You"}</p>
          <p className="text-sm text-muted">{state.semester.name}</p>
          <p className="mt-1 text-xs text-muted">
            {isDemo ? `Sample data · fixed date ${formatDate(state.semester.currentDate)}` : `Today is ${formatDate(state.semester.currentDate)}`}
          </p>
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={confirmStartOver}>
            <RotateCcw size={15} />
            {isDemo ? "Leave demo" : "Start over"}
          </Button>
        </div>

        {accountsEnabled ? <AccountStatus /> : null}
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
        {semesterOver ? (
          <div className="mx-auto mb-5 max-w-7xl rounded-lg border border-gold/50 bg-gold/10 p-4 text-sm text-ink">
            {state.semester.name} ended on {formatDate(state.semester.endDate)}. Update your semester dates on{" "}
            <Link href="/semester" className="font-semibold underline">
              Semester Plan
            </Link>{" "}
            to plan the next one.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}

function AccountStatus() {
  const { user, state, saveStatus } = useFinance();

  if (!user) {
    return (
      <div className="mt-3 hidden rounded-lg border border-line bg-white p-4 lg:block">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Guest</p>
        <p className="mt-1 text-sm text-ink">Saved in this browser only.</p>
        <div className="mt-3 flex gap-2">
          <Link href="/signup" className="flex-1">
            <Button size="sm" className="w-full">
              Sign up
            </Button>
          </Link>
          <Link href="/login" className="flex-1">
            <Button size="sm" variant="secondary" className="w-full">
              Log in
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const saving =
    state.mode !== "personal"
      ? { icon: CloudOff, text: "Demo isn't saved to your account" }
      : saveStatus === "saving"
        ? { icon: Cloud, text: "Saving..." }
        : saveStatus === "error"
          ? { icon: CloudOff, text: "Couldn't save. Check your connection." }
          : { icon: Cloud, text: "Saved to your account" };
  const Icon = saving.icon;

  return (
    <Link href="/account" className="mt-3 hidden rounded-lg border border-line bg-white p-4 transition hover:border-moss lg:block">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Signed in</p>
      <p className="mt-1 truncate text-sm font-medium text-ink">{user.email}</p>
      <p className={cn("mt-1 flex items-center gap-1.5 text-xs", saveStatus === "error" ? "text-coral" : "text-muted")}>
        <Icon size={13} />
        {saving.text}
      </p>
    </Link>
  );
}

function PlanLoadError({ onSignOut }: { onSignOut: () => Promise<void> }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md rounded-lg border border-line bg-white p-6 text-center shadow-soft">
        <AlertTriangle className="mx-auto text-coral" size={28} />
        <h1 className="mt-3 text-xl font-semibold text-ink">We couldn&apos;t load your plan</h1>
        <p className="mt-2 text-sm text-muted">Your saved plan is safe. Check your connection and try again.</p>
        <div className="mt-5 flex justify-center gap-3">
          <Button onClick={() => window.location.reload()}>Try again</Button>
          <Button variant="secondary" onClick={() => onSignOut()}>
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
}
