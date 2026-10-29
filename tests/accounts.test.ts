import { describe, expect, it } from "vitest";
import { createBlankPlan } from "@/lib/data/blank-plan";
import { demoState } from "@/lib/data/seed";
import { safeRedirectPath, supabaseConfig } from "@/lib/supabase/config";
import { choosePlanOnLogin, shouldSaveToAccount } from "@/lib/supabase/plan-store";

const accountPlan = { ...createBlankPlan("2026-10-28", "Saved"), cash: { checking: 900, savings: 0, targetEndingBuffer: 500 } };
const guestPlan = createBlankPlan("2026-10-28", "Guest");

describe("which plan a student sees after logging in", () => {
  it("uses the plan saved in their account", () => {
    expect(choosePlanOnLogin(accountPlan, guestPlan)).toEqual({ plan: accountPlan, importGuestPlan: false });
  });

  it("brings a guest's own plan into a new account", () => {
    expect(choosePlanOnLogin(null, guestPlan)).toEqual({ plan: guestPlan, importGuestPlan: true });
  });

  it("never copies the demo into an account", () => {
    expect(choosePlanOnLogin(null, demoState)).toEqual({ plan: null, importGuestPlan: false });
    expect(choosePlanOnLogin(null, null)).toEqual({ plan: null, importGuestPlan: false });
  });

  it("only saves personal plans to an account", () => {
    expect(shouldSaveToAccount(guestPlan)).toBe(true);
    expect(shouldSaveToAccount(demoState)).toBe(false);
  });
});

describe("email link redirects", () => {
  it("allows pages on this site", () => {
    expect(safeRedirectPath("/auth/reset")).toBe("/auth/reset");
    expect(safeRedirectPath("/")).toBe("/");
  });

  it("refuses other sites and falls back to the home page", () => {
    expect(safeRedirectPath("https://evil.example")).toBe("/");
    expect(safeRedirectPath("//evil.example")).toBe("/");
    expect(safeRedirectPath("/\\\\evil.example")).toBe("/");
    expect(safeRedirectPath(null)).toBe("/");
  });
});

describe("guest-only mode", () => {
  it("turns accounts off when Supabase isn't configured", () => {
    const saved = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY };
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(supabaseConfig()).toBeNull();

    // A malformed URL (e.g. the variable name pasted twice) also falls back to guest-only instead of crashing.
    process.env.NEXT_PUBLIC_SUPABASE_URL = "NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-key";
    expect(supabaseConfig()).toBeNull();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    expect(supabaseConfig()).toEqual({ url: "https://abc.supabase.co", key: "test-key" });
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (saved.url) process.env.NEXT_PUBLIC_SUPABASE_URL = saved.url;
    if (saved.key) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = saved.key;
  });
});
