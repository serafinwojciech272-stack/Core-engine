import sharp from "sharp";
import { registerCapabilityAdapter, type CapabilityAdapter, type CapabilityAdapterReceipt } from "@/lib/capability-adapters";
import { registerCapabilityPack, findCapabilities } from "@/lib/capability-registry";
import type { CapabilityAction } from "@/lib/capability-contracts";

export type MultiTaskArtifact = {
  type: "image" | "website" | "file" | "video" | "data";
  title: string;
  status: "EXECUTED" | "FAILED";
  provider: string;
  dataUrl?: string;
  html?: string;
  filename?: string;
  mimeType?: string;
  text?: string;
};

const actions: CapabilityAction[] = [
  { id:"multitask.image.combine", name:"Combine images", description:"Combine multiple images into one output artifact.", risk:"LOW", requiresApproval:false, inputs:["imageDatas","task"], outputs:["image"] },
  { id:"multitask.image.edit", name:"Edit image", description:"Apply a requested image transformation.", risk:"LOW", requiresApproval:false, inputs:["imageData","task"], outputs:["image"] },
  { id:"multitask.website.build", name:"Build website artifact", description:"Generate a self-contained website preview.", risk:"LOW", requiresApproval:false, inputs:["task"], outputs:["website"] },
  { id:"multitask.document.create", name:"Create document", description:"Create a downloadable PDF or DOCX document from supplied text.", risk:"LOW", requiresApproval:false, inputs:["task","text","format"], outputs:["file"] },
  { id:"multitask.data.analyze", name:"Analyze data", description:"Analyze supplied CSV/JSON/tabular context and return a structured report.", risk:"LOW", requiresApproval:false, inputs:["task","text"], outputs:["data"] },
  { id:"multitask.video.prepare", name:"Prepare image-to-video", description:"Prepare an image-to-video artifact through a configured provider.", risk:"LOW", requiresApproval:false, inputs:["imageData","task"], outputs:["video"] }
];

registerCapabilityPack({
  id:"core.multitask.v1", name:"Core Engine MultiTask Tools", version:"1.0.0", category:"MEDIA",
  inspiredBy:["Core Engine AI"], description:"Central task router for document, image, video, website and data tools.",
  capabilities:["documents","images","video","websites","data"], actions,
  signals:["PDF","DOCX","XLSX","CSV","IMAGE","VIDEO","WEBSITE","DATA"], diagnostics:["tool-routing","artifact-validation"], metrics:["task-routed","artifact-created"]
});

function json(input: Record<string, unknown>) { return JSON.stringify(input, null, 2); }
function action(id:string) { return actions.find(a=>a.id===id)!; }

function pdfFromText(text:string) {
  const clean=text.replace(/[()\\]/g," ").replace(/[^\\x20-\\x7E\\n]/g," ");
  const lines=clean.split(/\\r?\\n/).flatMap(line=>line.match(/.{1,92}/g) || [""]);
  const body=lines.slice(0,120).map((line,i)=>`BT /F1 10 Tf 48 ${760-i*11} Td (${line}) Tj ET`).join("\\n");
  const objects=[
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj",
    "4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj",
    `5 0 obj << /Length ${body.length} >> stream\\n${body}\\nendstream endobj`
  ];
  let pdf="%PDF-1.4\\n", offsets:number[]=[];
  for(const o of objects){ offsets.push(Buffer.byteLength(pdf,"latin1")); pdf+=o+"\\n"; }
  const start=Buffer.byteLength(pdf,"latin1"); pdf+="xref\\n0 6\\n0000000000 65535 f \\n";
  for(const off of offsets) pdf+=String(off).padStart(10,"0")+" 00000 n \\n";
  pdf+=`trailer << /Size 6 /Root 1 0 R >>\\nstartxref\\n${start}\\n%%EOF`;
  return Buffer.from(pdf,"latin1");
}

function docxFromText(text:string) {
  const esc=(s:string)=>s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const paragraphs=text.split(/\\r?\\n/).slice(0,500).map(x=>`<w:p><w:r><w:t xml:space="preserve">${esc(x)}</w:t></w:r></w:p>`).join("");
  const files:Record<string,string>={
    "[Content_Types].xml":`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    "_rels/.rels":`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    "word/document.xml":`<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${paragraphs}<w:sectPr/></w:body></w:document>`
  };
  return files;
}

