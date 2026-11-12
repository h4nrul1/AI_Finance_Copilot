import { describe, expect, it } from "vitest";
import { createBlankPlan } from "@/lib/data/blank-plan";
import { buyShares, getPortfolio, sellShares, summarizePortfolio } from "@/lib/finance/portfolio";
import { parseSnapshots } from "@/lib/market/quotes";
import type { FinanceState } from "@/types/finance";

const base: FinanceState = { ...createBlankPlan("2026-10-28", "Test"), cash: { checking: 1000, savings: 0, targetEndingBuffer: 100 } };

function expectOk(result: ReturnType<typeof buyShares>) {
  if (!result.ok) throw new Error(result.error);
  return result.state;
}

describe("practice buying", () => {
  it("moves dollars out of checking into fractional shares", () => {
    const state = expectOk(buyShares(base, "VOO", 250, 500));
    expect(state.cash.checking).toBe(750);
    expect(getPortfolio(state).holdings).toEqual([{ symbol: "VOO", shares: 0.5, costBasis: 250 }]);
    expect(getPortfolio(state).trades).toHaveLength(1);
  });

  it("adds to an existing holding", () => {
    const once = expectOk(buyShares(base, "VOO", 100, 400));
    const twice = expectOk(buyShares(once, "VOO", 100, 500));
    expect(getPortfolio(twice).holdings).toEqual([{ symbol: "VOO", shares: 0.45, costBasis: 200 }]);
  });

  it("refuses more than checking, tiny trades, and missing prices", () => {
    expect(buyShares(base, "VOO", 1001, 500)).toMatchObject({ ok: false });
    expect(buyShares(base, "VOO", 0.5, 500)).toMatchObject({ ok: false });
    expect(buyShares(base, "VOO", 100, 0)).toMatchObject({ ok: false });
    expect(base.portfolio).toBeUndefined();
  });
});

describe("practice selling", () => {
  const bought = expectOk(buyShares(base, "VOO", 500, 500));

  it("returns the dollars at the current price and keeps cost basis proportional", () => {
    const state = expectOk(sellShares(bought, "VOO", 0.25, 600));
    expect(state.cash.checking).toBe(500 + 150);
    expect(getPortfolio(state).holdings).toEqual([{ symbol: "VOO", shares: 0.75, costBasis: 375 }]);
  });

  it("removes the holding when every share is sold", () => {
    const state = expectOk(sellShares(bought, "VOO", 1, 450));
    expect(getPortfolio(state).holdings).toEqual([]);
    expect(state.cash.checking).toBe(500 + 450);
  });

  it("refuses selling what isn't owned", () => {
    expect(sellShares(bought, "VOO", 2, 500)).toMatchObject({ ok: false });
    expect(sellShares(bought, "AAPL", 1, 100)).toMatchObject({ ok: false });
    expect(sellShares(base, "VOO", 1, 100)).toMatchObject({ ok: false });
  });
});

describe("portfolio summary", () => {
  const state = expectOk(buyShares(expectOk(buyShares(base, "VOO", 500, 500)), "AAPL", 100, 200));

  it("values holdings and totals the gain", () => {
    const summary = summarizePortfolio(getPortfolio(state), { VOO: 550, AAPL: 180 });
    expect(summary.value).toBe(550 + 90);
    expect(summary.invested).toBe(600);
    expect(summary.gain).toBe(40);
    expect(summary.incomplete).toBe(false);
  });

  it("leaves unpriced holdings out of the totals and says so", () => {
    const summary = summarizePortfolio(getPortfolio(state), { VOO: 500 });
    expect(summary.value).toBe(500);
    expect(summary.invested).toBe(500);
    expect(summary.incomplete).toBe(true);
    expect(summary.rows.find((row) => row.holding.symbol === "AAPL")?.price).toBeNull();
  });
});

describe("quote parsing", () => {
  it("reads the latest trade, falls back to the daily bar, and drops symbols without a price", () => {
    const quotes = parseSnapshots({
      VOO: { latestTrade: { p: 512.34 }, prevDailyBar: { c: 510 } },
      AAPL: { dailyBar: { c: 200 } },
      MSFT: {},
      TSLA: { latestTrade: { p: 0 } }
    });
    expect(quotes).toEqual({ VOO: { price: 512.34, previousClose: 510 }, AAPL: { price: 200, previousClose: null } });
    expect(parseSnapshots(null)).toEqual({});
  });
});
