import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";
import { createServerSupabase } from "@/lib/supabase/server";

/**
 * Permanently deletes the signed-in student's account. Their plan is removed with it (the plans table cascades
 * on delete). Deleting a login needs Supabase's service-role key, which must only ever exist on the server.
 */
export async function POST() {
  const supabase = await createServerSupabase();
  const config = supabaseConfig();
  if (!supabase || !config) return NextResponse.json({ error: "Accounts aren't set up." }, { status: 404 });

  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "You're not logged in." }, { status: 401 });

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json({ error: "Account deletion isn't configured on this server yet." }, { status: 501 });
  }

  const admin = createClient(config.url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    console.error("[account] Couldn't delete the account:", error.message);
    return NextResponse.json({ error: "Couldn't delete your account. Please try again." }, { status: 500 });
  }

  await supabase.auth.signOut();
  return NextResponse.json({ deleted: true });
}
