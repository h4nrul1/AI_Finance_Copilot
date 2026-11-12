import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MAX_LISTED_CHATS,
  MAX_SAVED_MESSAGES,
  chatTitle,
  clearSessionChats,
  deleteSessionChat,
  readSessionChats,
  saveSessionChat,
  upsertChat
} from "@/lib/ai/chat-history";
import { deleteAccountChat, deleteAllAccountChats, listAccountChats, loadAccountChat, saveAccountChat } from "@/lib/supabase/chat-store";

/** A stand-in for the Supabase query builder: records every call and resolves to a fixed result when awaited. */
function fakeSupabase(result: { data?: unknown; error?: unknown }) {
  const calls: { method: string; args: unknown[] }[] = [];
  const query: Record<string, unknown> = {
    then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => Promise.resolve(result).then(resolve, reject)
  };
  for (const method of ["from", "select", "eq", "order", "limit", "upsert", "delete"]) {
    query[method] = (...args: unknown[]) => {
      calls.push({ method, args });
      return query;
    };
  }
  query.maybeSingle = () => Promise.resolve(result);
  return { client: query as unknown as SupabaseClient, calls };
}

const message = (id: string, role: "user" | "assistant", content = id) => ({ id, role, content });

describe("chat titles and lists", () => {
  it("names a chat after its first question", () => {
    expect(chatTitle([message("welcome", "assistant", "Hi"), message("u", "user", "  Can I afford\n a trip? ")])).toBe("Can I afford a trip?");
    expect(chatTitle([message("welcome", "assistant")])).toBe("New chat");
    const long = chatTitle([message("u", "user", "x".repeat(100))]);
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith("…")).toBe(true);
  });

  it("keeps the list most recent first, without duplicates, within the limit", () => {
    let list = [
      { id: "a", title: "A", updatedAt: "2026-11-01T00:00:00Z" },
      { id: "b", title: "B", updatedAt: "2026-11-02T00:00:00Z" }
    ];
    list = upsertChat(list, { id: "a", title: "A2", updatedAt: "2026-11-03T00:00:00Z" });
    expect(list.map((chat) => chat.id)).toEqual(["a", "b"]);
    expect(list[0].title).toBe("A2");

    for (let index = 0; index < MAX_LISTED_CHATS + 5; index += 1) {
      list = upsertChat(list, { id: `c${index}`, title: "C", updatedAt: `2026-12-01T00:00:${String(index).padStart(2, "0")}Z` });
    }
    expect(list).toHaveLength(MAX_LISTED_CHATS);
  });
});

describe("chats kept for the browser session", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key)
      }
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("keeps several chats and lets one be deleted", () => {
    saveSessionChat("guest", { id: "one", title: "One", updatedAt: "2026-11-01T00:00:00Z", messages: [message("u1", "user")] });
    saveSessionChat("guest", { id: "two", title: "Two", updatedAt: "2026-11-02T00:00:00Z", messages: [message("u2", "user")] });
    expect(readSessionChats("guest").map((chat) => chat.id)).toEqual(["two", "one"]);

    deleteSessionChat("guest", "two");
    expect(readSessionChats("guest").map((chat) => chat.id)).toEqual(["one"]);

    clearSessionChats();
    expect(readSessionChats("guest")).toEqual([]);
  });

  it("never shows one person's chats to someone else in the same tab", () => {
    saveSessionChat("student-1", { id: "one", title: "One", updatedAt: "2026-11-01T00:00:00Z", messages: [] });
    expect(readSessionChats("guest")).toEqual([]);
  });

  it("saves only a chat's most recent messages", () => {
    const messages = Array.from({ length: MAX_SAVED_MESSAGES + 5 }, (_, index) => message(`m-${index}`, "user"));
    saveSessionChat("guest", { id: "one", title: "One", updatedAt: "2026-11-01T00:00:00Z", messages });
    expect(readSessionChats("guest")[0].messages).toHaveLength(MAX_SAVED_MESSAGES);
  });
});

describe("chats saved to an account", () => {
  it("lists the student's own chats, newest first", async () => {
    const { client, calls } = fakeSupabase({ data: [{ id: "c1", title: "Trip?", updated_at: "2026-11-02T00:00:00Z" }], error: null });
    expect(await listAccountChats(client, "student-1")).toEqual([{ id: "c1", title: "Trip?", updatedAt: "2026-11-02T00:00:00Z" }]);
    expect(calls).toContainEqual({ method: "from", args: ["copilot_chats"] });
    expect(calls).toContainEqual({ method: "eq", args: ["user_id", "student-1"] });
    expect(calls).toContainEqual({ method: "order", args: ["updated_at", { ascending: false }] });
    // The list never downloads every chat's messages.
    expect(calls.find((call) => call.method === "select")?.args[0]).not.toContain("messages");
  });

  it("opens one chat, or reports that it no longer exists", async () => {
    const messages = [message("u", "user")];
    expect(await loadAccountChat(fakeSupabase({ data: { messages }, error: null }).client, "student-1", "c1")).toEqual(messages);
    expect(await loadAccountChat(fakeSupabase({ data: null, error: null }).client, "student-1", "c1")).toBeNull();
  });

  it("reports errors instead of pretending there are no chats", async () => {
    await expect(listAccountChats(fakeSupabase({ data: null, error: new Error("table missing") }).client, "student-1")).rejects.toThrow(
      "table missing"
    );
  });

  it("saves each chat as its own row, with only its most recent messages", async () => {
    const { client, calls } = fakeSupabase({ error: null });
    const messages = Array.from({ length: MAX_SAVED_MESSAGES + 5 }, (_, index) => message(`m-${index}`, "user"));
    await saveAccountChat(client, "student-1", { id: "c1", title: "T", updatedAt: "2026-11-02T00:00:00Z", messages });
    const upsert = calls.find((call) => call.method === "upsert")!;
    const row = upsert.args[0] as { id: string; user_id: string; messages: { id: string }[] };
    expect(row.id).toBe("c1");
    expect(row.user_id).toBe("student-1");
    expect(row.messages).toHaveLength(MAX_SAVED_MESSAGES);
    expect(row.messages[0].id).toBe("m-5");
    expect(upsert.args[1]).toEqual({ onConflict: "id" });
  });

  it("deletes one chat, or all of a student's chats", async () => {
    const one = fakeSupabase({ error: null });
    await deleteAccountChat(one.client, "student-1", "c1");
    expect(one.calls.filter((call) => call.method === "eq").map((call) => call.args)).toEqual([
      ["user_id", "student-1"],
      ["id", "c1"]
    ]);

    const all = fakeSupabase({ error: null });
    await deleteAllAccountChats(all.client, "student-1");
    expect(all.calls.filter((call) => call.method === "eq").map((call) => call.args)).toEqual([["user_id", "student-1"]]);
  });
});
