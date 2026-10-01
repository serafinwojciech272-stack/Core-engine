import { createHash } from "node:crypto";

export type ResourceType = "TOKENS"|"API_REQUESTS"|"COMPUTE_TIME"|"STORAGE"|"BANDWIDTH"|"TOOL_INVOCATIONS"|"CONCURRENT_EXECUTIONS";
export type ResourceScope = "SYSTEM"|"TENANT"|"USER"|"MISSION"|"WORKFLOW"|"STEP"|"TOOL"|"PROVIDER";
export type BudgetStatus = "ACTIVE"|"WARNING"|"EXHAUSTED"|"EXPIRED"|"SUSPENDED";
export type ReservationStatus = "RESERVED"|"CONSUMED"|"RELEASED"|"EXPIRED"|"CANCELLED";

export type ResourceBudget = {
  budgetId:string; tenantId:string; scopeType:ResourceScope; scopeId:string;
  resourceType:ResourceType; amount:number; consumed:number; reserved:number;
  softLimit:number; hardLimit:number; startsAt:number; endsAt:number; version:number; status:BudgetStatus;
};

export type ResourceReservation = {
  reservationId:string; budgetId:string; tenantId:string; scopeId:string;
  resourceType:ResourceType; quantity:number; status:ReservationStatus;
  idempotencyKey:string; createdAt:number; expiresAt:number;
};

export type ResourceUsage = {
  usageId:string; tenantId:string; missionId?:string; workflowId?:string; executionId?:string;
  invocationId?:string; resourceType:ResourceType; quantity:number; unit:string;
  provider?:string; toolId?:string; timestamp:number; idempotencyKey:string;
};

export type CostRecord = ResourceUsage & {
  costId:string; currency:string; unitPrice:number; totalCost:number;
  pricingVersion:string; estimated:boolean; finalized:boolean;
};

export type ResourceDecision = {
  allowed:boolean; reasonCodes:string[]; budgetId:string; available:number;
  requested:number; reservationId?:string; expiresAt:number;
};

const id=(prefix:string)=>`${prefix}_${crypto.randomUUID()}`;
const clamp=(n:number)=>Math.max(0,n);

export class ResourceControlPlane {
  private budgets = new Map<string,ResourceBudget>();
  private reservations = new Map<string,ResourceReservation>();
  private usage = new Map<string,ResourceUsage>();
  private costs = new Map<string,CostRecord>();

  upsertBudget(input: Omit<ResourceBudget,"consumed"|"reserved"|"status"> & Partial<Pick<ResourceBudget,"consumed"|"reserved"|"status">>): ResourceBudget {
    if (!Number.isFinite(input.amount) || input.amount < 0) throw new Error("INVALID_BUDGET");
    if (input.hardLimit < 0 || input.softLimit < 0 || input.softLimit > input.hardLimit) throw new Error("INVALID_LIMITS");
    const existing=this.budgets.get(input.budgetId);
    if(existing && input.version < existing.version) throw new Error("STALE_BUDGET_VERSION");
    const budget:ResourceBudget={
      ...input,
      consumed:clamp(input.consumed ?? existing?.consumed ?? 0),
      reserved:clamp(input.reserved ?? existing?.reserved ?? 0),
      status:input.status ?? existing?.status ?? "ACTIVE"
    };
    this.budgets.set(budget.budgetId,budget);
    return {...budget};
  }

  getBudget(budgetId:string){const b=this.budgets.get(budgetId); return b ? {...b}:undefined;}

  estimate(budgetId:string, requested:number):ResourceDecision {
    const b=this.budgets.get(budgetId);
    if(!b) return {allowed:false,reasonCodes:["BUDGET_NOT_FOUND"],budgetId,available:0,requested,expiresAt:0};
    const now=Date.now();
    if(now>b.endsAt) return {allowed:false,reasonCodes:["BUDGET_EXPIRED"],budgetId,available:0,requested,expiresAt:b.endsAt};
    const available=clamp(b.hardLimit-b.consumed-b.reserved);
    const reasons:string[]=[];
    if(b.status==="SUSPENDED") reasons.push("BUDGET_SUSPENDED");
    if(b.status==="EXHAUSTED") reasons.push("BUDGET_EXHAUSTED");
    if(requested>available) reasons.push("BUDGET_EXCEEDED");
    return {allowed:reasons.length===0,reasonCodes:reasons.length?reasons:["RESOURCE_AVAILABLE"],budgetId,available,requested,expiresAt:b.endsAt};
  }

