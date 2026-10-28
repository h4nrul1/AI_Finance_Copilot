/**
 * Supabase settings. Accounts are optional: without these variables the app runs in guest-only mode
 * (plans saved in the browser), so teammates can work on it without a Supabase project.
 */
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !key) return null;
  if (!isHttpUrl(url)) {
    // A typo here would otherwise crash every page; fall back to guest-only mode and say why.
    warnOnce(`NEXT_PUBLIC_SUPABASE_URL isn't a valid https:// URL, so accounts are turned off. It should look like https://<project-id>.supabase.co`);
    return null;
  }
  return { url, key };
}

function isHttpUrl(value: string) {
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

let warned = false;
function warnOnce(message: string) {
  if (warned) return;
  warned = true;
  console.error(`[accounts] ${message}`);
}

export const PLANS_TABLE = "plans";

/** Only allow redirects to pages on this site ("/semester"), never to other sites ("//evil.com", "https://..."). */
export function safeRedirectPath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\") ? value : "/";
}
