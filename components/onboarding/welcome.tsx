"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, GraduationCap, PlayCircle, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import { createBlankPlan, guessSemester } from "@/lib/data/blank-plan";
import { localToday } from "@/lib/finance/dates";
import { formatDate } from "@/lib/utils";

/** First-visit screen: try the sample plan, or start a personal plan that uses today's date. */
export function Welcome() {
  const { startDemo, startPlan } = useFinance();
  const router = useRouter();
  const [name, setName] = useState("");
  const today = localToday();
  const semester = guessSemester(today);

  function startFresh() {
    startPlan(createBlankPlan(today, name));
    router.push("/semester");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-moss text-white">
            <GraduationCap size={22} />
          </div>
          <p className="text-lg font-semibold text-ink">SemesterFi</p>
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-ink">See what you can actually afford this semester.</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Plan around tuition, aid, paychecks, and rent from now until finals, and ask the copilot before you spend.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="flex flex-col rounded-lg border border-line bg-white p-5 shadow-soft">
            <Sparkles className="text-moss" size={22} />
            <h2 className="mt-3 text-lg font-semibold text-ink">Start my own plan</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Uses today&apos;s date ({formatDate(today)}) and starts you on {semester.name}. You&apos;ll add your cash, income, and
              expenses next.
            </p>
            <div className="mt-4">
              <Label htmlFor="welcome-name">First name (optional)</Label>
              <Input id="welcome-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Jordan" />
            </div>
            <Button className="mt-4" onClick={startFresh}>
              Start fresh
              <ArrowRight size={16} />
            </Button>
          </section>

          <section className="flex flex-col rounded-lg border border-line bg-white p-5 shadow-soft">
            <PlayCircle className="text-blue" size={22} />
            <h2 className="mt-3 text-lg font-semibold text-ink">Explore the demo</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Look around with a sample student&apos;s Fall 2026 semester. The demo uses a fixed date (Sep 29) so its numbers stay the same.
            </p>
            <Button className="mt-auto" variant="secondary" onClick={startDemo}>
              Try the demo
            </Button>
          </section>
        </div>

        <p className="mt-6 text-xs text-muted">
          Your plan is saved only in this browser. Educational planning tool, not professional financial advice.
        </p>
      </div>
    </div>
  );
}
