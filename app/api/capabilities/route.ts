import { NextResponse } from "next/server";
import { ensureCapabilityPacks } from "@/lib/capability-packs";
import { findCapabilities, listCapabilityPacks } from "@/lib/capability-registry";
import { listCapabilityAdapters } from "@/lib/capability-adapters";

export async function GET(request: Request) {
  ensureCapabilityPacks();
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim();
  const packs = query ? findCapabilities(query) : listCapabilityPacks();
  return NextResponse.json({
    ok: true,
    contract: "capability-v1",
    adapterContract: "capability-adapter-v1",
    adapters: listCapabilityAdapters(),
    count: packs.length,
    packs: packs.map((pack) => ({
      id: pack.id,
      name: pack.name,
      category: pack.category,
      version: pack.version,
      description: pack.description,
      capabilities: pack.capabilities,
      signals: pack.signals,
      diagnostics: pack.diagnostics,
      metrics: pack.metrics,
      dependencies: pack.dependencies ?? [],
      actions: pack.actions
    }))
  }, { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } });
}
