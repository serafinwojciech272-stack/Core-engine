import { providerReadiness } from "@/lib/provider-adapters";

export type WebEvidence = { title:string; url:string; snippet:string; source:string; reliability:number; retrievedAt:string };

export async function collectWebEvidence(query:string, limit=8): Promise<WebEvidence[]> {
  const key=process.env.SERPER_API_KEY?.trim();
  if(!key) throw new Error("SERPER_API_NOT_CONFIGURED");
  const response=await fetch("https://google.serper.dev/search",{method:"POST",headers:{"X-API-KEY":key,"Content-Type":"application/json"},body:JSON.stringify({q:query,num:Math.min(Math.max(limit,1),20)}),cache:"no-store"});
  const body=await response.json() as {organic?:Array<{title?:string;link?:string;snippet?:string}>};
  if(!response.ok) throw new Error("SERPER_HTTP_"+response.status);
  return (body.organic??[]).map(x=>({title:x.title??"",url:x.link??"",snippet:x.snippet??"",source:new URL(x.link??"https://invalid.local").hostname,reliability:0.5,retrievedAt:new Date().toISOString()})).filter(x=>x.url);
}

export function webEvidenceReadiness(){return {configured:Boolean(process.env.SERPER_API_KEY?.trim())};}
