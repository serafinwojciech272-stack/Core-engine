import type {ToolContract,ToolRequest} from "./contracts"; import {ToolRegistry} from "./registry";
export function routeTool(registry:ToolRegistry,request:ToolRequest):ToolContract{const tool=registry.get(request.toolId);if(!tool)throw new Error("TOOL_NOT_FOUND");if(!request.tenantId||!request.missionId)throw new Error("TENANT_MISSION_REQUIRED");return tool}
