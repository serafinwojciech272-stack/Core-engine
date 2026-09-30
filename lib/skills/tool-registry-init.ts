import { coreTools, registerTool } from "./tool-registry";

let initialized = false;

export function initializeCoreTools(): void {
  if (initialized) return;
  for (const tool of coreTools) {
    try {
      registerTool(tool);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.startsWith("TOOL_ALREADY_REGISTERED:")) throw error;
    }
  }
  initialized = true;
}

export function getCoreTools() {
  initializeCoreTools();
  return coreTools;
}
