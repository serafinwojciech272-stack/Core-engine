export type DataClassification="PUBLIC"|"INTERNAL"|"CONFIDENTIAL"|"RESTRICTED"|"SENSITIVE";
export type DataPolicy={policyId:string;tenantId:string;classification:DataClassification;retentionMs:number;allowExport:boolean;allowModelInput:boolean;version:string};
export type DataLineage={lineageId:string;tenantId:string;dataId:string;source:string;parentIds:string[];createdAt:number};
export type DataQualityResult={dataId:string;valid:boolean;completeness:number;freshness:number;issues:string[]};
export type DataDeletionRequest={requestId:string;tenantId:string;dataId:string;requestedBy:string;status:"REQUESTED"|"APPROVED"|"EXECUTED"|"BLOCKED";requestedAt:number};

const rank:Record<DataClassification,number>={PUBLIC:0,INTERNAL:1,CONFIDENTIAL:2,RESTRICTED:3,SENSITIVE:4};

export class DataGovernance {
  private policies=new Map<string,DataPolicy>();
  private lineage=new Map<string,DataLineage>();
  private deletions=new Map<string,DataDeletionRequest>();
  setPolicy(p:DataPolicy){if(p.retentionMs<0)throw new Error("INVALID_RETENTION");this.policies.set(p.tenantId,{...p});return {...p};}
  assertAccess(tenantId:string,classification:DataClassification,operation:"READ"|"EXPORT"|"MODEL_INPUT"){
    const p=this.policies.get(tenantId);if(!p)throw new Error("DATA_POLICY_NOT_FOUND");
    if(rank[classification]>rank[p.classification])throw new Error("DATA_CLASSIFICATION_BLOCKED");
    if(operation==="EXPORT"&&!p.allowExport)throw new Error("DATA_EXPORT_BLOCKED");
    if(operation==="MODEL_INPUT"&&!p.allowModelInput)throw new Error("MODEL_INPUT_BLOCKED");
    return true;
  }
  addLineage(l:DataLineage){if(l.parentIds.includes(l.dataId))throw new Error("LINEAGE_CYCLE");this.lineage.set(l.lineageId,{...l});return {...l};}
  quality(q:DataQualityResult){if(q.completeness<0||q.completeness>1||q.freshness<0||q.freshness>1)throw new Error("INVALID_QUALITY");return {...q};}
  requestDeletion(d:Omit<DataDeletionRequest,"status"|"requestedAt">){const v={...d,status:"REQUESTED" as const,requestedAt:Date.now()};this.deletions.set(d.requestId,v);return {...v};}
  approveDeletion(id:string){const d=this.deletions.get(id);if(!d)throw new Error("DELETION_NOT_FOUND");d.status="APPROVED";return {...d};}
  snapshot(){return {policies:[...this.policies.values()],lineage:[...this.lineage.values()],deletions:[...this.deletions.values()]};}
}
