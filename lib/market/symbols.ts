export interface PracticeSymbol {
  symbol: string;
  name: string;
  kind: "ETF" | "Stock";
}

/** The funds and stocks available for practice investing. Quotes are only ever requested for these. */
export const PRACTICE_SYMBOLS: PracticeSymbol[] = [
  { symbol: "VOO", name: "Vanguard S&P 500 ETF", kind: "ETF" },
  { symbol: "VTI", name: "Vanguard Total US Stock Market ETF", kind: "ETF" },
  { symbol: "VXUS", name: "Vanguard Total International Stock ETF", kind: "ETF" },
  { symbol: "QQQ", name: "Invesco QQQ (Nasdaq-100) ETF", kind: "ETF" },
  { symbol: "BND", name: "Vanguard Total Bond Market ETF", kind: "ETF" },
  { symbol: "AAPL", name: "Apple", kind: "Stock" },
  { symbol: "MSFT", name: "Microsoft", kind: "Stock" },
  { symbol: "AMZN", name: "Amazon", kind: "Stock" },
  { symbol: "NVDA", name: "NVIDIA", kind: "Stock" },
  { symbol: "TSLA", name: "Tesla", kind: "Stock" }
];

export function practiceSymbol(symbol: string) {
  return PRACTICE_SYMBOLS.find((item) => item.symbol === symbol);
}
