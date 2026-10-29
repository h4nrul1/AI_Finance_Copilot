export type RiskLevel = "low" | "medium" | "high";

export interface InvestingApproach {
  id: string;
  label: string;
  /** Plain-language time frame, e.g. "Under 2 years". */
  horizon: string;
  summary: string;
  goodFor: string;
  watchOut: string;
  risk: RiskLevel;
  /** Ids of InvestingOption entries that are commonly used for this approach. */
  optionIds: string[];
  /** Question pre-filled in the copilot. */
  question: string;
}

export interface InvestingOption {
  id: string;
  name: string;
  summary: string;
  pros: string[];
  cons: string[];
  risk: RiskLevel;
  /** Rough guide to how quickly you can get cash back out. */
  liquidity: string;
  question: string;
}

export const APPROACHES: InvestingApproach[] = [
  {
    id: "short-term",
    label: "Short term",
    horizon: "Under 2 years",
    summary: "Money you may need soon, like next semester's rent, a trip, or an emergency. The goal is keeping it safe, not growing it fast.",
    goodFor: "Emergency cushions, tuition or rent due soon, and savings goals within the next year or two.",
    watchOut: "Stocks can fall right when you need the money. Money needed soon usually belongs in cash-like accounts.",
    risk: "low",
    optionIds: ["hysa", "cd", "tbills"],
    question: "What is a high-yield savings account?"
  },
  {
    id: "medium-term",
    label: "Medium term",
    horizon: "2 to 7 years",
    summary: "Goals a few years out, like a car, a move after graduation, or a down payment. A mix of safe and growth investments is common.",
    goodFor: "Goals with a rough date where you can handle some ups and downs.",
    watchOut: "A market drop close to your goal date can force you to sell at a loss. Many people shift toward safer holdings as the date nears.",
    risk: "medium",
    optionIds: ["bond-funds", "index-etf", "tbills"],
    question: "What is a bond fund?"
  },
  {
    id: "long-term",
    label: "Long term",
    horizon: "7+ years",
    summary: "Money you will not touch for a long time. Time lets you ride out market drops, so growth investments make more sense here.",
    goodFor: "Building wealth over decades. Starting as a student gives compounding the most time to work.",
    watchOut: "Values can drop 30% or more in a bad year. Only invest money you will not need for rent, food, or tuition.",
    risk: "high",
    optionIds: ["sp500", "index-etf", "stocks"],
    question: "What is diversification?"
  },
  {
    id: "retirement",
    label: "Retirement accounts",
    horizon: "Decades",
    summary: "Special accounts with tax benefits for retirement. They hold investments such as index funds, so this is about where you invest, not what.",
    goodFor: "Anyone with earned income. An employer match on a 401(k) is effectively free money.",
    watchOut: "Withdrawing early can mean taxes and penalties. Rules and limits change, so check current IRS limits.",
    risk: "medium",
    optionIds: ["401k", "roth-ira", "sp500"],
    question: "What is a Roth IRA?"
  }
];

export const OPTIONS: InvestingOption[] = [
  {
    id: "hysa",
    name: "High-yield savings account",
    summary: "A savings account that pays more interest than a standard one. Balances are typically FDIC insured up to the limit.",
    pros: ["Very low risk", "Cash available any time", "No market swings"],
    cons: ["Interest rate can change", "Growth rarely beats inflation by much"],
    risk: "low",
    liquidity: "Same day to a few days",
    question: "What is a high-yield savings account?"
  },
  {
    id: "cd",
    name: "Certificate of deposit (CD)",
    summary: "You lock money away for a set term, such as 6 or 12 months, in exchange for a fixed interest rate.",
    pros: ["Rate is fixed for the term", "Low risk when bank is FDIC insured"],
    cons: ["Early withdrawal usually costs a penalty", "Not for money you may need sooner"],
    risk: "low",
    liquidity: "Locked until the term ends",
    question: "What is a CD?"
  },
  {
    id: "tbills",
    name: "Treasury bills",
    summary: "Short-term loans to the US government that mature in weeks to a year. They are backed by the government.",
    pros: ["Very low default risk", "Predictable return if held to maturity"],
    cons: ["Returns are modest", "Need a brokerage or TreasuryDirect account"],
    risk: "low",
    liquidity: "Can be sold, best held to maturity",
    question: "What are Treasury bills?"
  },
  {
    id: "bond-funds",
    name: "Bond funds",
    summary: "A basket of bonds, which are loans to governments or companies. They usually move less than stocks but can still lose value.",
    pros: ["Typically steadier than stocks", "Regular income from interest"],
    cons: ["Prices fall when interest rates rise", "Lower long-run growth than stocks"],
    risk: "medium",
    liquidity: "Sell on any market day",
    question: "What is a bond fund?"
  },
  {
    id: "index-etf",
    name: "ETFs (exchange-traded funds)",
    summary: "A fund that holds many investments and trades like a single stock. Broad ETFs spread your money across hundreds or thousands of companies.",
    pros: ["Instant diversification", "Usually low fees", "Start with small amounts"],
    cons: ["Still goes up and down with the market", "Narrow or themed ETFs can be much riskier", "Fees vary, so check the expense ratio"],
    risk: "medium",
    liquidity: "Sell on any market day",
    question: "What is an ETF?"
  },
  {
    id: "sp500",
    name: "S&P 500 index fund",
    summary: "A fund that tracks 500 of the largest US companies. It is one of the most common building blocks for long-term investors, available as an ETF or a mutual fund.",
    pros: ["Diversified across many large companies", "Low-cost and hands-off", "Long history of growth over decades"],
    cons: ["US large companies only", "Can drop 30%+ in a downturn", "Past results do not guarantee future results"],
    risk: "high",
    liquidity: "Sell on any market day",
    question: "What is an S&P 500 index fund?"
  },
  {
    id: "stocks",
    name: "Individual stocks",
    summary: "A share of ownership in one company. Your result depends heavily on how that single company performs.",
    pros: ["Potential for large gains", "Full control over what you own", "Fractional shares let you start small"],
    cons: ["One company can fall sharply or fail", "Takes research and discipline", "Easy to overspend on hype"],
    risk: "high",
    liquidity: "Sell on any market day",
    question: "What are the risks of buying individual stocks?"
  },
  {
    id: "401k",
    name: "401(k) or 403(b)",
    summary: "An employer retirement plan. Contributions usually come out of your paycheck before or after tax, and many employers add a match.",
    pros: ["Employer match is free money", "Tax advantages", "Automatic contributions"],
    cons: ["Limited fund choices", "Early withdrawals can be penalized", "Only available through an employer"],
    risk: "medium",
    liquidity: "Locked until retirement age, with exceptions",
    question: "What is a 401k?"
  },
  {
    id: "roth-ira",
    name: "Roth IRA",
    summary: "A retirement account you open yourself. You contribute money you have already paid tax on, and qualified withdrawals in retirement are tax free.",
    pros: ["Tax-free growth", "Contributions (not earnings) can be withdrawn without penalty", "Good fit for low-income student years"],
    cons: ["Needs earned income", "Yearly contribution limit", "Earnings are locked until retirement"],
    risk: "medium",
    liquidity: "Contributions accessible, earnings locked",
    question: "What is a Roth IRA?"
  }
];

export const RISK_LABELS: Record<RiskLevel, string> = {
  low: "Lower risk",
  medium: "Medium risk",
  high: "Higher risk"
};

export const RISK_TONES = { low: "good", medium: "warn", high: "bad" } as const;
