import type { EngineSignal } from "@/lib/engine";

export type Timeframe = "M5" | "M15" | "H1" | "H4";

export type MultiTimeframeAnalysis = {
  status: "DERIVED" | "UNAVAILABLE";
  alignment: "ALIGNED" | "MIXED" | "CONFLICT" | "UNAVAILABLE";
  dominant: Timeframe | "UNAVAILABLE";
  direction: "LONG" | "SHORT" | "NEUTRAL" | "UNAVAILABLE";
  agreementPct: number | null;
  source: "SIGNALS" | "UNAVAILABLE";
  methodology: "deterministic-mtf-v1";
  frames: Array<{ timeframe: Timeframe; direction: "LONG" | "SHORT" | "NEUTRAL" | "UNAVAILABLE"; source: string }>;
};

function read(signals: EngineSignal[], timeframe: Timeframe): { direction: "LONG" | "SHORT" | "NEUTRAL" | "UNAVAILABLE"; source: string } {
  const aliases = [`direction_${timeframe.toLowerCase()}`, `trend_${timeframe.toLowerCase()}`, `mtf_${timeframe.toLowerCase()}`];
  const hit = signals.find((s) => aliases.includes(s.name));
  if (!hit) return { direction: "UNAVAILABLE" as const, source: "UNAVAILABLE" };
  const raw = hit.value.trim().toUpperCase();
  const direction = raw === "LONG" || raw === "BUY" ? "LONG" : raw === "SHORT" || raw === "SELL" ? "SHORT" : raw === "NEUTRAL" || raw === "FLAT" ? "NEUTRAL" : "UNAVAILABLE";
  return { direction, source: hit.source };
}

export function analyzeMultiTimeframe(signals: EngineSignal[]): MultiTimeframeAnalysis {
  const frames = (["M5", "M15", "H1", "H4"] as Timeframe[]).map((timeframe) => ({ timeframe, ...read(signals, timeframe) }));
  const available = frames.filter((frame) => frame.direction !== "UNAVAILABLE");
  if (available.length === 0) {
    return { status: "UNAVAILABLE", alignment: "UNAVAILABLE", dominant: "UNAVAILABLE", direction: "UNAVAILABLE", agreementPct: null, source: "UNAVAILABLE", methodology: "deterministic-mtf-v1", frames };
  }
  const counts = available.reduce<Record<string, number>>((acc, frame) => { acc[frame.direction] = (acc[frame.direction] ?? 0) + 1; return acc; }, {});
  const dominant = (Object.entries(counts).sort((a,b) => b[1]-a[1])[0]?.[0] ?? "NEUTRAL") as "LONG"|"SHORT"|"NEUTRAL";
  const maxCount = counts[dominant] ?? 0;
  const agreementPct = Math.round((maxCount / available.length) * 100);
  const alignment = available.length < 2 ? "MIXED" : agreementPct === 100 ? "ALIGNED" : agreementPct >= 50 ? "MIXED" : "CONFLICT";
  const dominantFrame = available.find((frame) => frame.direction === dominant)?.timeframe ?? "M15";
  return { status: "DERIVED", alignment, dominant: dominantFrame, direction: dominant, agreementPct, source: "SIGNALS", methodology: "deterministic-mtf-v1", frames };
}
