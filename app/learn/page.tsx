"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const lessons = [
  {
    title: "Budgeting",
    body: "A student budget should follow the semester calendar. Start with cash, add guaranteed income, subtract required expenses, then decide what weekly discretionary spending fits."
  },
  {
    title: "Credit Cards",
    body: "Credit cards can help build credit, but interest can pile up when you carry a balance. Paying the full statement balance is the cleanest habit."
  },
  {
    title: "Student Loans",
    body: "Loans are borrowed money. They can help cover school costs, but they are different from grants because repayment is expected after school or after a grace period."
  },
  {
    title: "Financial Aid",
    body: "Aid offers mix grants, scholarships, loans, work-study, and estimated costs. Free aid reduces cost; loans and work-study need separate treatment."
  },
  {
    title: "Emergency Funds",
    body: "An emergency fund is cash for surprises. In college, even a modest buffer can prevent one car repair or medical bill from derailing the semester."
  },
  {
    title: "Investing Basics",
    body: "Investing means accepting risk for possible long-term growth. Money needed for near-term rent, food, or tuition usually belongs in cash, not volatile assets."
  },
  {
    title: "ETFs",
    body: "An ETF is a fund that trades like a stock and can hold many investments. Broad ETFs are often used to learn diversification."
  },
  {
    title: "Diversification",
    body: "Diversification means spreading risk across different investments or categories. It helps avoid depending on one outcome."
  },
  {
    title: "Interest and APR",
    body: "APR is the yearly cost of borrowing. For credit cards, unpaid balances can become expensive because interest can compound."
  }
];

export default function LearnPage() {
  const [active, setActive] = useState(lessons[0]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">Learn</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Beginner finance lessons tied to student decisions.</h1>
      </header>

      <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {lessons.map((lesson) => (
            <button
              key={lesson.title}
              onClick={() => setActive(lesson)}
              className="rounded-lg border border-line bg-white p-4 text-left shadow-soft transition hover:border-moss"
            >
              <p className="font-semibold text-ink">{lesson.title}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted">{lesson.body}</p>
            </button>
          ))}
        </div>

        <Card className="min-h-[360px]">
          <CardHeader title={active.title} eyebrow="Short lesson" />
          <p className="text-lg leading-8 text-ink">{active.body}</p>
          <div className="mt-6 rounded-lg bg-paper p-4">
            <p className="text-sm font-semibold text-ink">How this relates to Hanru</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              SemesterFi connects the concept to cash timing, required expenses, safe weekly spending, and the semester-end
              buffer instead of giving generic advice.
            </p>
          </div>
          <Link href={`/copilot?question=${encodeURIComponent(`What is ${active.title}?`)}`}>
            <Button className="mt-5" variant="secondary">
              Ask Copilot about this
              <ArrowRight size={16} />
            </Button>
          </Link>
        </Card>
      </section>
    </div>
  );
}
