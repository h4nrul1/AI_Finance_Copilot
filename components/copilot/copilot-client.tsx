"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Bot, MessagesSquare, Plus, Send, Sparkles, Trash2, User, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import type { CopilotAnswer, CopilotToolCall } from "@/lib/ai/copilot";
import type { CopilotDetail } from "@/lib/ai/tool-registry";
import {
  chatTitle,
  deleteSessionChat,
  newChatId,
  readSessionChats,
  saveSessionChat,
  upsertChat,
  type ChatSummary,
  type SavedChat
} from "@/lib/ai/chat-history";
import { buildSuggestions } from "@/lib/ai/suggestions";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { deleteAccountChat, listAccountChats, loadAccountChat, saveAccountChat } from "@/lib/supabase/chat-store";
import { shouldSaveToAccount } from "@/lib/supabase/plan-store";
import { CopilotDetailCard } from "./detail-cards";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: CopilotToolCall[];
  details?: CopilotDetail[];
  mode?: "mock" | "openai";
}

const TOOL_LABELS: Record<string, string> = {
  get_semester_snapshot: "Semester snapshot",
  get_spending_by_category: "Spending by category",
  check_purchase: "Purchase check",
  find_max_affordable: "Spending limit",
  simulate_investment: "Investment simulation",
  simulate_income_loss: "Income-loss simulation",
  simulate_recurring_expense_change: "Recurring expense change"
};

const WELCOME: Message = {
  id: "welcome",
  role: "assistant",
  content:
    "Ask me about affordability, safe weekly spending, semester-end cash, spending categories, or beginner finance concepts. I use deterministic tools for calculations."
};

export function CopilotClient() {
  const { user, state } = useFinance();
  // Signed-in students with their own plan keep chats in their account; guests and the demo keep them for the tab.
  const accountUserId = user && getBrowserSupabase() && shouldSaveToAccount(state) ? user.id : null;
  const owner = user?.id ?? "guest";
  // Keyed so switching accounts (or storage) starts from that student's own chats, never the previous one's.
  return <CopilotChat key={`${owner}:${accountUserId ? "account" : "session"}`} owner={owner} accountUserId={accountUserId} />;
}

/** "loading" while a signed-in student's chats are fetched; "unavailable" if they couldn't be (nothing is saved then). */
type ChatStatus = "loading" | "ready" | "unavailable";

function formatChatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function CopilotChat({ owner, accountUserId }: { owner: string; accountUserId: string | null }) {
  const { state, projection } = useFinance();
  const params = useSearchParams();
  const initialQuestion = params.get("question");
  const [input, setInput] = useState(initialQuestion ?? "");
  const [loading, setLoading] = useState(false);
  // The app shell only renders this page after the plan has loaded in the browser, so session storage is readable here.
  const [sessionStart] = useState(() => (accountUserId ? [] : readSessionChats<Message>(owner)));
  const [chats, setChats] = useState<ChatSummary[]>(() => sessionStart.map(({ id, title, updatedAt }) => ({ id, title, updatedAt })));
  // The open chat; null is a new chat that isn't saved until its first question.
  const [activeId, setActiveId] = useState<string | null>(sessionStart[0]?.id ?? null);
  const [messages, setMessages] = useState<Message[]>(sessionStart[0]?.messages ?? [WELCOME]);
  const [chatStatus, setChatStatus] = useState<ChatStatus>(accountUserId ? "loading" : "ready");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The open chat as of now, so an answer that arrives after the student left this page still lands in its chat.
  const activeRef = useRef<{ id: string | null; messages: Message[] }>({ id: activeId, messages });
  const mountedRef = useRef(true);
  const suggestions = useMemo(() => buildSuggestions(state, projection), [state, projection]);
  const busy = loading || chatStatus === "loading" || openingId !== null;

  const disclaimer = useMemo(
    () => "Educational financial planning tool. Not professional financial, investment, tax, or legal advice.",
    []
  );

  useEffect(() => {
    if (initialQuestion) setInput(initialQuestion);
  }, [initialQuestion]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function show(id: string | null, next: Message[]) {
    activeRef.current = { id, messages: next };
    setActiveId(id);
    setMessages(next);
  }

  // Signed in: list the student's chats and reopen the most recent one.
  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!accountUserId || !supabase) return;
    let cancelled = false;
    (async () => {
      const list = await listAccountChats(supabase, accountUserId);
      const latest = list[0] ? await loadAccountChat<Message>(supabase, accountUserId, list[0].id) : null;
      if (cancelled) return;
      setChats(list);
      if (latest) show(list[0].id, latest);
      setChatStatus("ready");
    })().catch((error) => {
      console.error("[account] Couldn't load the copilot chats:", error);
      // Not saving from here on, so a temporary error can never overwrite chats already in the account.
      if (!cancelled) setChatStatus("unavailable");
    });
    return () => {
      cancelled = true;
    };
  }, [accountUserId]);

  /** Saves one chat: to the account when signed in, otherwise to this tab. */
  function persist(id: string, next: Message[], mounted: boolean) {
    const chat: SavedChat<Message> = { id, title: chatTitle(next), updatedAt: new Date().toISOString(), messages: next };
    if (mounted) setChats((current) => upsertChat(current, { id: chat.id, title: chat.title, updatedAt: chat.updatedAt }));
    if (!accountUserId) {
      saveSessionChat(owner, chat);
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase || chatStatus !== "ready") return;
    saveAccountChat(supabase, accountUserId, chat)
      .then(() => mounted && mountedRef.current && setNotice(null))
      .catch((error) => {
        console.error("[account] Couldn't save the copilot chat:", error);
        if (mountedRef.current) setNotice("Couldn't save the latest messages to your account.");
      });
  }

  function newChat() {
    if (busy) return;
    show(null, [WELCOME]);
  }

  async function openChat(id: string) {
    if (busy || id === activeId) return;
    if (!accountUserId) {
      const chat = readSessionChats<Message>(owner).find((saved) => saved.id === id);
      if (chat) show(chat.id, chat.messages);
      return;
    }
    const supabase = getBrowserSupabase();
    if (!supabase) return;
    setOpeningId(id);
    try {
      const saved = await loadAccountChat<Message>(supabase, accountUserId, id);
      if (!mountedRef.current) return;
      if (saved) {
        show(id, saved);
        setNotice(null);
      } else {
        // Deleted somewhere else (another device).
        setChats((current) => current.filter((chat) => chat.id !== id));
      }
    } catch (error) {
      console.error("[account] Couldn't open the copilot chat:", error);
      if (mountedRef.current) setNotice("Couldn't open that chat. Please try again.");
    } finally {
      if (mountedRef.current) setOpeningId(null);
    }
  }

  async function removeChat(id: string) {
    if (busy) return;
    const supabase = getBrowserSupabase();
    try {
      if (!accountUserId) deleteSessionChat(owner, id);
      else if (supabase) await deleteAccountChat(supabase, accountUserId, id);
    } catch (error) {
      console.error("[account] Couldn't delete the copilot chat:", error);
      if (mountedRef.current) setNotice("Couldn't delete that chat. Please try again.");
      return;
    }
    if (!mountedRef.current) return;
    setChats((current) => current.filter((chat) => chat.id !== id));
    if (activeRef.current.id === id) show(null, [WELCOME]);
  }

  async function ask(question = input) {
    if (!question.trim() || busy) return;
    setInput("");
    setLoading(true);
    const chatId = activeRef.current.id ?? newChatId();
    const before = activeRef.current.messages;
    const userMessage: Message = { id: `u-${Date.now()}`, role: "user", content: question };
    // Prior turns, plus which tools ran with what inputs, let the model resolve follow-ups like "what about $300 instead?".
    const history = before
      .filter((message) => message.id !== "welcome")
      .map(({ role, content, toolCalls }) => ({
        role,
        content: toolCalls?.length
          ? `${content}\n[Tools used: ${toolCalls.map((call) => `${call.name} ${JSON.stringify(call.input)}`).join("; ")}]`
          : content
      }));
    const asked = [...before, userMessage];
    show(chatId, asked);
    persist(chatId, asked, true);

    let reply: Message;
    try {
      const response = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question, state, history })
      });
      const answer = (await response.json()) as CopilotAnswer;
      reply = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: answer.message,
        toolCalls: answer.toolCalls,
        details: answer.details,
        mode: answer.mode
      };
    } catch {
      reply = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "I could not reach the copilot endpoint. The deterministic app pages still work locally.",
        mode: "mock"
      };
    }
    const answered = [...asked, reply];
    const mounted = mountedRef.current;
    // Switching chats is blocked while an answer is pending, so this chat is still the open one.
    if (mounted) show(chatId, answered);
    persist(chatId, answered, mounted);
    if (mounted) setLoading(false);
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
                  {message.details?.map((detail, index) => (
                    <div key={`${detail.kind}-${index}`} className="mt-3">
                      <CopilotDetailCard detail={detail} />
                    </div>
                  ))}
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
          {chatStatus === "loading" ? (
            <p className="border-t border-line px-4 py-2 text-xs text-muted">Loading your saved chats...</p>
          ) : chatStatus === "unavailable" ? (
            <p className="border-t border-line px-4 py-2 text-xs text-coral">
              Couldn&apos;t load your saved chats, so this conversation won&apos;t be saved to your account. Reload the page to try again.
            </p>
          ) : notice ? (
            <p className="border-t border-line px-4 py-2 text-xs text-coral">{notice}</p>
          ) : null}
          <form
            className="border-t border-line p-4"
            onSubmit={(event) => {
              event.preventDefault();
              ask();
            }}
          >
            <div className="flex gap-3">
              <Input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about a purchase, weekly spending, ETF, APR..." />
              <Button type="submit" disabled={busy}>
                <Send size={16} />
                Send
              </Button>
            </div>
          </form>
        </Card>

        <aside className="space-y-3">
          <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <MessagesSquare size={17} className="text-moss" />
                <p className="font-semibold text-ink">Your chats</p>
              </div>
              <button
                onClick={newChat}
                disabled={busy || activeId === null}
                className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold text-muted transition hover:border-moss hover:text-ink disabled:opacity-50"
              >
                <Plus size={13} />
                New chat
              </button>
            </div>
            <div className="max-h-72 space-y-1 overflow-y-auto">
              {activeId === null ? (
                <div className="rounded-md bg-paper px-3 py-2 text-sm font-semibold text-ink">New chat</div>
              ) : null}
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  className={`group flex items-center gap-1 rounded-md ${chat.id === activeId ? "bg-paper" : "hover:bg-paper"}`}
                >
                  <button
                    onClick={() => openChat(chat.id)}
                    disabled={busy && chat.id !== activeId}
                    aria-current={chat.id === activeId ? "true" : undefined}
                    className="min-w-0 flex-1 px-3 py-2 text-left disabled:opacity-60"
                  >
                    <span className={`block truncate text-sm ${chat.id === activeId ? "font-semibold text-ink" : "text-muted"}`}>
                      {openingId === chat.id ? "Opening..." : chat.title}
                    </span>
                    <span className="block text-xs text-muted">{formatChatDate(chat.updatedAt)}</span>
                  </button>
                  <button
                    onClick={() => removeChat(chat.id)}
                    disabled={busy}
                    aria-label={`Delete chat: ${chat.title}`}
                    title="Delete chat"
                    className="mr-1 rounded p-1 text-muted opacity-60 transition hover:text-coral group-hover:opacity-100 disabled:opacity-30"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {chats.length === 0 && activeId === null ? (
                <p className="px-3 pt-1 text-xs text-muted">Your earlier chats will appear here.</p>
              ) : null}
            </div>
          </div>
          <div className="rounded-lg border border-line bg-white p-4 shadow-soft">
            <div className="mb-3 flex items-center gap-2">
              <Sparkles size={17} className="text-gold" />
              <p className="font-semibold text-ink">Try asking</p>
            </div>
            <div className="space-y-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => ask(suggestion)}
                  disabled={busy}
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
