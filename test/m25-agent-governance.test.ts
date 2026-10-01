import test from "node:test";
import assert from "node:assert/strict";
import { MultiAgentGovernance } from "@/lib/multi-agent-governance";

const agent=(id:string,tenantId="t1")=>({agentId:id,tenantId,name:id,type:"SPECIALIST" as const,version:"1",status:"ACTIVE" as const,capabilities:["research"],maxDelegationDepth:2,maxConcurrentTasks:2});

test("M25 blocks self delegation and cross-tenant task assignment",()=>{
  const g=new MultiAgentGovernance();
  g.registerAgent(agent("a")); g.registerAgent(agent("b"));
  assert.throws(()=>g.delegate({delegationId:"d",tenantId:"t1",missionId:"m",delegatorId:"a",delegateId:"a",capabilities:["research"],budgetLimit:10,maxRiskLevel:"LOW",depth:1}),/SELF_DELEGATION/);
  assert.throws(()=>g.createTask({taskId:"x",tenantId:"t2",missionId:"m",workflowId:"w",assignedAgentId:"a",requiredCapabilities:["research"],status:"CREATED"}),/TENANT_BOUNDARY/);
});

test("M25 handoff preserves one authoritative owner",()=>{
  const g=new MultiAgentGovernance();
  g.registerAgent(agent("a")); g.registerAgent(agent("b"));
  g.createTask({taskId:"x",tenantId:"t1",missionId:"m",workflowId:"w",assignedAgentId:"a",requiredCapabilities:["research"],status:"CREATED"});
  const h=g.handoff({handoffId:"h",taskId:"x",fromAgentId:"a",toAgentId:"b",completedWork:["research"],pendingWork:["verify"],unknowns:["freshness"]});
  assert.equal(h.toAgentId,"b");
  assert.equal(g.snapshot().tasks[0].assignedAgentId,"b");
});