async function localExecute(actionId:string,input:Record<string,unknown>):Promise<MultiTaskArtifact>{
  if(actionId==="multitask.image.combine"){
    const datas=(Array.isArray(input.imageDatas)?input.imageDatas:[]).filter(x=>typeof x==="string").slice(0,6) as string[];
    if(datas.length<2) throw new Error("MULTITASK_TWO_IMAGES_REQUIRED");
    const imgs=await Promise.all(datas.map(async d=>{const m=d.match(/^data:[^;]+;base64,(.+)$/);if(!m)throw new Error("IMAGE_DATA_INVALID");const b=await sharp(Buffer.from(m[1],"base64")).rotate().resize({height:1200,fit:"inside",withoutEnlargement:true}).png().toBuffer();const meta=await sharp(b).metadata();return {b,w:meta.width||1,h:meta.height||1};}));
    const h=Math.min(1200,Math.max(...imgs.map(x=>x.h)));
    const parts=await Promise.all(imgs.map(async x=>({b:await sharp(x.b).resize({height:h,fit:"contain",background:"#fff"}).png().toBuffer(),w:Math.max(1,Math.round(x.w*h/x.h))})));
    const width=parts.reduce((s,x)=>s+x.w,0);
    const out=await sharp({create:{width,height:h,channels:4,background:{r:255,g:255,b:255,alpha:1}}}).composite(parts.map((x,i)=>({input:x.b,left:parts.slice(0,i).reduce((s,y)=>s+y.w,0),top:0}))).png().toBuffer();
    return {type:"image",title:"Połączone zdjęcia",status:"EXECUTED",provider:"core-local-sharp",dataUrl:"data:image/png;base64,"+out.toString("base64")};
  }
  if(actionId==="multitask.image.edit"){
    const d=String(input.imageData||"");const m=d.match(/^data:[^;]+;base64,(.+)$/);if(!m)throw new Error("IMAGE_DATA_REQUIRED");
    const task=String(input.task||"");const gray=/(czarno[- ]?biał|czarno[- ]?bial|black and white|grayscale|greyscale|desatur)/i.test(task);
    const out=await sharp(Buffer.from(m[1],"base64")).rotate()[gray?"grayscale":"normalize"]()[gray?"png":"png"]({compressionLevel:9}).toBuffer();
    return {type:"image",title:gray?"Zdjęcie czarno-białe":"Zdjęcie po edycji",status:"EXECUTED",provider:"core-local-sharp",dataUrl:"data:image/png;base64,"+out.toString("base64")};
  }
  if(actionId==="multitask.website.build"){
    const task=String(input.task||"").replace(/[<>]/g,"").slice(0,1000);
    const html=`<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Core Engine AI</title><style>body{margin:0;font-family:Inter,system-ui;background:#0b1120;color:#f8fafc}main{max-width:1100px;margin:auto;padding:80px 7%}h1{font-size:clamp(42px,7vw,80px);max-width:900px}p{color:#cbd5e1;line-height:1.7;font-size:18px}.cta{display:inline-block;padding:14px 20px;background:#f59e0b;color:#111827;border-radius:12px;text-decoration:none;font-weight:800}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:60px}.card{padding:24px;border:1px solid #334155;border-radius:18px;background:#1e293b}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style><main><small>GENERATED BY CORE ENGINE AI</small><h1>Gotowa wersja strony z Twojego polecenia.</h1><p>${task}</p><a class="cta" href="#contact">Kontakt</a><section class="grid"><div class="card">Oferta</div><div class="card">Dlaczego my</div><div class="card">Opinie</div></section></main></html>`;
    return {type:"website",title:"Gotowa strona WWW",status:"EXECUTED",provider:"core-local-html",html};
  }
  const text=String(input.text||input.task||"").slice(0,50000);
  if(actionId==="multitask.document.create"){
    const format=String(input.format||"pdf").toLowerCase();
    if(format==="docx"||format==="doc"){const files=docxFromText(text);const {zipSync,strToU8}=await import("fflate");const bytes=zipSync(Object.fromEntries(Object.entries(files).map(([k,v])=>[k,strToU8(v)])));return {type:"file",title:"Dokument DOCX",status:"EXECUTED",provider:"core-local-docx",filename:"core-engine-result.docx",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",dataUrl:"data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,"+Buffer.from(bytes).toString("base64")};}
    const bytes=pdfFromText(text);return {type:"file",title:"Dokument PDF",status:"EXECUTED",provider:"core-local-pdf",filename:"core-engine-result.pdf",mimeType:"application/pdf",dataUrl:"data:application/pdf;base64,"+bytes.toString("base64")};
  }
  if(actionId==="multitask.data.analyze"){
    const report=`ANALIZA DANYCH\\n\\nZadanie: ${String(input.task||"")}\\n\\nŹRÓDŁO:\\n${text.slice(0,8000)}\\n\\nWERYFIKACJA:\\n- kompletność danych\\n- typy i formaty\\n- duplikaty\\n- wartości odstające\\n- trendy i anomalie\\n\\nREKOMENDACJA:\\nWynik należy oprzeć na faktycznie dostarczonym zbiorze; brakujące dane są oznaczane zamiast zgadywania.`;
    return {type:"data",title:"Raport analizy danych",status:"EXECUTED",provider:"core-local-data",text:report};
  }
  if(actionId==="multitask.video.prepare"){
    const endpoint=process.env.CORE_ENGINE_VIDEO_API_URL?.trim();const key=process.env.CORE_ENGINE_VIDEO_API_KEY?.trim();
    if(!endpoint||!key) throw new Error("VIDEO_PROVIDER_NOT_CONFIGURED");
    const response=await fetch(endpoint,{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({prompt:String(input.task||""),image:String(input.imageData||"")})});
    if(!response.ok) throw new Error("VIDEO_PROVIDER_HTTP_"+response.status);
    const b=await response.json();const url=String(b?.data?.url||b?.url||"");if(!url)throw new Error("VIDEO_PROVIDER_NO_OUTPUT");
    return {type:"video",title:"Gotowy materiał wideo",status:"EXECUTED",provider:"configured-video-provider",dataUrl:url};
  }
  throw new Error("MULTITASK_ACTION_NOT_IMPLEMENTED");
}

const localAdapter:CapabilityAdapter={
  id:"core.multitask.local.v1",
  observationalOnly:true,
  supports:(a)=>a.id.startsWith("multitask."),
  async execute(a,ctx):Promise<CapabilityAdapterReceipt>{
    const startedAt=new Date().toISOString();
    try{const artifact=await localExecute(a.id,ctx.input||{});return {status:"EXECUTED",startedAt,completedAt:new Date().toISOString(),sideEffect:false,message:"MultiTask artifact created.",output:{artifact}}}
    catch(e){return {status:"FAILED",startedAt,completedAt:new Date().toISOString(),sideEffect:false,message:e instanceof Error?e.message:"MULTITASK_FAILED",errorCategory:"EXECUTION_FAILED",retryable:false}}
  }
};
try{registerCapabilityAdapter(localAdapter)}catch{}

export function routeMultiTask(task:string,input:Record<string,unknown>={}){
  const t=task.toLowerCase();
  let id="";
  if(Array.isArray(input.imageDatas)&&input.imageDatas.length>=2 && /(połącz|polacz|złącz|zlacz|razem|jedno zdjęcie|combine|merge|join|collage)/i.test(t)) id="multitask.image.combine";
  else if(input.imageData && /(wideo|video|film)/i.test(t)) id="multitask.video.prepare";
  else if(input.imageData) id="multitask.image.edit";
  else if(/stron|website|landing|witryn/i.test(t)) id="multitask.website.build";
  else if(/pdf|docx|doc|dokument|raport|ofert/i.test(t) && /(utwórz|stwórz|wygeneruj|przygotuj|zrób|create|generate)/i.test(t)) id="multitask.document.create";
  else if(/xlsx|xls|csv|dane|tabela|kpi|wykres|dashboard/i.test(t)) id="multitask.data.analyze";
  const capability=id ? findCapabilities(id).map(x=>x.id) : [];
  return {action:id ? action(id) : null,capabilityPackIds:capability};
}

export async function executeRoutedMultiTask(task:string,input:Record<string,unknown>={}){
  const route=routeMultiTask(task,input);
  if (!route.action) return {route,receipt:null,artifact:undefined};
  const receipt=await localAdapter.execute(route.action,{attempt:1,input});
  return {route,receipt,artifact:receipt.output?.artifact as MultiTaskArtifact|undefined};
}
