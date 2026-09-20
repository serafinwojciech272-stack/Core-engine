import {createHash} from "node:crypto";
export type Actor={id:string;kind:"human"|"system"|"agent"|"anonymous"};
function equal(a:string,b:string){return createHash("sha256").update(a).digest("hex")===createHash("sha256").update(b).digest("hex")}
export function authenticate(request:Request,required=true):Actor{const token=request.headers.get("authorization")?.replace(/^Bearer\s+/i,"")||"",expected=process.env.CORE_ENGINE_API_KEY||"";if(expected&&token&&equal(token,expected))return{id:"api-key",kind:"human"};if(required&&process.env.NODE_ENV==="production"&&process.env.CORE_ENGINE_ALLOW_ANONYMOUS!=="true")throw new Error("AUTH_REQUIRED");return{id:"anonymous",kind:"anonymous"}}
export function authStatus(){return{configured:Boolean(process.env.CORE_ENGINE_API_KEY),enforced:process.env.NODE_ENV==="production"&&process.env.CORE_ENGINE_ALLOW_ANONYMOUS!=="true",anonymousOptIn:process.env.CORE_ENGINE_ALLOW_ANONYMOUS==="true"}}
