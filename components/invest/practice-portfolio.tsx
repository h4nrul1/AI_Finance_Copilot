"use client";

import { useEffect, useMemo, useState } from "react";
import { FlaskConical } from "lucide-react";
import { VerdictCard } from "@/components/scenarios/verdict-card";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { Label, NumberInput, Select } from "@/components/ui/input";
import { useFinance } from "@/components/providers/finance-provider";
import { getPortfolio, MIN_TRADE_DOLLARS, summarizePortfolio } from "@/lib/finance/portfolio";
import { compareScenarioToBaseline, summarizeScenarioResult } from "@/lib/finance/tools";
import type { Quote } from "@/lib/market/quotes";
import { PRACTICE_SYMBOLS, practiceSymbol } from "@/lib/market/symbols";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

const REFRESH_MS = 60_000;
const RECENT_TRADES = 8;

type QuoteState = { status: "loading" } | { status: "ready"; quotes: Record<string, Quote>; asOf: string } | { status: "unavailable"; message: string };

function usePracticeQuotes(): QuoteState {
  const [result, setResult] = useState<QuoteState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const response = await fetch("/api/quotes");
        const body = await response.json();
        if (cancelled) return;
        if (!response.ok) setResult({ status: "unavailable", message: body.message ?? "Couldn't get prices right now." });
        else setResult({ status: "ready", quotes: body.quotes, asOf: body.asOf });
      } catch {
        // Keep showing the last prices if a refresh fails; only the first load reports the problem.
        if (!cancelled) setResult((current) => (current.status === "ready" ? current : { status: "unavailable", message: "Couldn't get prices right now." }));
      }
    }
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  return result;
}

const signed = (value: number) => `${value >= 0 ? "+" : "-"}${formatCurrency(Math.abs(value), 2)}`;

