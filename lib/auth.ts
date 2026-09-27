import {createHash} from "node:crypto";
import { resolveTenant } from "@/lib/commercial-runtime";

export type Actor={id:string;kind:"human"|"system"|"agent"|"anonymous"};

function equal(a:string,b:string){return createHash("sha256").update(a).digest("hex")===createHash("sha256").update(b).digest("hex")}

function mappedKeyValid(token:string){
  const raw=process.env.CORE_ENGINE_API_KEYS_JSON;
  if(!raw)return false;
  try{
    const map=JSON.parse(raw) as Record<string,unknown>;
    return Object.values(map).some(secret=>typeof secret==="string"&&equal(token,secret));
  }catch{throw new Error("API_KEY_MAPPING_INVALID")}
}

export function authenticate(request:Request,required=true):Actor{
  const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"";
  const expected=process.env.CORE_ENGINE_API_KEY||"";
  if((expected&&token&&equal(token,expected))||(token&&mappedKeyValid(token)))return{id:"api-key",kind:"human"};
  if(required&&process.env.NODE_ENV==="production"&&process.env.CORE_ENGINE_ALLOW_ANONYMOUS!=="true")throw new Error("AUTH_REQUIRED");
  return{id:"anonymous",kind:"anonymous"};
}

export function authStatus(){
  return{
    configured:Boolean(process.env.CORE_ENGINE_API_KEY||process.env.CORE_ENGINE_API_KEYS_JSON),
    enforced:process.env.NODE_ENV==="production"&&process.env.CORE_ENGINE_ALLOW_ANONYMOUS!=="true",
    anonymousOptIn:process.env.CORE_ENGINE_ALLOW_ANONYMOUS==="true",
    tenantRuntime: (()=>{try{return resolveTenant(new Request("https://core-engine.local",{headers:{authorization:"Bearer "+(process.env.CORE_ENGINE_API_KEY||"")}})).tenantKey}catch{return null}})()
  };
}
