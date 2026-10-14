"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, Send, Sparkles, User, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import { VerdictCard } from "@/components/scenarios/verdict-card";
import type { CopilotAnswer, CopilotToolCall } from "@/lib/ai/copilot";
import type { ScenarioSummary } from "@/types/finance";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: CopilotToolCall[];
  scenario?: ScenarioSummary;
  mode?: "mock" | "openai";
}

const TOOL_LABELS: Record<string, string> = {
  get_semester_snapshot: "Semester snapshot",
  get_spending_by_category: "Spending by category",
  check_purchase: "Purchase check",
  simulate_investment: "Investment simulation",
  simulate_income_loss: "Income-loss simulation",
  simulate_recurring_expense_change: "Recurring expense change"
};

const suggestions = [
  "Can I afford a $500 trip in November?",
  "Can I afford a new laptop?",
  "Can I afford a $3,000 trip in December?",
  "How much can I safely spend each week?",
  "What happens if I stop working in October?",
  "Where am I spending the most money?",
  "What happens if I invest $300?",
  "What is an ETF?",
  "What is APR?"
];

export function CopilotClient() {
  const { state } = useFinance();
  const params = useSearchParams();
  const initialQuestion = params.get("question");
  const [input, setInput] = useState(initialQuestion ?? "");
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Ask me about affordability, safe weekly spending, semester-end cash, spending categories, or beginner finance concepts. I use deterministic tools for calculations."
    }
  ]);

  const disclaimer = useMemo(
    () => "Educational financial planning tool. Not professional financial, investment, tax, or legal advice.",
    []
  );

  useEffect(() => {
    if (initialQuestion) setInput(initialQuestion);
  }, [initialQuestion]);

  async function ask(question = input) {
    if (!question.trim()) return;
    setInput("");
    setLoading(true);
    const userMessage: Message = { id: `u-${Date.now()}`, role: "user", content: question };
    // Prior turns let the model resolve follow-ups like "what about $300 instead?".
    const history = messages
      .filter((message) => message.id !== "welcome")
      .map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, userMessage]);

    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, state, history })
      });
      const answer = (await response.json()) as CopilotAnswer;
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: answer.message,
          toolCalls: answer.toolCalls,
          scenario: answer.scenario,
          mode: answer.mode
        }
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: "I could not reach the copilot endpoint. The deterministic app pages still work locally.",
          mode: "mock"
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-5">
      <header>
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-muted">AI Copilot</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Ask forward-looking money questions.</h1>
        <p className="mt-2 text-sm text-muted">{disclaimer}</p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <Card className="flex min-h-[620px] flex-col p-0">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className={`max-w-[82%] rounded-lg p-4 ${message.role === "user" ? "bg-moss text-white" : "bg-paper text-ink"}`}>
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.10em] opacity-80">
                    {message.role === "user" ? <User size={14} /> : <Bot size={14} />}
                    {message.role === "user" ? "You" : `Copilot${message.mode === "openai" ? " · OpenAI" : message.mode === "mock" ? " · Mock" : ""}`}
                  </div>
                  <p className="whitespace-pre-wrap text-sm leading-6">{message.content}</p>
                  {message.scenario ? (
                    <VerdictCard className="mt-3" verdict={message.scenario.verdict} summary={message.scenario} />
                  ) : null}
                  {message.toolCalls?.length ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {message.toolCalls.map((call, index) => (
                        <span
                          key={`${call.name}-${index}`}
                          title={JSON.stringify(call.input)}
                          className={`inline-flex items-center gap-1 rounded-md bg-white/70 px-2 py-1 text-xs font-semibold ${call.ok ? "text-moss" : "text-coral"}`}
                        >
                          <Wrench size={12} />
                          {TOOL_LABELS[call.name] ?? call.name}
                          {call.ok ? "" : " (invalid input)"}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex justify-start">
                <div className="rounded-lg bg-paper px-4 py-3 text-sm text-muted">Running the numbers...</div>
              </div>
            ) : null}
          </div>
          <form
            className="border-t border-line p-4"
            onSubmit={(event) => {
              event.preventDefault();
              ask();
            }}
          >
            <div className="flex gap-3">
              <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about a purchase, weekly spending, ETF, APR..." />
              <Button type="submit" disabled={loading}>
                <Send size={16} />
                Send
              </Button>
            </div>
          </form>
        </Card>

        <aside className="space-y-3">
          <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={17} className="text-gold" />
              <p className="font-semibold text-ink">Demo prompts</p>
            </div>
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => ask(suggestion)}
                  className="w-full rounded-md border border-line bg-paper px-3 py-2 text-left text-sm text-muted transition hover:border-moss hover:text-ink"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
