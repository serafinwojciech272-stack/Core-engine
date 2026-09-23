import type { CapabilityPack, CapabilityAction } from "@/lib/capability-contracts";
import { ensureCapabilityPacks } from "@/lib/capability-packs";
import { listCapabilityPacks } from "@/lib/capability-registry";

export type GrowthCapabilityPlan = {
  objective: string;
  selectedPacks: Array<{
    id: string;
    name: string;
    score: number;
    reason: string;
    actions: CapabilityAction[];
  }>;
  actions: CapabilityAction[];
  requiresApproval: boolean;
  dependencies: string[];
};

function tokens(value: string) {
  return value.toLowerCase().split(/[^a-z0-9_]+/).filter(Boolean);
}

export function planGrowthCapabilities(input: {
  objective: string;
  diagnosis?: string;
  recommendation?: string;
  signals?: string[];
}) : GrowthCapabilityPlan {
  ensureCapabilityPacks();
  const corpus = [input.objective, input.diagnosis || "", input.recommendation || "", ...(input.signals || [])].join(" ");
  const wanted = new Set(tokens(corpus));
  const scored = listCapabilityPacks().map(pack => {
    const searchable = tokens([pack.id, pack.name, pack.category, pack.description, ...pack.capabilities, ...pack.signals, ...pack.diagnostics, ...pack.metrics].join(" "));
    let score = 0;
    for (const t of searchable) if (wanted.has(t)) score += 1;
    if (/seo|search|organic|google|ranking/.test(corpus.toLowerCase()) && pack.category === "SEO") score += 6;
    if (/checkout|conversion|cart|sales|revenue|commerce/.test(corpus.toLowerCase()) && pack.category === "ECOMMERCE") score += 6;
    if (/lead|form|contact|inquir/.test(corpus.toLowerCase()) && pack.category === "FORMS") score += 6;
    if (/speed|performance|core web|lcp|cls|inp/.test(corpus.toLowerCase()) && pack.category === "PERFORMANCE") score += 6;
    if (/security|vulnerab|login|2fa/.test(corpus.toLowerCase()) && pack.category === "SECURITY") score += 6;
    if (/email|smtp|deliver/.test(corpus.toLowerCase()) && pack.category === "EMAIL") score += 6;
    if (/social|campaign|content|marketing/.test(corpus.toLowerCase()) && pack.category === "SOCIAL") score += 6;
    return { pack, score };
  }).filter(x => x.score > 0).sort((a,b) => b.score-a.score).slice(0, 5);

  const selectedPacks = scored.map(({pack, score}) => ({
    id: pack.id, name: pack.name, score,
    reason: "Capability selected from objective, diagnosis, recommendation and available signals.",
    actions: pack.actions
  }));
  const actions = selectedPacks.flatMap(x => x.actions).slice(0, 10);
  const dependencies = [...new Set(selectedPacks.flatMap(x => x.actions.flatMap(() => {
    const p = listCapabilityPacks().find(y => y.id === x.id); return p?.dependencies || [];
  })))] ;
  return {
    objective: input.objective,
    selectedPacks,
    actions,
    requiresApproval: actions.some(a => a.requiresApproval || a.risk === "HIGH" || a.risk === "CRITICAL"),
    dependencies
  };
}
