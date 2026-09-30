import type { PredictionLedgerEntry } from "@/lib/storage";

export type CalibrationSummary = {
  total: number;
  resolved: number;
  open: number;
  won: number;
  lost: number;
  unresolved: number;
  hitRate: number | null;
  brierScore: number | null;
  avgExpectedR: number | null;
  avgRealizedR: number | null;
  calibrationStatus: "CALIBRATED" | "INSUFFICIENT_DATA";
};

export function buildCalibrationSummary(entries: PredictionLedgerEntry[]): CalibrationSummary {
  const resolved = entries.filter(e => e.outcomeStatus !== "OPEN");
  const scored = resolved.filter(e => e.outcomeStatus === "WON" || e.outcomeStatus === "LOST");
  const won = resolved.filter(e => e.outcomeStatus === "WON").length;
  const lost = resolved.filter(e => e.outcomeStatus === "LOST").length;
  const unresolved = resolved.filter(e => e.outcomeStatus === "UNRESOLVED").length;
  const hitRate = scored.length ? won / scored.length : null;
  const brier = scored.length
    ? scored.reduce((sum, e) => {
        const p = Math.max(0, Math.min(1, Number(e.p1R) || 0));
        const actual = e.outcomeStatus === "WON" ? 1 : 0;
        return sum + (p - actual) ** 2;
      }, 0) / scored.length
    : null;
  const expected = resolved.filter(e => e.expectedR != null);
  const realized = resolved.filter(e => e.realizedR != null);
  return {
    total: entries.length,
    resolved: resolved.length,
    open: entries.length - resolved.length,
    won,
    lost,
    unresolved,
    hitRate,
    brierScore: brier,
    avgExpectedR: expected.length ? expected.reduce((s,e)=>s+(e.expectedR||0),0)/expected.length : null,
    avgRealizedR: realized.length ? realized.reduce((s,e)=>s+(e.realizedR||0),0)/realized.length : null,
    calibrationStatus: scored.length >= 10 ? "CALIBRATED" : "INSUFFICIENT_DATA"
  };
}
