import { describe, expect, it } from "vitest";
import {
  UAF_STAGES, appendLedgerEvent, isLedgerIntact, idempotencyKey, routeCapability,
  buildContextSnapshot, enforceBudget, acquireLease, buildEvidenceChain, convergeOutcome,
  classifyFailure, scoreProviderHealth, buildHandoffEnvelope, validateScope,
  reconcileMemory, certifyUniversalAgent, readinessGate
} from "@/lib/universal-agent-fabric";

describe("M136-M150 Universal Agent Fabric", () => {
  it("defines stages 136-150", () => expect(UAF_STAGES.map(x => x.id)).toEqual(Array.from({length:15},(_,i)=>136+i)));
  it("keeps a tamper-evident ledger", () => {
    let events = appendLedgerEvent([], {type:"PLAN",runId:"r1",payload:{ok:true}});
    events = appendLedgerEvent(events, {type:"APPROVAL",runId:"r1",payload:{approved:true}});
    expect(isLedgerIntact(events)).toBe(true);
    expect(isLedgerIntact(events.map((e,i)=>i===1?{...e,payload:{approved:false}}:e))).toBe(false);
  });
  it("creates deterministic idempotency keys", () => expect(idempotencyKey("r1","execute",4)).toBe(idempotencyKey("r1","execute",4)));
  it("routes capability with fallbacks", () => expect(routeCapability({build:["p1","p2"]},"build",["p1","p2"]).fallbacks).toEqual(["p2"]));
  it("builds bounded context and evidence", () => {
    const ctx=buildContextSnapshot({objective:" x ",facts:["a","a"],unknowns:["u"],evidence:["e"]});
    expect(ctx.snapshotId).toMatch(/^ctx_/);
    expect(buildEvidenceChain([{source:"s",claim:"c",confidence:2}])[0].confidence).toBe(1);
  });
  it("enforces budget and lease", () => {
    expect(enforceBudget({agentId:"a",tenantId:"t",domains:[],capabilities:[],maxCost:5,requireApproval:true},6).allowed).toBe(false);
    expect(acquireLease({}, "r1","h").acquired).toBe(true);
    expect(acquireLease({r1:"h"},"r1","other").acquired).toBe(false);
  });
  it("converges outcomes and classifies failures", () => {
    expect(convergeOutcome([0.2,0.4,0.8]).trend).toBe("IMPROVING");
    expect(classifyFailure({code:"TIMEOUT"}).action).toBe("FALLBACK");
  });
  it("scores providers and requires approval in handoff", () => {
    expect(scoreProviderHealth({availability:1,latencyMs:100,errorRate:0}).score).toBeGreaterThan(0.9);
    expect(()=>buildHandoffEnvelope({runId:"r",objective:"o",capability:"build",evidence:[],approvalId:""})).toThrow("APPROVAL_ID_REQUIRED");
  });
  it("certifies only when all governance checks pass", () => {
    const certification=certifyUniversalAgent({ledgerIntact:true,approvalIntact:true,evidenceCount:1,outcomeCount:1,recoverySafe:true,scopeValid:true});
    expect(certification.certified).toBe(true);
    expect(readinessGate({certification,providerAvailable:true,budgetAllowed:true,idempotencyPresent:true}).ready).toBe(true);
  });
  it("reconciles memory by highest confidence", () => {
    expect(reconcileMemory([{key:"x",value:"old",confidence:.2},{key:"x",value:"new",confidence:.9}])[0].value).toBe("new");
  });
});
