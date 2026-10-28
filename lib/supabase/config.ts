/**
 * Supabase settings. Accounts are optional: without these variables the app runs in guest-only mode
 * (plans saved in the browser), so teammates can work on it without a Supabase project.
 */
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? { url, key } : null;
}

export const PLANS_TABLE = "plans";

/** Only allow redirects to pages on this site ("/semester"), never to other sites ("//evil.com", "https://..."). */
export function safeRedirectPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}
