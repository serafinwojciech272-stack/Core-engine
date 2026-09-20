import { NextResponse } from "next/server";
import { guardMutation } from "@/lib/http";
import { parseTenderDocument, parseTenderZip, type ParsedTenderDocument } from "@/lib/tender-parser";
import { fingerprintDataset, normalizeTenderCase } from "@/lib/tender-intelligence-engine";
import { persistTenderCase, storageMode } from "@/lib/storage";

export const runtime = "nodejs";
const MAX_TOTAL = 50 * 1024 * 1024;
const MAX_FILE = 20 * 1024 * 1024;
const OFFICIAL_HOST = "zabrze.logintrade.net";
const OFFICIAL_SOURCE = "https://zabrze.logintrade.net/zapytania_email,238598,f66e29363d9dcf5e140c48eece63b78c.html";

function decodeBase64(v:string){const normalized=v.replace(/^data:[^;]+;base64,/,"");return new Uint8Array(Buffer.from(normalized,"base64"))}
function attachmentLinks(html:string){
 const links:{name:string;url:string}[]=[];
 const re=/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m:RegExpExecArray|null;
 while((m=re.exec(html))){const href=m[1], label=m[2].replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&").trim(), name=label||decodeURIComponent(href.split("/").pop()||"").split("?")[0]; if(/\.(pdf|docx?|xlsx?|zip|xml|rtf)$/i.test(name)||/\.(pdf|docx?|xlsx?|zip|xml|rtf)(?:$|[?#])/i.test(href)) links.push({name,url:new URL(href,OFFICIAL_SOURCE).toString()})}
 return links.filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i)
}
async function fetchOfficialDocuments(sourceUrl:string){
 const u=new URL(sourceUrl); if(u.hostname!==OFFICIAL_HOST) throw new Error("OFFICIAL_SOURCE_HOST_REQUIRED");
 const res=await fetch(u,{cache:"no-store",headers:{"user-agent":"Core-Engine-Tender-Intelligence/1.0"}});
 if(!res.ok) throw new Error("OFFICIAL_SOURCE_FETCH_"+res.status);
 const html=await res.text(); const links=attachmentLinks(html); const docs:ParsedTenderDocument[]=[];
 for(const link of links){const r=await fetch(link.url,{cache:"no-store",headers:{"user-agent":"Core-Engine-Tender-Intelligence/1.0"}}); if(!r.ok) continue; const bytes=new Uint8Array(await r.arrayBuffer()); if(bytes.byteLength>MAX_FILE) continue; if(/\.zip$/i.test(link.name)){docs.push(...await parseTenderZip(bytes,link.name,"official-intake"));}else{docs.push(await parseTenderDocument(bytes,link.name,"official-intake"));}}
 return {docs,discovered:links.map(x=>x.name)};
}
export async function POST(request:Request){
 const guard=guardMutation(request,"tender-intake"); if(guard)return guard;
 try{
  const raw=await request.text(); if(Buffer.byteLength(raw,"utf8")>MAX_TOTAL*1.5)return NextResponse.json({ok:false,error:"REQUEST_TOO_LARGE"},{status:413});
  const body=JSON.parse(raw||"{}") as {caseId?:string;title?:string;sourceUrl?:string;documents?:{name:string;base64:string}[]};
  const caseId=String(body.caseId||"Z154/68879"); const title=String(body.title||"Zabrze · municipal waste");
  let docs:ParsedTenderDocument[]=[]; let discovered:string[]=[];
  if(body.sourceUrl){const result=await fetchOfficialDocuments(body.sourceUrl);docs=result.docs;discovered=result.discovered}
  if(Array.isArray(body.documents)){let total=0;for(const item of body.documents){const bytes=decodeBase64(String(item.base64||""));total+=bytes.byteLength;if(bytes.byteLength>MAX_FILE||total>MAX_TOTAL)throw new Error("DOCUMENT_SIZE_LIMIT");if(/\.zip$/i.test(item.name))docs.push(...await parseTenderZip(bytes,item.name));else docs.push(await parseTenderDocument(bytes,item.name));}}
  if(!docs.length)return NextResponse.json({ok:false,error:"NO_DOCUMENTS_PARSED",sourceUrl:body.sourceUrl||OFFICIAL_SOURCE,discovered},{status:422});
  const dataset=normalizeTenderCase(caseId,docs); const fingerprint=fingerprintDataset(dataset);
  const persisted=storageMode()==="supabase"?await persistTenderCase(caseId,title,fingerprint,dataset as unknown as Record<string,unknown>):null;
  return NextResponse.json({ok:true,caseId,title,documents:docs.map(d=>({name:d.name,format:d.format,bytes:d.bytes,sha256:d.sha256,headings:d.headings.slice(0,30),textLength:d.text.length,tableCount:d.tables.length,source:d.source})),discovered,dataset,fingerprint,persistence:storageMode(),persisted:Boolean(persisted)});
 }catch(error){console.error("[core-engine] tender intake failed",error);return NextResponse.json({ok:false,error:error instanceof Error?error.message:"TENDER_INTAKE_FAILED"},{status:503})}
}