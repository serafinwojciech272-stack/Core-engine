export type ToolRisk="LOW"|"MEDIUM"|"HIGH"|"CRITICAL";
export type ToolKind="MCP"|"BROWSER"|"COMPUTER"|"CODE"|"FILES"|"DATABASE"|"API"|"EXTERNAL";
export type ToolCapability="read"|"write"|"execute"|"network";
export type ToolContract={id:string;version:string;name:string;kind:ToolKind;risk:ToolRisk;capabilities:ToolCapability[];trusted:boolean;inputKeys:string[];outputKeys:string[]};
export type ToolRequest={tenantId:string;missionId:string;toolId:string;input:Record<string,unknown>;requestedBy:string;approvalId?:string;permissionId?:string;idempotencyKey?:string;timeoutMs?:number;maxAttempts?:number};
export type ToolInvocation={invocationId:string;request:ToolRequest;status:"PLANNED"|"APPROVED"|"EXECUTING"|"COMPLETED"|"FAILED"|"BLOCKED"|"TIMED_OUT";startedAt?:number;endedAt?:number;attempts?:number};
export type ToolEvent={type:"INVOCATION"|"VERIFICATION"|"OUTCOME"|"LEARNING";tenantId:string;missionId:string;invocationId:string;payload:Record<string,unknown>};
