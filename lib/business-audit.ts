import {executeCapabilityAction,getCapabilityAction} from "@/lib/capability-action-registry";

export type BusinessAudit={url:string;httpStatus:number;trustGate:"PASS"|"REVIEW"|"BLOCK";trustReasons:string[];signals:{name:string;value:string;source:string}[];evidence:Record<string,unknown>;opportunities:string[]};

export async function runBusinessAudit(input:{url:string;idempotencyKey:string}):Promise<BusinessAudit>{
  const action=getCapabilityAction("seo.audit");
  if(!action)throw new Error("BUSINESS_AUDIT_CAPABILITY_NOT_REGISTERED");
  if(action.requiresApproval)throw new Error("BUSINESS_AUDIT_APPROVAL_POLICY_MISMATCH");
  const receipt=await executeCapabilityAction({actionId:"seo.audit",approved:true,missionId:"business-audit",idempotencyKey:input.idempotencyKey,input:{url:input.url}});
  if(receipt.status!=="EXECUTED")throw new Error(receipt.error?.message||receipt.message||"BUSINESS_AUDIT_FAILED");
  const output=receipt.output??{};
  const httpStatus=typeof output.httpStatus==="number"?output.httpStatus:0;
  const title=typeof output.title==="string"&&output.title.trim().length>0;
  const descriptionPresent=output.descriptionPresent===true;
  const canonicalPresent=output.canonicalPresent===true;
  const viewportPresent=output.viewportPresent===true;
  const trustReasons:string[]=[];
  if(httpStatus<200||httpStatus>=400)trustReasons.push("HTTP_STATUS_NOT_HEALTHY");
  if(!title)trustReasons.push("MISSING_TITLE");
  if(!descriptionPresent)trustReasons.push("MISSING_META_DESCRIPTION");
  if(!canonicalPresent)trustReasons.push("MISSING_CANONICAL");
  if(!viewportPresent)trustReasons.push("MISSING_VIEWPORT");
  const trustGate=httpStatus>=400||httpStatus===0?"BLOCK":trustReasons.length>=3?"REVIEW":"PASS";
  const signals=[
    {name:"website_http_status",value:String(httpStatus),source:"core.web-audit.v1"},
    {name:"website_title_present",value:String(title),source:"core.web-audit.v1"},
    {name:"website_meta_description_present",value:String(descriptionPresent),source:"core.web-audit.v1"},
    {name:"website_canonical_present",value:String(canonicalPresent),source:"core.web-audit.v1"},
    {name:"website_viewport_present",value:String(viewportPresent),source:"core.web-audit.v1"}
  ];
  const opportunities:string[]=[];
  if(!title)opportunities.push("Improve page title and search intent alignment.");
  if(!descriptionPresent)opportunities.push("Add a unique meta description tied to the primary commercial intent.");
  if(!canonicalPresent)opportunities.push("Define canonical URL policy to reduce indexing ambiguity.");
  if(!viewportPresent)opportunities.push("Add a responsive viewport declaration.");
  if(!opportunities.length)opportunities.push("No basic technical trust gap detected; proceed to business KPI discovery.");
  return{url:typeof output.url==="string"?output.url:input.url,httpStatus,trustGate,trustReasons,signals,evidence:output,opportunities};
}
