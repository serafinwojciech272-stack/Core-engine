export type ImageProviderResult={provider:string;status:"READY"|"NOT_CONFIGURED";url?:string;message:string};
export function imageProviderReadiness(){return {configured:Boolean(process.env.IMAGE_PROVIDER_URL?.trim()&&process.env.IMAGE_PROVIDER_TOKEN?.trim())};}
export async function executeImageProvider(input:Record<string,unknown>):Promise<ImageProviderResult>{
 const url=process.env.IMAGE_PROVIDER_URL?.trim(), token=process.env.IMAGE_PROVIDER_TOKEN?.trim();
 if(!url||!token) return {provider:"external-image",status:"NOT_CONFIGURED",message:"IMAGE_PROVIDER_NOT_CONFIGURED"};
 const r=await fetch(url,{method:"POST",headers:{"Authorization":"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify(input),cache:"no-store"});
 const text=await r.text(); if(!r.ok) throw new Error("IMAGE_PROVIDER_HTTP_"+r.status);
 let b:Record<string,unknown>={}; try{b=JSON.parse(text)}catch{}
 return {provider:"external-image",status:"READY",url:typeof b.url==="string"?b.url:undefined,message:"Image provider execution accepted."};
}
