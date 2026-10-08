import type {ToolContract,ToolInvocation} from "./contracts";
import type {ExecutionPermission} from "./permission";
import {assertPermission} from "./permission";
import {assertCircuitClosed, getIdempotentResult, recordCircuitFailure, recordCircuitSuccess, rememberIdempotentResult, runtimeTransition, withRetry, withTimeout} from "./hardening";

export type ToolAdapter=(input:Record<string,unknown>,signal?:AbortSignal)=>Promise<Record<string,unknown>>;

export async function executeTool(
  i:ToolInvocation,
  tool:ToolContract,
  p:ExecutionPermission,
  adapter:ToolAdapter,
  now=Date.now(),
){
  assertPermission(p,i,now);
  if(i.status!=="APPROVED") throw new Error("INVOCATION_NOT_APPROVED");

  const cached=getIdempotentResult(i);
  if(cached) return cached.result as {invocation:ToolInvocation;output?:Record<string,unknown>;toolId:string};

  assertCircuitClosed(tool.id);
  const running={...i,status:runtimeTransition(i.status,"EXECUTING"),startedAt:now,attempts:0 as number};
  const timeoutMs=Math.max(1,i.request.timeoutMs??15000);
  const maxAttempts=Math.max(1,i.request.maxAttempts??2);

  try{
    const output=await withRetry(
      async()=>{
        running.attempts=(running.attempts??0)+1;
        return withTimeout((signal)=>adapter(i.request.input,signal),timeoutMs);
      },
      {maxAttempts},
    );
    recordCircuitSuccess(tool.id);
    const result={invocation:{...running,status:runtimeTransition("EXECUTING","COMPLETED"),endedAt:Date.now()},output,toolId:tool.id};
    rememberIdempotentResult(i,result);
    return result;
  }catch(error){
    const message=String(error);
    const status=message.includes("TOOL_TIMEOUT")?"TIMED_OUT":"FAILED";
    recordCircuitFailure(tool.id);
    const result={invocation:{...running,status:status as ToolInvocation["status"],endedAt:Date.now()},error:message,toolId:tool.id};
    rememberIdempotentResult(i,result);
    return result;
  }
}
