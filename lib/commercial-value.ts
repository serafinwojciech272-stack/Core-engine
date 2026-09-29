export type ValueCaseQuality="UNVERIFIED"|"VERIFIED";

export type CommercialValueCase={
  id:string;
  tenantId:string;
  missionId:string|null;
  name:string;
  currency:string;
  baselineValue:number;
  targetValue:number|null;
  actualValue:number|null;
  investmentValue:number;
  valueDelta:number|null;
  roiPct:number|null;
  quality:ValueCaseQuality;
  createdAt:string;
  updatedAt:string;
};

export function calculateCommercialValue(input:{
  baselineValue:number;
  targetValue?:number|null;
  actualValue?:number|null;
  investmentValue:number;
}){
  const actual=input.actualValue ?? null;
  const delta=actual===null?null:actual-input.baselineValue;
  const roiPct=delta===null||input.investmentValue<=0?null:((delta-input.investmentValue)/input.investmentValue)*100;
  return {
    valueDelta:delta,
    roiPct,
    quality:actual===null?"UNVERIFIED":"VERIFIED" as ValueCaseQuality
  };
}
