import type {ToolContract,ToolInvocation,ToolRequest} from "./contracts";
let seq=0;
export function createInvocation(request:ToolRequest,tool:ToolContract):ToolInvocation{
 seq++;
 if(tool.inputKeys.some(k=>!(k in request.input))) throw new Error("TOOL_INPUT_MISSING");
 return {invocationId:"inv-"+seq,request,status:"PLANNED"};
}
export function approveInvocation(i:ToolInvocation,approvalId:string):ToolInvocation{
 if(i.status!=="PLANNED") throw new Error("INVOCATION_NOT_PLANNED");
 if(!approvalId) throw new Error("APPROVAL_REQUIRED");
 return {...i,status:"APPROVED",request:{...i.request,approvalId}} as ToolInvocation;
}