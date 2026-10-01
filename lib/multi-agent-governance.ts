export type AgentStatus="REGISTERED"|"ACTIVE"|"PAUSED"|"DRAINING"|"BLOCKED"|"DISABLED"|"REVOKED"|"RETIRED";
export type AgentType="PLANNER"|"RESEARCHER"|"ANALYST"|"EXECUTOR"|"VERIFIER"|"MONITOR"|"SPECIALIST"|"SUPERVISOR"|"COORDINATOR";

export type AgentDefinition={
  agentId:string; tenantId:string; name:string; type:AgentType; version:string; status:AgentStatus;
  capabilities:string[]; maxDelegationDepth:number; maxConcurrentTasks:number;
};

export type Delegation={
  delegationId:string; tenantId:string; missionId:string; delegatorId:string; delegateId:string;
  capabilities:string[]; budgetLimit:number; maxRiskLevel:"LOW"|"MEDIUM"|"HIGH"; depth:number;
  createdAt:number; expiresAt:number; status:"ACTIVE"|"REVOKED"|"EXPIRED";
};

export type AgentTask={
  taskId:string; tenantId:string; missionId:string; workflowId:string; assignedAgentId:string;
  parentTaskId?:string; requiredCapabilities:string[]; status:"CREATED"|"ASSIGNED"|"RUNNING"|"WAITING"|"BLOCKED"|"HANDOFF_PENDING"|"COMPLETED"|"FAILED"|"CANCELLED"|"ESCALATED"|"RECOVERY_REQUIRED";
};

export type TaskHandoff={
  handoffId:string; taskId:string; fromAgentId:string; toAgentId:string;
  completedWork:string[]; pendingWork:string[]; unknowns:string[]; createdAt:number;
};

export class MultiAgentGovernance {
  private agents=new Map<string,AgentDefinition>();
  private delegations=new Map<string,Delegation>();
  private tasks=new Map<string,AgentTask>();
  private handoffs=new Map<string,TaskHandoff>();

  registerAgent(agent:AgentDefinition){
    if(agent.maxDelegationDepth<0 || agent.maxConcurrentTasks<1) throw new Error("INVALID_AGENT_LIMITS");
    if(this.agents.has(agent.agentId)) throw new Error("AGENT_ALREADY_REGISTERED");
    this.agents.set(agent.agentId,{...agent});
    return {...agent};
  }

  activate(agentId:string){
    const a=this.requireAgent(agentId);
    if(a.status==="REVOKED"||a.status==="RETIRED") throw new Error("AGENT_NOT_ACTIVATABLE");
    a.status="ACTIVE"; return {...a};
  }

  revoke(agentId:string){
    const a=this.requireAgent(agentId);
    a.status="REVOKED";
    for(const d of this.delegations.values()) if(d.delegatorId===agentId||d.delegateId===agentId) d.status="REVOKED";
    return {...a};
  }

  delegate(input:Omit<Delegation,"status"|"createdAt">){
    const parent=this.requireAgent(input.delegatorId);
    const child=this.requireAgent(input.delegateId);
    if(parent.tenantId!==input.tenantId||child.tenantId!==input.tenantId) throw new Error("TENANT_BOUNDARY");
    if(parent.status!=="ACTIVE"||child.status!=="ACTIVE") throw new Error("AGENT_NOT_ACTIVE");
    if(input.depth>parent.maxDelegationDepth) throw new Error("DELEGATION_DEPTH_EXCEEDED");
    if(input.delegateId===input.delegatorId) throw new Error("SELF_DELEGATION");
    if(input.budgetLimit<0) throw new Error("INVALID_DELEGATION_BUDGET");
    const delegation:Delegation={...input,status:"ACTIVE",createdAt:Date.now()};
    this.delegations.set(delegation.delegationId,delegation);
    return {...delegation};
  }

  createTask(task:AgentTask){
    const a=this.requireAgent(task.assignedAgentId);
    if(a.tenantId!==task.tenantId) throw new Error("TENANT_BOUNDARY");
    if(a.status!=="ACTIVE") throw new Error("AGENT_NOT_ACTIVE");
    if(task.requiredCapabilities.some(c=>!a.capabilities.includes(c))) throw new Error("CAPABILITY_MISMATCH");
    if(this.tasks.has(task.taskId)) throw new Error("TASK_ALREADY_EXISTS");
    this.tasks.set(task.taskId,{...task});
    return {...task};
  }

  handoff(input:Omit<TaskHandoff,"createdAt">){
    const task=this.tasks.get(input.taskId);
    if(!task) throw new Error("TASK_NOT_FOUND");
    if(task.assignedAgentId!==input.fromAgentId) throw new Error("TASK_OWNERSHIP");
    const target=this.requireAgent(input.toAgentId);
    const source=this.requireAgent(input.fromAgentId);
    if(target.tenantId!==source.tenantId) throw new Error("TENANT_BOUNDARY");
    if(target.status!=="ACTIVE") throw new Error("TARGET_AGENT_NOT_ACTIVE");
    task.status="HANDOFF_PENDING";
    task.assignedAgentId=input.toAgentId;
    task.status="ASSIGNED";
    const handoff:TaskHandoff={...input,createdAt:Date.now()};
    this.handoffs.set(handoff.handoffId,handoff);
    return {...handoff};
  }

  assertExecutable(agentId:string, tenantId:string, capability:string){
    const a=this.requireAgent(agentId);
    if(a.tenantId!==tenantId) throw new Error("TENANT_BOUNDARY");
    if(a.status!=="ACTIVE") throw new Error("AGENT_NOT_ACTIVE");
    if(!a.capabilities.includes(capability)) throw new Error("CAPABILITY_DENIED");
    return true;
  }

  snapshot(){return {
    agents:[...this.agents.values()].map(v=>({...v})),
    delegations:[...this.delegations.values()].map(v=>({...v})),
    tasks:[...this.tasks.values()].map(v=>({...v})),
    handoffs:[...this.handoffs.values()].map(v=>({...v}))
  };}

  private requireAgent(id:string){const a=this.agents.get(id); if(!a) throw new Error("AGENT_NOT_FOUND"); return a;}
}
