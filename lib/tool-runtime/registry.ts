import type {ToolContract} from "./contracts";
export class ToolRegistry{private readonly tools=new Map<string,ToolContract>();
register(tool:ToolContract){if(this.tools.has(tool.id))throw new Error("TOOL_ALREADY_REGISTERED");if(!tool.trusted)throw new Error("TOOL_TRUST_REQUIRED");this.tools.set(tool.id,tool);return tool}
get(id:string){return this.tools.get(id)}
list(){return [...this.tools.values()]}}
