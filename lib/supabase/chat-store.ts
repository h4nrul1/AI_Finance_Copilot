import type { SupabaseClient } from "@supabase/supabase-js";
import { MAX_LISTED_CHATS, MAX_SAVED_MESSAGES, type ChatSummary, type SavedChat } from "@/lib/ai/chat-history";
import { CHATS_TABLE } from "./config";

interface ChatRow {
  id: string;
  title: string;
  updated_at: string;
  messages?: unknown;
}

/** The student's chats, most recent first, without their messages (those load when a chat is opened). */
export async function listAccountChats(supabase: SupabaseClient, userId: string): Promise<ChatSummary[]> {
  const { data, error } = await supabase
    .from(CHATS_TABLE)
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(MAX_LISTED_CHATS);
  if (error) throw error;
  return ((data ?? []) as ChatRow[]).map((row) => ({ id: row.id, title: row.title, updatedAt: row.updated_at }));
}

/** One chat's messages, or null if it no longer exists. */
export async function loadAccountChat<T>(supabase: SupabaseClient, userId: string, chatId: string): Promise<T[] | null> {
  const { data, error } = await supabase.from(CHATS_TABLE).select("messages").eq("user_id", userId).eq("id", chatId).maybeSingle();
  if (error) throw error;
  const messages = (data as ChatRow | null)?.messages;
  return Array.isArray(messages) ? (messages as T[]) : null;
}

export async function saveAccountChat<T>(supabase: SupabaseClient, userId: string, chat: SavedChat<T>) {
  const { error } = await supabase.from(CHATS_TABLE).upsert(
    {
      id: chat.id,
      user_id: userId,
      title: chat.title,
      messages: chat.messages.slice(-MAX_SAVED_MESSAGES),
      updated_at: chat.updatedAt
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function deleteAccountChat(supabase: SupabaseClient, userId: string, chatId: string) {
  const { error } = await supabase.from(CHATS_TABLE).delete().eq("user_id", userId).eq("id", chatId);
  if (error) throw error;
}

export async function deleteAllAccountChats(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.from(CHATS_TABLE).delete().eq("user_id", userId);
  if (error) throw error;
}