  reserve(budgetId:string, quantity:number, idempotencyKey:string, ttlMs=300000): ResourceDecision {
    if(!Number.isFinite(quantity)||quantity<=0) throw new Error("INVALID_RESERVATION");
    const existing=[...this.reservations.values()].find(r=>r.idempotencyKey===idempotencyKey);
    if(existing && existing.status==="RESERVED"){
      return {allowed:true,reasonCodes:["IDEMPOTENT_RESERVATION"],budgetId,available:this.available(budgetId),requested:quantity,reservationId:existing.reservationId,expiresAt:existing.expiresAt};
    }
    const decision=this.estimate(budgetId,quantity);
    if(!decision.allowed) return decision;
    const b=this.budgets.get(budgetId)!;
    const now=Date.now();
    b.reserved+=quantity;
    const reservation:ResourceReservation={reservationId:id("res"),budgetId,tenantId:b.tenantId,scopeId:b.scopeId,resourceType:b.resourceType,quantity,status:"RESERVED",idempotencyKey,createdAt:now,expiresAt:now+ttlMs};
    this.reservations.set(reservation.reservationId,reservation);
    return {...decision,allowed:true,reservationId:reservation.reservationId,expiresAt:reservation.expiresAt};
  }

  consumeReservation(reservationId:string):ResourceReservation {
    const r=this.reservations.get(reservationId);
    if(!r) throw new Error("RESERVATION_NOT_FOUND");
    if(r.status!=="RESERVED") throw new Error("RESERVATION_NOT_ACTIVE");
    const b=this.budgets.get(r.budgetId)!;
    b.reserved-=r.quantity; b.consumed+=r.quantity;
    r.status="CONSUMED";
    return {...r};
  }

  releaseReservation(reservationId:string, status:Extract<ReservationStatus,"RELEASED"|"CANCELLED"|"EXPIRED">="RELEASED"):ResourceReservation {
    const r=this.reservations.get(reservationId);
    if(!r) throw new Error("RESERVATION_NOT_FOUND");
    if(r.status!=="RESERVED") return {...r};
    const b=this.budgets.get(r.budgetId)!;
    b.reserved-=r.quantity;
    r.status=status;
    return {...r};
  }

  recordUsage(input:Omit<ResourceUsage,"usageId"|"timestamp"> & Partial<Pick<ResourceUsage,"timestamp">>):ResourceUsage {
    const prior=[...this.usage.values()].find(u=>u.idempotencyKey===input.idempotencyKey);
    if(prior) return {...prior};
    if(!Number.isFinite(input.quantity)||input.quantity<0) throw new Error("INVALID_USAGE");
    const usage:ResourceUsage={...input,usageId:id("usage"),timestamp:input.timestamp??Date.now()};
    this.usage.set(usage.usageId,usage);
    return {...usage};
  }

  recordCost(input:Omit<CostRecord,"costId">):CostRecord {
    const prior=[...this.costs.values()].find(c=>c.idempotencyKey===input.idempotencyKey);
    if(prior) return {...prior};
    const cost:CostRecord={...input,costId:id("cost")};
    this.costs.set(cost.costId,cost);
    return {...cost};
  }

  expireReservations(now=Date.now()):string[] {
    const expired:string[]=[];
    for(const r of this.reservations.values()){
      if(r.status==="RESERVED" && r.expiresAt<=now){this.releaseReservation(r.reservationId,"EXPIRED"); expired.push(r.reservationId);}
    }
    return expired;
  }

  available(budgetId:string){
    const b=this.budgets.get(budgetId);
    return b ? clamp(b.hardLimit-b.consumed-b.reserved) : 0;
  }

  snapshot(){
    return {
      budgets:[...this.budgets.values()].map(v=>({...v})),
      reservations:[...this.reservations.values()].map(v=>({...v})),
      usage:[...this.usage.values()].map(v=>({...v})),
      costs:[...this.costs.values()].map(v=>({...v}))
    };
  }

  static hashUsage(input:unknown){
    return createHash("sha256").update(JSON.stringify(input)).digest("hex");
  }
}
