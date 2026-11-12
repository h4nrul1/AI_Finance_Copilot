import type { FinanceState, PracticeHolding, PracticePortfolio, PracticeTrade } from "@/types/finance";

export const MIN_TRADE_DOLLARS = 1;

const SHARE_PRECISION = 1e6;
const roundCents = (value: number) => Math.round(value * 100) / 100;
const roundShares = (value: number) => Math.round(value * SHARE_PRECISION) / SHARE_PRECISION;

export const emptyPortfolio = (): PracticePortfolio => ({ holdings: [], trades: [] });

export function getPortfolio(state: FinanceState): PracticePortfolio {
  return state.portfolio ?? emptyPortfolio();
}

export type TradeResult = { ok: true; state: FinanceState } | { ok: false; error: string };

function priceProblem(price: number) {
  return Number.isFinite(price) && price > 0 ? null : "There's no price for this yet, so it can't be traded.";
}

function makeTrade(state: FinanceState, side: PracticeTrade["side"], symbol: string, shares: number, price: number, amount: number): PracticeTrade {
  const count = getPortfolio(state).trades.length;
  return { id: `trade-${count + 1}-${symbol}`, date: state.semester.currentDate, side, symbol, shares, price, amount };
}

/** Buys `dollars` worth (fractional shares) at `price`, paid from checking. */
export function buyShares(state: FinanceState, symbol: string, dollars: number, price: number): TradeResult {
  const problem = priceProblem(price);
  if (problem) return { ok: false, error: problem };
  const amount = roundCents(dollars);
  if (!(amount >= MIN_TRADE_DOLLARS)) return { ok: false, error: `The smallest practice trade is $${MIN_TRADE_DOLLARS}.` };
  if (amount > state.cash.checking) return { ok: false, error: "That's more than you have in checking." };

  const portfolio = getPortfolio(state);
  const shares = roundShares(amount / price);
  const existing = portfolio.holdings.find((holding) => holding.symbol === symbol);
  const holding: PracticeHolding = {
    symbol,
    shares: roundShares((existing?.shares ?? 0) + shares),
    costBasis: roundCents((existing?.costBasis ?? 0) + amount)
  };

  return {
    ok: true,
    state: {
      ...state,
      cash: { ...state.cash, checking: roundCents(state.cash.checking - amount) },
      portfolio: {
        holdings: existing ? portfolio.holdings.map((item) => (item.symbol === symbol ? holding : item)) : [...portfolio.holdings, holding],
        trades: [...portfolio.trades, makeTrade(state, "buy", symbol, shares, price, amount)]
      }
    }
  };
}

/** Sells `shares` at `price`, returning the dollars to checking. Selling every share removes the holding. */
export function sellShares(state: FinanceState, symbol: string, shares: number, price: number): TradeResult {
  const problem = priceProblem(price);
  if (problem) return { ok: false, error: problem };

  const portfolio = getPortfolio(state);
  const existing = portfolio.holdings.find((holding) => holding.symbol === symbol);
  if (!existing) return { ok: false, error: "You don't own any of this." };
  if (!(shares > 0)) return { ok: false, error: "Enter an amount to sell." };
  if (shares > existing.shares + 1 / SHARE_PRECISION) return { ok: false, error: "That's more than you own." };

  const sold = Math.min(shares, existing.shares);
  const soldAll = existing.shares - sold < 1 / SHARE_PRECISION;
  const amount = roundCents(sold * price);
  const remaining: PracticeHolding = {
    symbol,
    shares: roundShares(existing.shares - sold),
    costBasis: roundCents(existing.costBasis * (1 - sold / existing.shares))
  };

  return {
    ok: true,
    state: {
      ...state,
      cash: { ...state.cash, checking: roundCents(state.cash.checking + amount) },
      portfolio: {
        holdings: soldAll
          ? portfolio.holdings.filter((item) => item.symbol !== symbol)
          : portfolio.holdings.map((item) => (item.symbol === symbol ? remaining : item)),
        trades: [...portfolio.trades, makeTrade(state, "sell", symbol, sold, price, amount)]
      }
    }
  };
}

export interface HoldingValue {
  holding: PracticeHolding;
  /** Null while no price is available for the symbol. */
  price: number | null;
  value: number | null;
  gain: number | null;
}

export interface PortfolioSummary {
  rows: HoldingValue[];
  /** Current value of everything that has a price. */
  value: number;
  /** Dollars paid for the holdings that have a price. */
  invested: number;
  gain: number;
  gainPercent: number;
  /** True when some holdings couldn't be valued, so the totals leave them out. */
  incomplete: boolean;
}

export function summarizePortfolio(portfolio: PracticePortfolio, prices: Record<string, number>): PortfolioSummary {
  const rows = portfolio.holdings.map((holding): HoldingValue => {
    const price = prices[holding.symbol] ?? null;
    const value = price === null ? null : roundCents(holding.shares * price);
    return { holding, price, value, gain: value === null ? null : roundCents(value - holding.costBasis) };
  });
  const priced = rows.filter((row): row is HoldingValue & { value: number } => row.value !== null);
  const value = roundCents(priced.reduce((sum, row) => sum + row.value, 0));
  const invested = roundCents(priced.reduce((sum, row) => sum + row.holding.costBasis, 0));
  return {
    rows,
    value,
    invested,
    gain: roundCents(value - invested),
    gainPercent: invested > 0 ? ((value - invested) / invested) * 100 : 0,
    incomplete: priced.length < rows.length
  };
}
