"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

let client: SupabaseClient | null | undefined;

/** One shared browser client, or null when accounts aren't configured. */
export function getBrowserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const config = supabaseConfig();
  client = config ? createBrowserClient(config.url, config.key) : null;
  return client;
}
