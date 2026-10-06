import type {ToolContract,ToolInvocation} from "./contracts"; import {evaluateToolPolicy,type ToolPolicy} from "./policy";
export type ApprovalDecision={approved:boolean;reason:string;approvalId?:string};
export function requestApproval(i:ToolInvocation,tool:ToolContract,policy:ToolPolicy={}):ApprovalDecision{const p=evaluateToolPolicy(tool,policy);if(!p.allowed)return {approved:false,reason:p.reason};if(tool.risk==="LOW")return {approved:true,reason:"LOW_RISK",approvalId:"auto-low-"+i.invocationId};return {approved:false,reason:"HUMAN_APPROVAL_REQUIRED"}}
