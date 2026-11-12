/**
 * A student's copilot chats. Signed-in students keep them in their account (lib/supabase/chat-store.ts); guests and
 * the demo keep them for the browser session (survives page switches and reloads, cleared when the tab closes).
 */

/** Older messages in a chat are dropped past this, so storage never fills up. */
export const MAX_SAVED_MESSAGES = 60;
/** How many past chats are listed (most recent first). */
export const MAX_LISTED_CHATS = 30;
const TITLE_LENGTH = 60;

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export interface SavedChat<T> extends ChatSummary {
  messages: T[];
}

/** A chat is named after its first question. */
export function chatTitle(messages: { role: string; content: string }[]) {
  const first = messages.find((message) => message.role === "user")?.content.trim().replace(/\s+/g, " ") ?? "";
  if (!first) return "New chat";
  return first.length > TITLE_LENGTH ? `${first.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : first;
}

/** Adds or replaces a chat, keeping the list most-recent first and within the limit. */
export function upsertChat<T extends ChatSummary>(chats: T[], chat: T): T[] {
  return [chat, ...chats.filter((existing) => existing.id !== chat.id)]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, MAX_LISTED_CHATS);
}

export function newChatId() {
  try {
    return crypto.randomUUID();
  } catch {
    // randomUUID needs a secure context; the id only has to be unique among this student's chats.
    return `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}

// ---------------------------------------------------------------------------
// Session storage, for guests and the demo. Tagged with an owner so a different account never sees these chats.
// ---------------------------------------------------------------------------

const SESSION_KEY = "semesterfi-copilot-chats";

interface SessionChats<T> {
  owner: string;
  chats: SavedChat<T>[];
}

export function readSessionChats<T>(owner: string): SavedChat<T>[] {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    const saved = raw ? (JSON.parse(raw) as SessionChats<T>) : null;
    return saved && saved.owner === owner && Array.isArray(saved.chats) ? saved.chats : [];
  } catch {
    return [];
  }
}

function writeSessionChats<T>(owner: string, chats: SavedChat<T>[]) {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify({ owner, chats } satisfies SessionChats<T>));
  } catch {
    // Storage can be unavailable (private mode, full quota); the chat still works until the page changes.
  }
}

/** Re-reads before writing, so an answer saved after the student left the page doesn't drop newer chats. */
export function saveSessionChat<T>(owner: string, chat: SavedChat<T>) {
  const trimmed = { ...chat, messages: chat.messages.slice(-MAX_SAVED_MESSAGES) };
  writeSessionChats(owner, upsertChat(readSessionChats<T>(owner), trimmed));
}

export function deleteSessionChat(owner: string, id: string) {
  writeSessionChats(owner, readSessionChats(owner).filter((chat) => chat.id !== id));
}

export function clearSessionChats() {
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing saved to remove.
  }
}
