import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

/**
 * A Supabase client for route handlers, acting as the signed-in student (their cookies), so row-level security
 * applies. Create a new one per request. Returns null when accounts aren't configured.
 */
export async function createServerSupabase(): Promise<SupabaseClient | null> {
  const config = supabaseConfig();
  if (!config) return null;
  const cookieStore = await cookies();

  return createServerClient(config.url, config.key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from somewhere cookies can't be written; the proxy refreshes the session instead.
        }
      }
    }
  });
}
