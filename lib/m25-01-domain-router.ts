export const CORE_ENGINE_DOMAINS = [
  "EQUITY",
  "FX_MACRO",
  "SPORTS_BETTING",
  "REAL_ESTATE",
  "BUSINESS",
  "FORECASTING",
  "MARKET_NICHES",
] as const;

export type CoreEngineDomain = (typeof CORE_ENGINE_DOMAINS)[number];

export type DomainRouteStatus = "ROUTED" | "MULTI_DOMAIN" | "AMBIGUOUS" | "UNKNOWN";

export type DomainRoute = {
  status: DomainRouteStatus;
  primaryDomain: CoreEngineDomain | null;
  domains: CoreEngineDomain[];
  confidence: number;
  matchedSignals: Record<CoreEngineDomain, string[]>;
  unresolvedSignals: string[];
};

type DomainRule = {
  domain: CoreEngineDomain;
  signals: readonly string[];
};

const RULES: readonly DomainRule[] = [
  {
    domain: "EQUITY",
    signals: [
      "stock", "stocks", "share", "shares", "equity", "ticker", "eps",
      "ebitda", "revenue", "free cash flow", "fcf", "dcf", "valuation",
      "pe ratio", "p/e", "price to book", "pb ratio", "dividend",
      "buyback", "competitive moat", "quality of earnings", "portfolio",
    ],
  },
  {
    domain: "FX_MACRO",
    signals: [
      "forex", "fx", "currency", "eurusd", "gbpusd", "usdpln", "eurpln",
      "us dollar", "euro", "zloty", "rates", "interest rates", "fed",
      "ecb", "nbp", "central bank", "forward guidance", "cot",
      "positioning", "yield curve", "macro", "volatility targeting",
    ],
  },
  {
    domain: "SPORTS_BETTING",
    signals: [
      "sports betting", "betting", "bookmaker", "odds", "implied probability",
      "expected value", "ev+", "kelly", "stake", "bankroll", "xg", "elo",
      "poisson", "dixon-coles", "line movement", "steam", "reverse line",
      "player prop", "match odds", "bet",
    ],
  },
  {
    domain: "REAL_ESTATE",
    signals: [
      "real estate", "property", "apartment", "flat", "house", "rental",
      "rent", "landlord", "tenant", "noi", "cap rate", "cash-on-cash",
      "irr", "equity multiple", "br​rrr", "buy-to-let", "development",
      "vacancy", "capex", "property market",
    ],
  },
  {
    domain: "BUSINESS",
    signals: [
      "business plan", "startup", "company strategy", "business model",
      "unit economics", "tam", "sam", "som", "go-to-market", "gtm",
      "market size", "funding", "investor", "revenue model", "pricing",
      "customer acquisition", "cac", "ltv", "competitive landscape",
      "moat", "operations", "commercial strategy",
    ],
  },
  {
    domain: "FORECASTING",
    signals: [
      "forecast", "forecasting", "prediction", "predict", "probability",
      "scenario", "base rate", "reference class", "bayesian", "bayes",
      "confidence interval", "uncertainty", "decision tree", "leading indicator",
      "projection", "outlook", "what are the chances", "likelihood",
    ],
  },
  {
    domain: "MARKET_NICHES",
    signals: [
      "niche", "niches", "emerging market", "future theme", "structural trend",
      "structural tailwind", "bottleneck", "pain point", "barrier to entry",
      "winner-take-most", "why now", "silver economy", "longevity",
      "energy grid", "agriculture", "food security", "cybersecurity",
      "digital trust", "supply chain resilience", "climate adaptation",
    ],
  },
];

function normalize(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9+.-]+/g, " ")
    .trim();
}

function containsSignal(text: string, signal: string): boolean {
  const normalizedSignal = normalize(signal);
  return normalizedSignal.length > 0 && ` ${text} `.includes(` ${normalizedSignal} `);
}

function emptyMatches(): Record<CoreEngineDomain, string[]> {
  return Object.fromEntries(CORE_ENGINE_DOMAINS.map((domain) => [domain, []])) as Record<
    CoreEngineDomain,
    string[]
  >;
}

export function routeCoreEngineDomain(request: string): DomainRoute {
  const text = normalize(request);
  const matchedSignals = emptyMatches();

  if (!text) {
    return {
      status: "UNKNOWN",
      primaryDomain: null,
      domains: [],
      confidence: 0,
      matchedSignals,
      unresolvedSignals: ["REQUEST_EMPTY"],
    };
  }

  for (const rule of RULES) {
    for (const signal of rule.signals) {
      if (containsSignal(text, signal)) matchedSignals[rule.domain].push(signal);
    }
  }

  const ranked = CORE_ENGINE_DOMAINS
    .map((domain) => ({ domain, score: matchedSignals[domain].length }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    return {
      status: "UNKNOWN",
      primaryDomain: null,
      domains: [],
      confidence: 0,
      matchedSignals,
      unresolvedSignals: ["NO_DOMAIN_SIGNAL"],
    };
  }

  const top = ranked[0];
  const second = ranked[1];
  const totalSignals = ranked.reduce((sum, entry) => sum + entry.score, 0);

  // A single weak signal is intentionally insufficient for high-confidence routing.
  const confidence = Math.min(
    1,
    Math.round(((top.score + (top.score >= 2 ? 1 : 0)) / Math.max(totalSignals, 1)) * 100) / 100,
  );

  const domains = ranked
    .filter((entry) => entry.score >= Math.max(1, top.score - 1))
    .map((entry) => entry.domain);

  if (top.score === 1 && !second) {
    return {
      status: "AMBIGUOUS",
      primaryDomain: top.domain,
      domains: [top.domain],
      confidence: 0.5,
      matchedSignals,
      unresolvedSignals: ["SINGLE_WEAK_DOMAIN_SIGNAL"],
    };
  }

  if (domains.length > 1) {
    return {
      status: "MULTI_DOMAIN",
      primaryDomain: top.domain,
      domains,
      confidence,
      matchedSignals,
      unresolvedSignals: [],
    };
  }

  return {
    status: "ROUTED",
    primaryDomain: top.domain,
    domains: [top.domain],
    confidence,
    matchedSignals,
    unresolvedSignals: [],
  };
}

export function isCoreEngineDomain(value: string): value is CoreEngineDomain {
  return (CORE_ENGINE_DOMAINS as readonly string[]).includes(value);
}
