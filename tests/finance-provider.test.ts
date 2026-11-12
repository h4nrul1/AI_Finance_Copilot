import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@supabase/supabase-js";
import type { FinanceState } from "@/types/finance";
import { createBlankPlan } from "@/lib/data/blank-plan";
import { demoState } from "@/lib/data/seed";
import { FinanceProvider } from "@/components/providers/finance-provider";

// Run the provider's real entry points in the node test environment, recording
// state updates and effects without requiring a browser renderer.
const harness = vi.hoisted(() => ({
  effects: [] as (() => unknown)[],
  setState: vi.fn(),
  getSupabase: vi.fn()
}));

vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useState: (initial: unknown) => [initial, harness.setState],
  useEffect: (effect: () => unknown) => { harness.effects.push(effect); },
  useMemo: (factory: () => unknown) => factory(),
  useRef: (initial: unknown) => ({ current: initial })
}));

vi.mock("@/lib/supabase/browser", () => ({ getBrowserSupabase: harness.getSupabase }));

function savedPlan(): FinanceState {
  const { guaranteed: _guaranteed, ...legacyIncome } = demoState.incomes[0];
  // Server and localStorage JSON can predate the required guaranteed field.
  return JSON.parse(JSON.stringify({
    ...createBlankPlan("2026-10-28"),
    incomes: [legacyIncome, { ...legacyIncome, id: "uncertain", guaranteed: false }]
  })) as FinanceState;
}

function expectNormalizedState() {
  const plan = harness.setState.mock.calls.map(([value]) => value)
    .find((value): value is FinanceState => Boolean(value?.incomes?.length));
  expect(plan?.incomes.map((income) => income.guaranteed)).toEqual([true, false]);
}

beforeEach(() => {
  harness.effects.length = 0;
  harness.setState.mockClear();
  harness.getSupabase.mockReset();
  harness.getSupabase.mockReturnValue(null);
  vi.stubGlobal("window", {
    localStorage: { getItem: vi.fn(() => JSON.stringify(savedPlan())) },
    sessionStorage: { getItem: vi.fn(() => null) }
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("provider plan entry points", () => {
  it("normalizes legacy personal plans loaded from guest localStorage", () => {
    FinanceProvider({ children: null });
    harness.effects[0]();
    expectNormalizedState();
    expect(harness.setState).toHaveBeenCalledWith("ready");
  });

  it.each([false, true])("normalizes account login plans (import guest: %s)", async (importGuest) => {
    vi.useFakeTimers();
    let onAuth: (event: string, session: Session) => void = () => {};
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const table = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: importGuest ? null : { data: savedPlan() }, error: null }),
      upsert
    };
    harness.getSupabase.mockReturnValue({
      from: vi.fn(() => table),
      auth: {
        onAuthStateChange: vi.fn((callback) => {
          onAuth = callback;
          return { data: { subscription: { unsubscribe: vi.fn() } } };
        })
      }
    });
    Object.assign(window.localStorage, { removeItem: vi.fn() });

    FinanceProvider({ children: null });
    harness.effects[0]();
    onAuth("SIGNED_IN", { user: { id: "student", email: "student@example.com" } } as Session);
    await vi.runAllTimersAsync();

    expectNormalizedState();
    expect(harness.setState).toHaveBeenCalledWith("ready");
    expect(upsert).toHaveBeenCalledTimes(importGuest ? 1 : 0);
  });

  it("normalizes a legacy plan passed to startPlan", () => {
    const provider = FinanceProvider({ children: null });
    provider.props.value.startPlan(savedPlan());
    expectNormalizedState();
  });
});