/** Practice investing with the student's own tracked cash. No real money moves; prices are real. */
export function PracticePortfolioCard() {
  const { state, buyPractice, sellPractice } = useFinance();
  const quoteState = usePracticeQuotes();
  const quotes = useMemo(() => (quoteState.status === "ready" ? quoteState.quotes : {}), [quoteState]);
  const prices = useMemo(() => Object.fromEntries(Object.entries(quotes).map(([symbol, quote]) => [symbol, quote.price])), [quotes]);

  const portfolio = getPortfolio(state);
  const summary = useMemo(() => summarizePortfolio(portfolio, prices), [portfolio, prices]);

  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [symbol, setSymbol] = useState(PRACTICE_SYMBOLS[0].symbol);
  const [amount, setAmount] = useState(50);
  const [message, setMessage] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const price = prices[symbol];
  const held = portfolio.holdings.find((holding) => holding.symbol === symbol);
  const heldValue = held && price ? held.shares * price : 0;
  const validAmount = Number.isFinite(amount) && amount >= MIN_TRADE_DOLLARS;

  const preview = useMemo(() => {
    if (side !== "buy" || !validAmount || amount > state.cash.checking) return null;
    return compareScenarioToBaseline(state, {
      id: "practice-buy",
      name: `Practice buy: ${symbol}`,
      description: "Practice investing",
      type: "investment",
      amount,
      date: state.semester.currentDate
    });
  }, [side, validAmount, amount, state, symbol]);

  function submit() {
    if (!price) return;
    let error: string | null;
    if (side === "buy") {
      error = buyPractice(symbol, amount, price);
    } else {
      // Selling the whole position (or within a cent of it) sells every share, so no dust is left behind.
      const sellAll = held !== undefined && amount >= heldValue - 0.005;
      error = held ? sellPractice(symbol, sellAll ? held.shares : amount / price, price) : "You don't own any of this.";
    }
    setMessage(
      error
        ? { tone: "bad", text: error }
        : { tone: "good", text: `${side === "buy" ? "Bought" : "Sold"} ${formatCurrency(amount, 2)} of ${symbol} at ${formatCurrency(price, 2)}.` }
    );
  }

  const canSubmit = Boolean(price) && validAmount && (side === "buy" ? amount <= state.cash.checking : Boolean(held) && amount <= heldValue + 0.005);

  return (
    <Card>
      <CardHeader title="4. Practice investing with your own numbers" eyebrow="Practice mode" />
      <div className="mb-4 flex items-start gap-3 rounded-lg bg-paper p-3 text-sm leading-6 text-ink">
        <FlaskConical className="mt-0.5 shrink-0 text-moss" size={18} />
        <p>
          Practice trades use the checking balance in this app, so buying lowers it and selling adds it back. Prices are real market prices, but no
          real money moves and nothing is bought at a broker.
        </p>
      </div>

      {quoteState.status === "unavailable" ? (
        <p className="mb-4 rounded-lg border border-coral/40 bg-coral/5 p-3 text-sm text-ink">
          {quoteState.message} Practice trades are paused until prices load.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Tile label="Checking available" value={formatCurrency(state.cash.checking, 2)} />
        <Tile label="Practice portfolio" value={formatCurrency(summary.value, 2)} note={summary.incomplete ? "Some holdings have no price yet" : undefined} />
        <Tile
          label="Total gain / loss"
          value={signed(summary.gain)}
          note={summary.invested > 0 ? `${summary.gainPercent >= 0 ? "+" : ""}${summary.gainPercent.toFixed(1)}% on ${formatCurrency(summary.invested, 2)}` : undefined}
          tone={summary.gain === 0 ? "neutral" : summary.gain > 0 ? "good" : "bad"}
        />
      </div>

      <div className="mt-5 rounded-lg border border-line p-4">
        <div className="mb-3 flex gap-2" role="group" aria-label="Buy or sell">
          {(["buy", "sell"] as const).map((item) => (
            <Button
              key={item}
              size="sm"
              variant={side === item ? "primary" : "secondary"}
              aria-pressed={side === item}
              onClick={() => {
                setSide(item);
                setMessage(null);
              }}
            >
              {item === "buy" ? "Buy" : "Sell"}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px_auto] sm:items-end">
          <div>
            <Label htmlFor="practice-symbol">Investment</Label>
            <Select
              id="practice-symbol"
              value={symbol}
              onChange={(event) => {
                setSymbol(event.target.value);
                setMessage(null);
              }}
            >
              {PRACTICE_SYMBOLS.map((item) => (
                <option key={item.symbol} value={item.symbol}>
                  {item.symbol} · {item.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="practice-amount">Amount ($)</Label>
            <NumberInput id="practice-amount" value={amount} onValueChange={setAmount} min={0} />
          </div>
          <Button onClick={submit} disabled={!canSubmit}>
            {side === "buy" ? "Buy" : "Sell"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted">
          {price ? `${symbol} is ${formatCurrency(price, 2)} a share.` : "No price yet."}
          {validAmount && price ? ` ${formatCurrency(amount, 2)} is about ${(amount / price).toFixed(4)} shares.` : ""}
          {side === "sell" && held ? (
            <>
              {" "}You hold {formatCurrency(heldValue, 2)}.{" "}
              <button type="button" className="font-semibold text-moss underline" onClick={() => setAmount(Math.floor(heldValue * 100) / 100)}>
                Sell max
              </button>
            </>
          ) : null}
          {side === "sell" && !held ? " You don't own any of this yet." : ""}
          {side === "buy" && amount > state.cash.checking ? " That's more than you have in checking." : ""}
        </p>
        {message ? <p className={cn("mt-2 text-sm font-semibold", message.tone === "good" ? "text-moss" : "text-coral")}>{message.text}</p> : null}
        {preview ? (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.10em] text-muted">What this buy would do to your semester</p>
            <VerdictCard verdict={preview.verdict} summary={summarizeScenarioResult(state, preview)} />
          </div>
        ) : null}
      </div>

      <h3 className="mt-6 text-sm font-semibold text-ink">Your holdings</h3>
      {summary.rows.length === 0 ? (
        <p className="mt-2 text-sm text-muted">Nothing yet. Buy something above to start practicing.</p>
      ) : (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="text-xs uppercase tracking-[0.10em] text-muted">
              <tr>
                <th className="py-2 pr-4">Symbol</th>
                <th className="py-2 pr-4">Shares</th>
                <th className="py-2 pr-4">Price</th>
                <th className="py-2 pr-4">Value</th>
                <th className="py-2 pr-4">Gain / loss</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {summary.rows.map((row) => (
                <tr key={row.holding.symbol}>
                  <td className="py-2 pr-4 font-medium text-ink" title={practiceSymbol(row.holding.symbol)?.name}>
                    {row.holding.symbol}
                  </td>
                  <td className="py-2 pr-4 text-ink">{row.holding.shares.toFixed(4)}</td>
                  <td className="py-2 pr-4 text-muted">{row.price === null ? "n/a" : formatCurrency(row.price, 2)}</td>
                  <td className="py-2 pr-4 text-ink">{row.value === null ? "n/a" : formatCurrency(row.value, 2)}</td>
                  <td className={cn("py-2 pr-4", row.gain === null ? "text-muted" : row.gain >= 0 ? "text-moss" : "text-coral")}>
                    {row.gain === null ? "n/a" : signed(row.gain)}
                  </td>
                  <td className="py-2 text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setSide("sell");
                        setSymbol(row.holding.symbol);
                        setMessage(null);
                        if (row.value !== null) setAmount(Math.floor(row.value * 100) / 100);
                      }}
                    >
                      Sell
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {portfolio.trades.length > 0 ? (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-semibold text-ink">Recent practice trades</summary>
          <ul className="mt-2 divide-y divide-line">
            {portfolio.trades
              .slice(-RECENT_TRADES)
              .reverse()
              .map((trade) => (
                <li key={trade.id} className="flex flex-wrap justify-between gap-2 py-2 text-ink">
                  <span>
                    {formatDate(trade.date)} · {trade.side === "buy" ? "Bought" : "Sold"} {trade.shares.toFixed(4)} {trade.symbol} at {formatCurrency(trade.price, 2)}
                  </span>
                  <span className="text-muted">{formatCurrency(trade.amount, 2)}</span>
                </li>
              ))}
          </ul>
        </details>
      ) : null}
    </Card>
  );
}

function Tile({ label, value, note, tone = "neutral" }: { label: string; value: string; note?: string; tone?: "neutral" | "good" | "bad" }) {
  return (
    <div className="rounded-lg border border-line bg-panel p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.10em] text-muted">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold", tone === "good" ? "text-moss" : tone === "bad" ? "text-coral" : "text-ink")}>{value}</p>
      {note ? <p className="mt-0.5 text-xs text-muted">{note}</p> : null}
    </div>
  );
}
