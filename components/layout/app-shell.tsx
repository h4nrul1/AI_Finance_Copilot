"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Bot,
  FileText,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  ReceiptText,
  RotateCcw,
  Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFinance } from "@/components/providers/finance-provider";
import { cn } from "@/lib/utils";

const nav = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/semester", label: "Semester Plan", icon: Settings2 },
  { href: "/spending", label: "Spending", icon: ReceiptText },
  { href: "/scenarios", label: "Scenario Lab", icon: LineChart },
  { href: "/aid", label: "Financial Aid", icon: FileText },
  { href: "/learn", label: "Learn", icon: BookOpen },
  { href: "/copilot", label: "Copilot", icon: Bot }
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { state, resetDemoData } = useFinance();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-line bg-white/90 px-4 py-4 backdrop-blur lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:border-b-0 lg:border-r lg:px-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-moss text-white">
            <GraduationCap size={22} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">SemesterFi</p>
            <p className="text-xs text-muted">{state.student.school}</p>
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
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted">Current student</p>
          <p className="mt-2 font-semibold text-ink">{state.student.name}</p>
          <p className="text-sm text-muted">
            {state.student.year} · {state.semester.name}
          </p>
          <Button variant="secondary" size="sm" className="mt-4 w-full" onClick={resetDemoData}>
            <RotateCcw size={15} />
            Reset Demo Data
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">{children}</main>
    </div>
  );
}
