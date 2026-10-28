import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinanceState } from "@/types/finance";
import { PLANS_TABLE } from "./config";

/**
 * Decides which plan a student sees right after logging in:
 * - their saved account plan, if they have one;
 * - otherwise the personal plan they made as a guest in this browser, which is then copied into the account;
 * - otherwise nothing (they go through setup). The demo plan is never copied into an account.
 */
export function choosePlanOnLogin(
  accountPlan: FinanceState | null,
  guestPlan: FinanceState | null
): { plan: FinanceState | null; importGuestPlan: boolean } {
  if (accountPlan) return { plan: accountPlan, importGuestPlan: false };
  if (guestPlan?.mode === "personal") return { plan: guestPlan, importGuestPlan: true };
  return { plan: null, importGuestPlan: false };
}

/** Only personal plans are stored in an account; the demo stays in memory. */
export function shouldSaveToAccount(plan: FinanceState) {
  return plan.mode === "personal";
}

export async function loadAccountPlan(supabase: SupabaseClient, userId: string): Promise<FinanceState | null> {
  const { data, error } = await supabase.from(PLANS_TABLE).select("data").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data?.data as FinanceState | undefined) ?? null;
}

export async function saveAccountPlan(supabase: SupabaseClient, userId: string, plan: FinanceState) {
  const { error } = await supabase
    .from(PLANS_TABLE)
    .upsert({ user_id: userId, data: plan, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

export async function deleteAccountPlan(supabase: SupabaseClient, userId: string) {
  const { error } = await supabase.from(PLANS_TABLE).delete().eq("user_id", userId);
  if (error) throw error;
}
