import type {ToolContract} from "./contracts";
export type ToolPolicy={allowKinds?:string[];denyKinds?:string[];maxRisk?:string};
const rank:Record<string,number>={LOW:1,MEDIUM:2,HIGH:3,CRITICAL:4};
export function evaluateToolPolicy(tool:ToolContract,policy:ToolPolicy={}){if(policy.denyKinds?.includes(tool.kind))return {allowed:false,reason:"KIND_DENIED"};if(policy.allowKinds&&!policy.allowKinds.includes(tool.kind))return {allowed:false,reason:"KIND_NOT_ALLOWED"};if(policy.maxRisk&&rank[tool.risk]>rank[policy.maxRisk])return {allowed:false,reason:"RISK_LIMIT"};return {allowed:true,reason:"POLICY_ALLOW"}}
