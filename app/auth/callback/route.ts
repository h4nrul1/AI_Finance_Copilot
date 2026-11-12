import { NextResponse } from "next/server";
import { safeRedirectPath } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Email links (confirm account, reset password) land here with a one-time code. Exchanging it signs the student
 * in by setting session cookies, then we send them on to `next`.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeRedirectPath(url.searchParams.get("next"));

  const supabase = await createServerSupabase();
  if (code && supabase) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
    console.error("[auth] Couldn't exchange the email link code:", error.message);
  }
  return NextResponse.redirect(new URL("/login?link=expired", url.origin));
}
